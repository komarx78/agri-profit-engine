const key = "sb_publishable_HMNRsXUrpQBURJLEm0kfxA_kArWjOCU";
const baseUrl = "https://xqneyssirhwedoemfzph.supabase.co/rest/v1";

async function check(table) {
  try {
    const res = await fetch(`${baseUrl}/${table}?select=*&limit=10`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const data = await res.json();
    console.log(`=== ${table} (Count: ${data?.length || 0}) ===`);
    console.log(JSON.stringify(data?.slice(0, 3), null, 2));
  } catch (e) {
    console.log(`Error checking ${table}:`, e.message);
  }
}

async function run() {
  await check('crops');
  await check('fields');
  await check('workers');
  await check('cultivation_plans_v2');
  await check('work_logs');
  await check('sales_logs');
}

run();
