import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const extension = path.join(root, 'extension');
const dist = path.join(root, 'dist');
const profileName = process.argv[2] || 'public';

const profiles = {
  public: { channel: 'public', debug: false, diagnostics: false },
  personal: { channel: 'personal', debug: false, diagnostics: true },
  developer: { channel: 'developer', debug: true, diagnostics: true }
};

if (!profiles[profileName]) throw new Error(`Unknown build profile: ${profileName}`);

const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
const packageDir = path.join(dist, `package-${profileName}`);
const zipName = `universal-resource-manager-v${manifest.version}-${profileName}.zip`;
const zipPath = path.join(dist, zipName);

fs.rmSync(packageDir, { recursive: true, force: true });
fs.mkdirSync(packageDir, { recursive: true });
fs.mkdirSync(dist, { recursive: true });
fs.cpSync(extension, packageDir, { recursive: true });

const profileJs = `globalThis.UM_BUILD = Object.freeze(${JSON.stringify({ ...profiles[profileName], appName: 'Universal Resource Manager', subtitle: 'Unified Link Intelligence' })});\n`;
fs.writeFileSync(path.join(packageDir, 'profile.js'), profileJs);

if (profileName === 'public') {
  const debugDoc = path.join(packageDir, 'DEV_PROFILE.md');
  fs.rmSync(debugDoc, { force: true });
}

fs.rmSync(zipPath, { force: true });
execFileSync('zip', ['-qr', zipPath, '.'], { cwd: packageDir, stdio: 'inherit' });
fs.rmSync(packageDir, { recursive: true, force: true });
console.log(zipPath);
