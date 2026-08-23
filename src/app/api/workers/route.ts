import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get('ownerId');

    let query = supabaseAdmin.from('workers').select('*').order('name');

    if (ownerId && ownerId !== 'null' && ownerId !== 'undefined') {
      const { data: specificData } = await supabaseAdmin
        .from('workers')
        .select('*')
        .eq('user_id', ownerId)
        .order('name');
      
      if (specificData && specificData.length > 0) {
        return NextResponse.json({ workers: specificData });
      }
    }

    // フォールバック: 全ワーカー取得
    const { data: allData, error } = await query;
    if (error) throw error;
    
    return NextResponse.json({ workers: allData || [] });
  } catch (error: any) {
    console.error('API Error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to fetch workers', workers: [] }, { status: 500 });
  }
}
