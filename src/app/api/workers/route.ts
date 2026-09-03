import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let ownerId = searchParams.get('ownerId');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase設定が不足しています', workers: [] }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    // SaaSマルチテナント完全分離：ownerIdが未指定の場合は他農園のデータを絶対に返さない
    if (!ownerId || ownerId === 'null' || ownerId === 'undefined') {
      return NextResponse.json({ 
        error: '農園IDが指定されていません。管理者から共有された専用URLまたはQRコードからアクセスしてください。', 
        workers: [] 
      }, { status: 400 });
    }

    // 指定された農園のワーカー一覧を取得（現場PIN照合のためpin_codeも含める）
    const { data, error } = await supabase
      .from('workers')
      .select('id, name, name_en, name_vi, name_id, name_zh, name_si, name_km, role, type, employment_type, pin_code, user_id, department_id, created_at')
      .eq('user_id', ownerId)
      .order('name');
    
    if (error) throw error;
    
    return NextResponse.json({ workers: data || [], ownerId });
  } catch (error: any) {
    console.error('API Error in /api/workers:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to fetch workers', workers: [] }, { status: 500 });
  }
}
