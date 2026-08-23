const { createClient } = require('@supabase/supabase-js');

const url = "https://xqneyssirhwedoemfzph.supabase.co";
const key = "sb_secret_5agNKIDijdNTl3nyMU6LYQ_0RhInbnw";
const supabase = createClient(url, key);

async function run() {
  const { data: crops, error: cErr } = await supabase.from('crops').select('*');
  console.log("Crops:", crops?.length, crops?.map(c => c.name));

  const { data: fields, error: fErr } = await supabase.from('fields').select('*');
  console.log("Fields:", fields?.length, fields?.map(f => f.name));

  const { data: plans, error: pErr } = await supabase.from('cultivation_plans_v2').select('*');
  console.log("Plans:", plans?.length);

  const { data: workLogs, error: wErr } = await supabase.from('work_logs').select('*');
  console.log("WorkLogs:", workLogs?.length);

  const { data: salesLogs, error: sErr } = await supabase.from('sales_logs').select('*');
  console.log("SalesLogs:", salesLogs?.length);
}

run();
