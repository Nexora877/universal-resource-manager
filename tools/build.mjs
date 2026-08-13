import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const extension = path.join(root, 'extension');
const dist = path.join(root, 'dist');
const packageDir = path.join(dist, 'package');
const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));

fs.rmSync(packageDir, { recursive: true, force: true });
fs.mkdirSync(packageDir, { recursive: true });
fs.mkdirSync(dist, { recursive: true });

fs.cpSync(extension, packageDir, { recursive: true });

const zipName = `universal-resource-manager-v${manifest.version}.zip`;
const zipPath = path.join(dist, zipName);
fs.rmSync(zipPath, { force: true });

try {
  execFileSync('zip', ['-qr', zipPath, '.'], { cwd: packageDir, stdio: 'inherit' });
} catch {
  console.error('The build requires the system `zip` command. On Windows use scripts/build.ps1.');
  process.exit(1);
}

fs.rmSync(packageDir, { recursive: true, force: true });
console.log(zipPath);
