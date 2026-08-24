const fs = require('fs');
const path = require('path');

const rootDir = 'c:\\Users\\koma\\OneDrive - 株式会社cocotte\\GAS職人\\農業システム\\agri-profit-engine\\src';

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      scanDir(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = scanDir(rootDir);

const results = [];

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const matches = content.match(/supabase\s*\.from\(['"]([^'"]+)['"]\)/g);
  if (matches) {
    const relPath = path.relative(rootDir, file);
    const tables = matches.map(m => m.match(/supabase\s*\.from\(['"]([^'"]+)['"]\)/)[1]);
    const hasTenantFilter = content.includes('tenant_id') || content.includes('user_id') || content.includes('getCurrentTenantId') || content.includes('worker_id') || content.includes('tenantId');
    
    results.push({
      file: relPath,
      tables: Array.from(new Set(tables)),
      hasTenantFilter
    });
  }
});

console.log('=== Supabase クエリを含むファイルと tenant / user_id フィルタの有無 ===\n');
let withoutTenant = 0;
results.forEach(r => {
  const isPublicMasterOnly = r.tables.every(t => t === 'm_pesticides' || t === 'm_pesticide_usages');
  const isSuperAdmin = r.file.startsWith('app\\super-admin') || r.file.startsWith('app/super-admin');

  if (!r.hasTenantFilter && !isPublicMasterOnly && !isSuperAdmin) {
    console.log(`⚠️ 【テナント未分離の疑い】: ${r.file}`);
    console.log(`   対象テーブル: ${r.tables.join(', ')}`);
    withoutTenant++;
  } else if (r.hasTenantFilter) {
    console.log(`✅ 【テナント分離対応済】: ${r.file}`);
  }
});

console.log(`\n総クエリファイル数: ${results.length} 件`);
console.log(`要確認（未分離）ファイル数: ${withoutTenant} 件`);
