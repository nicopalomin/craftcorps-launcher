const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function (configuration) {
    // Only run on Windows usually, but the tool might run on other platforms if using cross-signing tools. 
    // Trusted Signing with signtool logic is Windows-specific relative to the dlib usually.

    // Logic: 
    // 1. Check env vars
    // 2. If present, run signtool
    // 3. If not, skip (or fail if STRICT_SIGNING is set)

    const { path: filePath } = configuration;

    const metadataPath = process.env.AZURE_SIGNING_METADATA_PATH;
    const dlibPath = process.env.AZURE_SIGNING_DLIB_PATH;

    if (!metadataPath || !dlibPath) {
        console.warn('Skipping Azure Trusted Signing: AZURE_SIGNING_METADATA_PATH or AZURE_SIGNING_DLIB_PATH not set.');
        return;
    }

    if (!fs.existsSync(metadataPath)) {
        throw new Error(`Metadata file not found at: ${metadataPath}`);
    }

    // dlib might be a relative path or absolute
    // It's best to verify it exists if possible, but signtool will error if not.

    console.log(`Signing ${filePath} using Azure Trusted Signing...`);

    // Construct signtool command
    // Note: /tr and /td are for timestamping, highly recommended.
    // timestamp.acs.microsoft.com is the standard timestamp server for Azure Trusted Signing.

    const command = `signtool sign /v /fd sha256 /tr http://timestamp.acs.microsoft.com /td sha256 /dlib "${dlibPath}" /dmdf "${metadataPath}" "${filePath}"`;

    try {
        execSync(command, { stdio: 'inherit' });
        console.log('Successfully signed with Azure Trusted Signing.');
    } catch (error) {
        console.error('Failed to sign file:', filePath);
        console.error('Ensure signtool is in your PATH and Azure Code Signing Client is installed.');
        throw error;
    }
};
