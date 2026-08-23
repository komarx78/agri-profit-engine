const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/admin/tasks/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /tenant_id: tenantId,/,
  "user_id: tenantId,"
);

// fetchの方でも tenant_id で絞り込んでいるところがある
content = content.replace(
  /\.eq\('tenant_id', userTenantId\)/g,
  ".eq('user_id', userTenantId)"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed tenant_id to user_id in tasks page');
