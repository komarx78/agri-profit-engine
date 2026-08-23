import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get('ownerId');

  if (!ownerId) {
    return NextResponse.json({ error: 'ownerId is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('workers')
      .select('*')
      .eq('user_id', ownerId)
      .order('name');

    if (error) throw error;
    
    return NextResponse.json({ workers: data });
  } catch (error: any) {
    console.error('API Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 });
  }
}
