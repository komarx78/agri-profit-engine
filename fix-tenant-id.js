const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/admin/masters/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// handleSaveの先頭付近に tenant_id を付与する処理を追加する
const targetSearch = `      if (['crops', 'fields', 'materials'].includes(table) && dataToSave.name) {`;

const tenantInjection = `
      // セッションからユーザーID (テナントID) を取得してセット
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        dataToSave.tenant_id = session.user.id;
      }
`;

if (!content.includes('dataToSave.tenant_id = session.user.id;')) {
  content = content.replace(targetSearch, tenantInjection + '\n' + targetSearch);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully injected tenant_id to dataToSave');
