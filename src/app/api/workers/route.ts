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

    // SaaSマルチテナント保護：ownerIdが未指定の場合のフォールバック
    let availableCompanies: any[] = [];
    if (!ownerId || ownerId === 'null' || ownerId === 'undefined') {
      const { data: companies } = await supabase.from('company_settings').select('user_id, company_name');
      availableCompanies = companies || [];

      // 佐原農園（本番メイン農園）が存在すれば優先解決、なければ先頭農園を採用
      const saharId = '62163024-2c8e-4057-a872-2455dbc58d32';
      const saharaCompany = availableCompanies.find(c => c.user_id === saharId);
      if (saharaCompany) {
        ownerId = saharId;
      } else if (availableCompanies.length > 0 && availableCompanies[0].user_id) {
        ownerId = availableCompanies[0].user_id;
      } else {
        return NextResponse.json({ 
          error: '所属農園が登録されていません。管理者画面から初期設定を行ってください。', 
          workers: [],
          companies: []
        }, { status: 400 });
      }
    }

    // 指定された農園のワーカー一覧を取得（現場PIN照合のためpin_codeも含める）
    const { data, error } = await supabase
      .from('workers')
      .select('id, name, name_en, name_vi, name_id, name_zh, name_si, name_km, role, type, employment_type, pin_code, user_id, department_id, created_at')
      .eq('user_id', ownerId)
      .order('name');
    
    if (error) throw error;
    
    return NextResponse.json({ workers: data || [], ownerId, companies: availableCompanies });
  } catch (error: any) {
    console.error('API Error in /api/workers:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to fetch workers', workers: [] }, { status: 500 });
  }
}
