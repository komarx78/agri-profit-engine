import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBoardPosts() {
  const { data, error } = await supabase
    .from('board_posts')
    .select('content, translations')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error(error);
  } else {
    console.dir(data, { depth: null });
  }
}

checkBoardPosts();
