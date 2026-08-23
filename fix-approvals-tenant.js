const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/admin/approvals/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /\.eq\('tenant_id', userTenantId\)/g,
  ".eq('user_id', userTenantId)"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed tenant_id to user_id in approvals page');
