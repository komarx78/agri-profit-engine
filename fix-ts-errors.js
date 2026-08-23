const fs = require('fs');
const path = require('path');

let filePath = path.join(__dirname, 'src/app/work/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// currentUser.tenant_id を wRes.data?.user_id に直す
content = content.replace(
  /\.eq\('user_id', currentUser\.tenant_id\)/g,
  ".eq('user_id', wRes.data?.user_id || 'unknown')"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed user_id reference in work page');

filePath = path.join(__dirname, 'src/app/admin/masters/page.tsx');
content = fs.readFileSync(filePath, 'utf8');

// inputRef={null} を inputRef={undefined as any} にする
content = content.replace(
  /inputRef=\{null\}/g,
  "inputRef={undefined as any}"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed inputRef null in masters page');
