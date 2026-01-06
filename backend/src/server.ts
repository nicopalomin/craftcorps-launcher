
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import winston from 'winston';

import geoip from 'geoip-lite';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// -- Logger Setup --
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({ format: winston.format.simple() }),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
    ],
});

// -- Middleware --
app.set('trust proxy', true); // Enable X-Forwarded-For updates
app.use(helmet());
app.use(cors());
app.use(express.json());

// -- Endpoints --

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
app.get('/api/public/stats', async (req, res) => {
    const authHeader = req.headers.authorization;
    const secret = process.env.API_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

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

// -- Start Server --
if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`Stats Backend running on port ${PORT}`);
    });
}

export default app;
