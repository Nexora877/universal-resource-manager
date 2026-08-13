const normalize = value => (value || '').replace(/[۰-۹]/g, char => '۰۱۲۳۴۵۶۷۸۹'.indexOf(char)).replace(/\u200c/g, ' ').trim();
const partFromFilename = value => {
  const text = normalize(value);
  for (const pattern of [/(?:^|[._-])part[._ -]?(\d{1,5})(?:[._-]|$)/i, /(?:^|[._-])pt[._ -]?(\d{1,5})(?:[._-]|$)/i]) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
};
const partFromContext = value => {
  const match = normalize(value).match(/(?:download\s*)?(?:part|پارت|قسمت|episode|ep)[\s._:#-]*(\d{1,5})/i);
  return match ? Number(match[1]) : null;
};

const cases = [
  ['Resident.Evil.part01.rar', 1],
  ['Resident.Evil.part09.rar?123', 9],
  ['P30-Download-Regular.zip', null],
  ['Part 7', 7],
  ['دانلود پارت 12', 12],
  ['episode-3', 3],
  ['foo-p30-bar.txt', null]
];

for (const [input, expected] of cases) {
  const actual = partFromFilename(input) ?? partFromContext(input);
  if (actual !== expected) {
    console.error(`FAILED: ${input} => ${actual}, expected ${expected}`);
    process.exit(1);
  }
}

console.log(`Part detector regression tests passed (${cases.length} cases).`);
