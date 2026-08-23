const fs = require('fs');
const content = fs.readFileSync('src/app/work/page.tsx', 'utf8');
const handleIdx = content.indexOf('handleManualSubmit');
const idx = content.indexOf(`supabase.from('work_logs').insert`, handleIdx);
console.log(content.substring(idx - 100, idx + 800));
