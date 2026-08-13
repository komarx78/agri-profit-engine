const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    env[key.trim()] = values.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
});
process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_table_schema', { table_name: 'workers' }); // rpcがないかもしれない
  
  // もしrpcがなければ適当に1件insertしてエラーメッセージを見る
  const { error: err } = await supabase.from('workers').insert({
    name: 'test',
    hourly_wage: 1000,
    pin_code: '0000'
  });
  console.log('Insert Error:', err);
}

check();
