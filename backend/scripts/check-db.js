
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.event.count();
        console.log(`Total Events in DB: ${count}`);

        if (count > 0) {
            const launches = await prisma.event.count({
                where: { type: 'GAME_LAUNCH' }
            });
            console.log(`Total GAME_LAUNCH events: ${launches}`);

            const firstEvent = await prisma.event.findFirst();
            console.log('Sample Event:', firstEvent);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
