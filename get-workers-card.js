const fs = require('fs');
const content = fs.readFileSync('src/app/admin/masters/page.tsx', 'utf8');
const idx = content.indexOf('inputRef={fileInputRefWorkers}');
console.log(content.substring(idx - 200, idx + 1000));
