process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');

const envContent = fs.readFileSync('c:\\Users\\koma\\OneDrive - 株式会社cocotte\\GAS職人\\農業システム\\agri-profit-engine\\.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function inspectTenants() {
  console.log('=== Supabase 実DBのテナント・農園データ調査 ===\n');

  // 1. company_settings
  const resComp = await fetch(`${supabaseUrl}/rest/v1/company_settings?select=*`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  const companies = await resComp.json();
  console.log('1. 登録されている農園（company_settings）:', companies);

  // 2. 各テーブルの user_id / tenant_id の分布
  const tables = ['workers', 'crops', 'fields', 'materials', 'work_logs', 'attendance_logs', 'b2b_orders', 'b2b_customers'];
  for (const t of tables) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${t}?select=id,user_id&limit=20`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const rows = await res.json();
    if (Array.isArray(rows)) {
      const userIds = Array.from(new Set(rows.map(r => r.user_id)));
      console.log(`\nテーブル "${t}": 合計レコード取得数=${rows.length}, 含まれる user_id 一覧:`, userIds);
    } else {
      console.log(`\nテーブル "${t}":`, rows);
    }
  }
}

inspectTenants();
