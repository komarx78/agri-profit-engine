const fs = require('fs');
const content = fs.readFileSync('src/app/admin/masters/page.tsx', 'utf8');
const idx = content.indexOf(`{modalType === 'workers'`);
console.log(content.substring(idx, idx + 2000));
