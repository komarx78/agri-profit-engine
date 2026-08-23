const { createClient } = require('@supabase/supabase-js');

const url = "https://xqneyssirhwedoemfzph.supabase.co";
const key = "sb_secret_5agNKIDijdNTl3nyMU6LYQ_0RhInbnw";
const supabase = createClient(url, key);

async function inspectColumns() {
  const tables = [
    'crops', 'fields', 'workers', 'sales_channels', 
    'cultivation_plans_v2', 'work_logs', 'sales_logs', 
    'material_costs', 'material_purchases', 'monthly_expenses',
    'b2b_orders', 'b2b_customers'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`[${table}] Error:`, error.message);
    } else {
      const keys = data && data[0] ? Object.keys(data[0]) : [];
      const hasUserId = keys.includes('user_id') || keys.includes('tenant_id');
      console.log(`[${table}] hasUserId: ${hasUserId} | Columns: ${keys.join(', ')}`);
    }
  }
}

inspectColumns();
