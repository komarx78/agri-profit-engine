const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const { data: posts } = await supabase
    .from('board_posts')
    .select('content, translations')
    .order('created_at', { ascending: false })
    .limit(3);
  console.log('Board Posts:', JSON.stringify(posts, null, 2));
  
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .limit(1);
  console.log('Users:', JSON.stringify(users, null, 2));
}

checkData();
