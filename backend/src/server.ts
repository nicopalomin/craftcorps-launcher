
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import winston from 'winston';
import { createClient } from '@supabase/supabase-js';

import geoip from 'geoip-lite';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// -- Supabase Auth --
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY) environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else if (queryToken) {
        token = queryToken;
    }

    if (!token) {
        return res.status(401).json({ error: 'Missing authentication token' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    (req as any).user = user;
    next();
};

// -- Logger Setup --
const logClients: any[] = [];

class SseTransport extends (winston as any).Transport {
    log(info: any, callback: () => void) {
        setImmediate(() => {
            this.emit('logged', info);
        });

        const payload = JSON.stringify({
            level: info.level,
            message: info.message,
            timestamp: new Date().toISOString()
        });

        logClients.forEach(res => {
            res.write(`data: ${payload}\n\n`);
        });

        if (callback) callback();
    }
}

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({ format: winston.format.simple() }),
        new SseTransport() as any,
    ],
});

// -- Multer Config for Crash Dumps --
const uploadDir = path.join(__dirname, '../uploads/crashes');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'crash-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// -- Middleware --
app.set('trust proxy', true); // Enable X-Forwarded-For updates
app.use(helmet());
app.use(cors());
app.use(express.json());

// -- Endpoints --

// 0. Log Stream (SSE)
app.get('/api/logs/stream', requireAuth, (req, res) => {
    // Auth handled by middleware

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    const initMsg = JSON.stringify({
        type: 'system',
        message: 'Connected to backend log stream',
        timestamp: new Date().toISOString()
    });
    res.write(`data: ${initMsg}\n\n`);

    logClients.push(res);

    const keepAlive = setInterval(() => {
        res.write(': keep-alive\n\n');
    }, 15000);

    req.on('close', () => {
        clearInterval(keepAlive);
        const index = logClients.indexOf(res);
        if (index !== -1) logClients.splice(index, 1);
    });
});

// 1. Heartbeat (DAU/MAU + Session)
app.post('/api/heartbeat', async (req, res) => {
    const { userId, sessionId, appVersion } = req.body; // [NEW] appVersion

    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }

    try {
        const ip = req.ip || '127.0.0.1';
        const geo = geoip.lookup(ip);
        const country = geo ? geo.country : null;

        // 1. Update User Last Seen
        await prisma.analyticsUser.upsert({
            where: { id: userId },
            update: { lastSeen: new Date(), country: country },
            create: { id: userId, country: country },
        });

        // 2. Manage Session
        let currentSessionId = sessionId;

        if (currentSessionId) {
            // Update existing session
            await prisma.session.updateMany({
                where: { id: currentSessionId, userId: userId },
                data: { endTime: new Date() }
            });
        } else {
            // Create new session
            const session = await prisma.session.create({
                data: {
                    userId: userId,
                    startTime: new Date(),
                    endTime: new Date(),
                    appVersion: appVersion || 'Unknown' // [NEW]
                }
            });
            currentSessionId = session.id;
        }

        logger.info(`[Heartbeat] User ${userId} [${country || 'Unknown'}] Session: ${currentSessionId} (v${appVersion || '??'})`);
        res.json({ success: true, sessionId: currentSessionId });
    } catch (error) {
        logger.error('Heartbeat error', error);
        res.status(500).json({ success: false });
    }
});

// 2. Hardware Specs
app.post('/api/hardware', async (req, res) => {
    const { userId, os, osVersion, ram, gpu, cpu } = req.body;

    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    try {
        await prisma.hardware.upsert({
            where: { userId },
            update: { os, osVersion, ram, gpu, cpu },
            create: { userId, os, osVersion, ram, gpu, cpu },
        });
        logger.info(`[Hardware] User ${userId} - ${ram} RAM, ${gpu}`);
        res.json({ success: true });
    } catch (error) {
        logger.error('Hardware error', error);
        res.status(500).json({ success: false });
    }
});

// 3. Telemetry Events (Batch)
app.post('/api/telemetry', async (req, res) => {
    const { userId, events } = req.body; // events = [{ type, metadata, timestamp }]

    if (!userId || !Array.isArray(events)) {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    try {
        // Ensure user exists first
        await prisma.analyticsUser.upsert({
            where: { id: userId },
            update: { lastSeen: new Date() },
            create: { id: userId },
        });

        const eventData = events.map((e: any) => ({
            userId,
            type: e.type,
            metadata: e.metadata ? JSON.stringify(e.metadata) : null,
            createdAt: e.timestamp ? new Date(e.timestamp) : new Date(),
        }));

        await prisma.event.createMany({
            data: eventData,
        });

        logger.info(`[Telemetry] User ${userId} logged ${eventData.length} events`);
        res.json({ success: true, count: eventData.length });
    } catch (error) {
        logger.error('Telemetry error', error);
        res.status(500).json({ success: false });
    }
});

// 4. Public Stats (Protected)
app.get('/api/public/stats', requireAuth, async (req, res) => {
    // Auth handled by middleware

    try {
        const now = new Date();
        const d30 = new Date();
        d30.setDate(d30.getDate() - 30); // 30 Day Window

        // 1. Get raw data for past 30 days
        // We select lastSeen to bucket users by day
        const activeUsers = await prisma.analyticsUser.findMany({
            where: { lastSeen: { gte: d30 } },
            select: { lastSeen: true }
        });

        const totalLaunches = await prisma.event.count({
            where: { type: 'GAME_LAUNCH' }
        });

        // 2. Bucket by Day (in Memory - efficient enough for <100k users)
        // Initialize last 30 days with 0
        const dailyStats: Record<string, number> = {};
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const key = date.toISOString().split('T')[0];
            dailyStats[key] = 0;
        }

        activeUsers.forEach(u => {
            const day = u.lastSeen.toISOString().split('T')[0];
            if (dailyStats[day] !== undefined) {
                dailyStats[day]++;
            }
        });

        // 3. Aggregate totals
        const active30 = activeUsers.length;
        const active14 = activeUsers.filter(u => {
            const date = new Date(u.lastSeen);
            const d14 = new Date();
            d14.setDate(d14.getDate() - 14);
            return date >= d14;
        }).length;

        // 4. Format Daily Array (sorted by date)
        const dailyArray = Object.entries(dailyStats)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        res.json({
            active_users_30d: active30,
            active_users_14d: active14,
            total_launches: totalLaunches,
            daily_active_users: dailyArray
        });
    } catch (error) {
        logger.error('Stats error', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 5. Crash Reporting (Public Submission)
app.post('/api/crash-report', upload.single('upload_file_minidump'), async (req: any, res: any) => {
    try {
        const file = req.file;
        const body = req.body;
        // Electron params: _productName, _version, process_type, guid, ver, platform, prod, etc.

        logger.info(`[Crash] Received report from ${req.ip}`);

        const report = await prisma.crashReport.create({
            data: {
                reportId: body.guid || `unknown-${Date.now()}`,
                platform: body.platform || 'unknown',
                processType: body.process_type || 'unknown',
                appVersion: body.ver || body._version || 'unknown',
                dumpPath: file ? file.path : '',
                ip: req.ip || '',
                // If we had userId in extra params:
                userId: body.userId || undefined,
            }
        });

        res.status(200).send('Shutdown'); // Standard Electron response
        // Note: Electron often expects the returned string to be the crash report ID, 
        // but 'Shutdown' or 'OK' works for avoiding retries if configured. 
        // Actually, creating a crash report ID is better.
    } catch (error) {
        logger.error('Crash report handling error', error);
        res.status(500).send('Error');
    }
});

// 6. Get Crashes (Protected)
app.get('/api/crashes', requireAuth, async (req, res) => {
    // Auth handled by middleware

    try {
        const crashes = await prisma.crashReport.findMany({
            orderBy: { date: 'desc' },
            take: 50
        });
        res.json(crashes);
    } catch (error) {
        logger.error('Get crashes error', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 7. Download Crash Dump (Protected)
app.get('/api/crashes/:id/dump', requireAuth, async (req, res) => {
    // Auth handled by middleware

    try {
        const id = parseInt(req.params.id);
        const crash = await prisma.crashReport.findUnique({ where: { id } });

        if (!crash || !crash.dumpPath || !fs.existsSync(crash.dumpPath)) {
            return res.status(404).send('Dump not found');
        }

        res.download(crash.dumpPath);
    } catch (error) {
        logger.error('Download dump error', error);
        res.status(500).send('Error');
    }
});

// -- Start Server --
if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`Stats Backend running on port ${PORT}`);
    });
}

export default app;
