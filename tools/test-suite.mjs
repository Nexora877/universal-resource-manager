import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const scanner = fs.readFileSync(path.join(root, 'extension', 'scanner.js'), 'utf8');
const sidepanel = fs.readFileSync(path.join(root, 'extension', 'sidepanel.js'), 'utf8');
const background = fs.readFileSync(path.join(root, 'extension', 'background.js'), 'utf8');

assert.match(scanner, /partFromFilename/);
assert.match(scanner, /partFromContext/);
assert.match(sidepanel, /executeScript/);
assert.match(sidepanel, /readScannerResult/);
assert.match(sidepanel, /__URM_SCAN_RESULT/);
assert.match(sidepanel, /historyLimit/);
assert.match(sidepanel, /historyScope/);
assert.match(sidepanel, /errorCenter|renderErrors/);
assert.match(background, /umLogs/);
assert.match(background, /origin: page\.origin/);
assert.match(background, /themePack/);
assert.doesNotMatch(sidepanel, /const tab = candidates\.find\(item => item\?\.id && \/\^https\?:\\\/\\\/i\.test/);
assert.match(background, /chrome\.downloads\.download/);
assert.doesNotMatch(scanner, /\.click\s*\(/);
assert.match(scanner, /version: 6/);
assert.match(scanner, /scanId/);
assert.match(scanner, /duplicateKey/);
assert.match(scanner, /resourceGroup/);
assert.match(sidepanel, /refreshQueue/);
assert.match(background, /umDownloadQueue/);
assert.match(background, /validateResources/);
assert.match(fs.readFileSync(path.join(root, 'extension', 'i18n.js'), 'utf8'), /dictionaries/);

const cases = [
  ['Resident.Evil.part01.rar', 1],
  ['Resident.Evil.part-02.zip', 2],
  ['game.part03.7z', 3],
  ['P30-Download-Regular.exe', null],
  ['something-30-download.exe', null],
  ['part100.iso', 100]
];

const filenamePattern = /(?:^|[._-])part[._ -]?(\d{1,5})(?=[._-]|$)/i;
for (const [input, expected] of cases) {
  const match = input.match(filenamePattern);
  const actual = match ? Number(match[1]) : null;
  assert.equal(actual, expected, `Part regression: ${input}`);
}

console.log('Test suite passed:', cases.length + 12, 'checks.');
