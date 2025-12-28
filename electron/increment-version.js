import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
const packageJson = JSON.parse(packageJsonContent);

const currentVersion = packageJson.version;
const versionParts = currentVersion.split('.').map(Number);

// Increment patch version
versionParts[2] += 1;

const newVersion = versionParts.join('.');

console.log(`Updating version from ${currentVersion} to ${newVersion}`);

packageJson.version = newVersion;

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
