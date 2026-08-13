import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const extension = path.join(root, 'extension');
const manifestPath = path.join(extension, 'manifest.json');

const fail = message => {
  console.error(`VALIDATION FAILED: ${message}`);
  process.exit(1);
};

if (!fs.existsSync(manifestPath)) fail('extension/manifest.json is missing.');

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
  fail(`manifest.json is invalid JSON: ${error.message}`);
}

if (manifest.manifest_version !== 3) fail('Manifest V3 is required.');
if (!manifest.name || manifest.name.length > 45) fail('name must be present and no longer than 45 characters.');
if (!manifest.description || manifest.description.length > 132) fail('description must be present and no longer than 132 characters.');
if (manifest.version !== '0.2.4') fail(`Expected version 0.2.4, got ${manifest.version}.`);
if (!Array.isArray(manifest.host_permissions) || !manifest.host_permissions.includes('http://*/*') || !manifest.host_permissions.includes('https://*/*')) fail('HTTP and HTTPS host permissions are required.');
if (manifest.optional_host_permissions?.length) fail('optional_host_permissions must be empty.');
if (manifest.permissions?.includes('activeTab')) fail('activeTab should not be required.');
if (!fs.existsSync(path.join(extension, 'i18n.js'))) fail('i18n.js is required.');
if (!manifest.permissions?.includes('scripting')) fail('scripting permission is required.');

for (const icon of ['16', '32', '48', '128']) {
  const iconPath = path.join(extension, manifest.icons?.[icon] || '');
  if (!manifest.icons?.[icon] || !fs.existsSync(iconPath)) fail(`Missing icon ${icon}.`);
}

for (const file of fs.readdirSync(extension)) {
  if (!file.endsWith('.js')) continue;
  const result = spawnSync(process.execPath, ['--check', path.join(extension, file)], { encoding: 'utf8' });
  if (result.status !== 0) fail(`${file}: ${result.stderr.trim()}`);
}

const forbidden = /\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*['"`]|setInterval\s*\(\s*['"`]/;
for (const file of fs.readdirSync(extension)) {
  if (!file.endsWith('.js')) continue;
  const content = fs.readFileSync(path.join(extension, file), 'utf8');
  if (forbidden.test(content)) fail(`${file} contains forbidden string-evaluation patterns.`);
}

console.log(`Validation passed for Universal Resource Manager ${manifest.version}.`);
