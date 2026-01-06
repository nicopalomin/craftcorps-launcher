
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.analyticsUser.findFirst();
        if (!user) {
            console.log('No users found. Cannot seed event.');
            return;
        }

        await prisma.event.create({
            data: {
                userId: user.id,
                type: 'GAME_LAUNCH',
                metadata: JSON.stringify({ version: '1.20.1', ram: 4, debug: true }),
                createdAt: new Date()
            }
        });

        console.log('Seeded 1 GAME_LAUNCH event for user', user.id);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
