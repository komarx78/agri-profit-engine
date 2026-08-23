const fs = require('fs');
const content = fs.readFileSync('src/app/work/page.tsx', 'utf8');
const lines = content.split('\n');

const fetchDataIdx = lines.findIndex(l => l.includes('async function fetchData() {'));
if (fetchDataIdx !== -1) {
  console.log('--- fetchData ---');
  console.log(lines.slice(fetchDataIdx - 2, fetchDataIdx + 30).join('\n'));
}

const workTabIdx = lines.findIndex(l => l.includes('activeTab === \'work\' && ('));
if (workTabIdx !== -1) {
  console.log('--- workTab ---');
  console.log(lines.slice(workTabIdx - 2, workTabIdx + 20).join('\n'));
}
