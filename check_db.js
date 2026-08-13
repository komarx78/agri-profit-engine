const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const envs = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envs[match[1].trim()] = match[2].trim();
});

const supabaseUrl = envs.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envs.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('crops').select('id, name, name_en, name_vi');
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

check();
