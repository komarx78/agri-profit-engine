import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get('ownerId');

    if (!ownerId || ownerId === 'null' || ownerId === 'undefined') {
      return NextResponse.json({ error: '農園IDが指定されていません', workers: [] }, { status: 400 });
    }

    // 指定された農園（user_id）のワーカーのみを厳格に取得
    const { data, error } = await supabaseAdmin
      .from('workers')
      .select('id, name, name_en, name_vi, name_id, name_zh, name_si, name_km, role, pin_code, user_id')
      .eq('user_id', ownerId)
      .order('name');
    
    if (error) throw error;
    
    return NextResponse.json({ workers: data || [] });
  } catch (error: any) {
    console.error('API Error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to fetch workers', workers: [] }, { status: 500 });
  }
}
