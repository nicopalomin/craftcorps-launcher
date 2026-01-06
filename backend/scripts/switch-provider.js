const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

try {
    let schema = fs.readFileSync(schemaPath, 'utf8');
    const dbUrl = process.env.DATABASE_URL || '';

    // Check if we are in a Postgres environment
    if (dbUrl.includes('postgres')) {
        console.log('[Schema Switch] Detected PostgreSQL URL. Switching provider to "postgresql".');
        schema = schema.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
    } else {
        console.log('[Schema Switch] defaulting to "sqlite" (Local Dev).');
        schema = schema.replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"');
    }

    fs.writeFileSync(schemaPath, schema);
    console.log('[Schema Switch] Success.');
} catch (e) {
    console.error('[Schema Switch] Error:', e);
    process.exit(1);
}
