const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { glob } = require('glob');
require('dotenv').config();

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.R2_BUCKET_NAME;

// Validation
if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET_NAME) {
    console.error('Error: Missing R2 environment variables. Please check your .env file.');
    console.error('Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
    process.exit(1);
}

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
    },
});

const DIST_DIR = path.resolve(__dirname, '../release'); // Ensure this matches package.json directories.output

async function uploadFile(filePath) {
    const fileName = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);
    const contentType = mime.lookup(filePath) || 'application/octet-stream';

    console.log(`Uploading ${fileName}...`);

    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: fileContent,
            ContentType: contentType,
            // ACL: 'public-read', // R2 custom domains are usually public by default if configured
        }));
        console.log(`✅ Uploaded ${fileName}`);
    } catch (err) {
        console.error(`❌ Failed to upload ${fileName}:`, err.message);
        throw err;
    }
}

async function main() {
    console.log(`Searching for artifacts in ${DIST_DIR}...`);

    // Find artifacts: YAML (update info), EXE (Win), DMG/ZIP (Mac), AppImage (Linux), Blockmap (Delta updates)
    // We explicitly verify we are uploading the latest files.
    // NOTE: electron-builder output is usually flat in the output directory, or in subfolders per version?
    // Usually flat or flat-ish for the latest. files.

    // Use brace expansion to catch all artifact types in a single glob pattern
    // This finds: .yml (auto-updater), .exe (Win), .zip/.dmg (Mac), .AppImage (Linux), and .blockmap (Delta updates)
    const pattern = '*.{yml,exe,exe.blockmap,zip,dmg,dmg.blockmap,AppImage,AppImage.blockmap}';

    const matches = await glob(pattern, { cwd: DIST_DIR, absolute: true });

    if (matches.length === 0) {
        console.warn('No artifacts found to upload. Did you run the build script?');
        return;
    }

    console.log(`Found ${matches.length} files to upload.`);

    for (const filePath of matches) {
        await uploadFile(filePath);
    }

    console.log('🚀 All files uploaded successfully to R2!');
}

main().catch(err => {
    console.error('Upload failed:', err);
    process.exit(1);
});
