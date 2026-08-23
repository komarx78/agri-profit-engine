const fs = require('fs');
const content = fs.readFileSync('src/app/work/page.tsx', 'utf8');
const idx = content.indexOf(`supabase.from('work_logs').insert`);
console.log(content.substring(idx - 200, idx + 800));
