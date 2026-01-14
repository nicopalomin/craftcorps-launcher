
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
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const TELEMETRY_SECRET = process.env.TELEMETRY_SECRET || 'dev_secret_change_me_in_prod';

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
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB limit
    }
});

// -- Middleware --
app.set('trust proxy', true); // Enable X-Forwarded-For updates
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// -- Rate Limiters --
const bootstrapLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 bootstrap requests per hour
    message: { error: 'Too many bootstrap requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const telemetryLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 requests per minute (burst)
    message: { error: 'Telemetry rate limit exceeded' },
    standardHeaders: true,
    legacyHeaders: false,
});

// -- Custom Auth Middleware for Telemetry --
const requireTelemetryAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Missing telemetry token' });
    }

    jwt.verify(token, TELEMETRY_SECRET, (err: any, user: any) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        (req as any).telemetryUser = user;
        next();
    });
};

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

// 0.5 Bootstrap Telemetry Token
app.post('/api/telemetry/bootstrap', bootstrapLimiter, async (req, res) => {
    // Generate a temporary anonymous ID or use provided if valid?
    // For simplicity, we mint a new token. Client must store it.
    // Ideally, client sends a UUID they generated.
    const { clientId } = req.body;
    const finalId = clientId || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const token = jwt.sign({ clientId: finalId }, TELEMETRY_SECRET, { expiresIn: '24h' });

    res.json({ token, clientId: finalId, expiresIn: 86400 });
});

// 1. Heartbeat (DAU/MAU + Session)
app.post('/api/heartbeat', requireTelemetryAuth, async (req, res) => {
    const { sessionId, appVersion } = req.body;
    const userId = (req as any).telemetryUser.clientId;

    if (!userId) {
        return res.status(400).json({ error: 'Missing userId from token' });
    }

    try {
        const ip = req.ip || '127.0.0.1';
        const geo = geoip.lookup(ip);
        const country = geo ? geo.country : null;

        // 1. Update User Last Seen & Streak Logic
        const todayStr = new Date().toISOString().split('T')[0];

        // Fetch existing user to check streak
        const existingUser = await prisma.analyticsUser.findUnique({ where: { id: userId } });

        const lastSeen = existingUser ? existingUser.lastSeen : null;
        let streakUpdate = {};

        if (lastSeen) {
            const lastSeenStr = lastSeen.toISOString().split('T')[0];
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (lastSeenStr === yesterdayStr) {
                // Streak continues
                streakUpdate = { streak: { increment: 1 }, streakLastUpdated: new Date() };
            } else if (lastSeenStr !== todayStr) {
                // Streak broken (if not today)
                streakUpdate = { streak: 1, streakLastUpdated: new Date() };
            }
            // If lastSeenStr === todayStr, do nothing (already counted for today)
        } else {
            // First time
            streakUpdate = { streak: 1, streakLastUpdated: new Date() };
        }

        await prisma.analyticsUser.upsert({
            where: { id: userId },
            update: { lastSeen: new Date(), country: country, ...streakUpdate },
            create: { id: userId, country: country, streak: 1, streakLastUpdated: new Date() },
        });

        // 2. Manage Session
        let currentSessionId = sessionId;

        if (currentSessionId) {
            // Update existing session
            await prisma.session.updateMany({
                where: { id: currentSessionId, userId: userId },
                data: { endTime: new Date(), appVersion: appVersion }
            });
        } else {
            // Create new session
            const session = await prisma.session.create({
                data: {
                    userId: userId,
                    startTime: new Date(),
                    endTime: new Date(),
                    appVersion: appVersion || 'Unknown'
                }
            });
            currentSessionId = session.id;
        }

        // @ts-ignore
        logger.info(`[Heartbeat] User ${userId} [${country || 'Unknown'}] Session: ${currentSessionId} (v${appVersion || '??'}) Streak: ${(existingUser as any)?.streak || 1}`);
        res.json({ success: true, sessionId: currentSessionId });
    } catch (error) {
        logger.error('Heartbeat error', error);
        res.status(500).json({ success: false });
    }
});

// 2. Hardware Specs
app.post('/api/hardware', requireTelemetryAuth, async (req, res) => {
    const { os, osVersion, ram, gpu, cpu } = req.body;
    const userId = (req as any).telemetryUser.clientId;

    if (!userId) return res.status(400).json({ error: 'Missing userId from token' });

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
app.post('/api/telemetry', requireTelemetryAuth, telemetryLimiter, async (req, res) => {
    const { events } = req.body;
    const userId = (req as any).telemetryUser.clientId;

    if (!userId || !Array.isArray(events)) {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    try {
        // Calculate play time to add
        let addedMinutes = 0;
        for (const e of events) {
            if (e.type === 'PLAY_TIME_PING' && e.metadata && typeof e.metadata.duration === 'number') {
                addedMinutes += Math.floor(e.metadata.duration / 60000);
            }
        }

        // Fetch user first to check existing flags
        const existingUser = await prisma.analyticsUser.findUnique({ where: { id: userId } });

        const userUpdate: any = {
            lastSeen: new Date(),
            playTimeMinutes: addedMinutes > 0 ? { increment: addedMinutes } : undefined
        };

        // Check for Lifecycle Events in the batch (Conditional Update)
        for (const e of events) {
            const ts = new Date(e.timestamp || Date.now());

            if (e.type === 'FIRST_LAUNCH') {
                if (!existingUser || !existingUser.firstLaunch) userUpdate.firstLaunch = ts;
            }
            if (e.type === 'FIRST_LOGIN') {
                if (!existingUser || !existingUser.firstLogin) userUpdate.firstLogin = ts;
            }
            if (e.type === 'FIRST_INSTANCE') {
                if (!existingUser || !existingUser.firstInstance) userUpdate.firstInstance = ts;
            }
            if (e.type === 'FIRST_GAME_LAUNCH') {
                if (!existingUser || !existingUser.firstGameLaunch) userUpdate.firstGameLaunch = ts;
            }

            if (e.type === 'THEME_CHANGE' && e.metadata) {
                try {
                    const meta = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata;
                    if (meta.theme) userUpdate.currentTheme = meta.theme;
                } catch (err) { /* ignore */ }
            }
        }

        await prisma.analyticsUser.upsert({
            where: { id: userId },
            update: userUpdate,
            create: {
                id: userId,
                playTimeMinutes: addedMinutes,
                // If it's a create, we might want to capture these too if present
                firstLaunch: userUpdate.firstLaunch,
                firstLogin: userUpdate.firstLogin,
                firstInstance: userUpdate.firstInstance,
                firstGameLaunch: userUpdate.firstGameLaunch,
                currentTheme: userUpdate.currentTheme
            },
        });

        if (addedMinutes > 0) {
            logger.info(`[Telemetry] Added ${addedMinutes} mins to User ${userId}`);
        }

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

        // New Aggregates
        const totalInstalls = await prisma.analyticsUser.count({ where: { firstLaunch: { not: null } } });
        const totalActivations = await prisma.analyticsUser.count({ where: { firstGameLaunch: { not: null } } });

        // Simple Funnel (Counts)
        const funnel = {
            installs: totalInstalls, // Step 1
            logins: await prisma.analyticsUser.count({ where: { firstLogin: { not: null } } }), // Step 2
            instances: await prisma.analyticsUser.count({ where: { firstInstance: { not: null } } }), // Step 3
            activations: totalActivations // Step 4
        };

        // Theme Usage
        const themeStats = await prisma.analyticsUser.groupBy({
            by: ['currentTheme'],
            _count: { currentTheme: true },
            where: { currentTheme: { not: null } }
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
            daily_active_users: dailyArray,
            funnel: funnel,
            theme_usage: themeStats.map(t => ({ theme: t.currentTheme, count: t._count.currentTheme })),
            total_installs: totalInstalls,
            total_activations: totalActivations
        });
    } catch (error) {
        logger.error('Stats error', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 5. Crash Reporting (Public Submission)
// Note: Electron's crashReporter doesn't easily support custom headers for all uploads, 
// but our manual 'sendManualCrashReport' does. 
// For strict auth, we check for 'authorization' header. 
// IF the standard crashReporter is used, this might fail unless we patch headers on client or allow anonymous.
// Given strict reqs: we ENFORCE it.
app.post('/api/crash-report', requireTelemetryAuth, upload.single('upload_file_minidump'), async (req: any, res: any, next: any) => {
    // Custom Auth Check because multer runs before body parsing, 
    // but headers are available.
    // The requireTelemetryAuth middleware now handles this.

    // Proceed
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
                userId: req.telemetryUser.clientId // Link to user
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

        logger.info(`[Download] Request for crash ID: ${id}`);

        if (!crash) {
            logger.warn(`[Download] Crash ID ${id} not found in DB`);
            return res.status(404).send('Dump not found');
        }

        logger.info(`[Download] Found crash in DB. Path: ${crash.dumpPath}`);

        if (!crash.dumpPath) {
            logger.warn(`[Download] Crash ID ${id} has no dumpPath set`);
            return res.status(404).send('Dump path missing');
        }

        if (!fs.existsSync(crash.dumpPath)) {
            logger.error(`[Download] File not found on disk: ${crash.dumpPath}`);
            // Check if directory exists for context
            const dir = path.dirname(crash.dumpPath);
            const dirExists = fs.existsSync(dir);
            logger.info(`[Download] Directory ${dir} exists? ${dirExists}`);
            if (dirExists) {
                const files = fs.readdirSync(dir);
                logger.info(`[Download] Directory contents: ${files.join(', ')}`);
            }
            return res.status(404).send('Dump file missing on server');
        }

        logger.info(`[Download] File exists. Size: ${fs.statSync(crash.dumpPath).size} bytes. Streaming...`);

        // Force text/plain so it doesn't try to download as binary octet-stream causing issues in some viewers,
        // or ensure it sends the correct extension. 
        res.setHeader('Content-Type', 'text/plain');
        res.download(crash.dumpPath, `crash-${id}.txt`, (err) => {
            if (err) {
                if (!res.headersSent) {
                    res.status(500).send('Error downloading file');
                }
                logger.error('Download callback error', err);
            }
        });
    } catch (error) {
        logger.error('Download dump error', error);
        res.status(500).send('Error');
    }
});

// 8. Delete Crash Report (Protected)
app.delete('/api/crashes/:id', requireAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const crash = await prisma.crashReport.findUnique({ where: { id } });

        if (!crash) {
            return res.status(404).send('Crash report not found');
        }

        // Delete file if exists
        if (crash.dumpPath && fs.existsSync(crash.dumpPath)) {
            try {
                fs.unlinkSync(crash.dumpPath);
                logger.info(`[Delete] Deleted crash file: ${crash.dumpPath}`);
            } catch (err) {
                logger.error(`[Delete] Failed to delete file ${crash.dumpPath}`, err);
                // Continue to delete DB record anyway? Usually yes.
            }
        } else {
            logger.warn(`[Delete] File not found or no path for crash ${id}, skipping file delete.`);
        }

        // Delete from DB
        await prisma.crashReport.delete({ where: { id } });
        logger.info(`[Delete] Deleted crash record ${id} from DB`);

        res.json({ success: true });
    } catch (error) {
        logger.error('Delete crash error', error);
        res.status(500).send('Error deleting crash report');
    }
});

// -- Start Server --
if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`Stats Backend running on port ${PORT}`);
    });
}

export default app;
