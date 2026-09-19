import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let ownerId = searchParams.get('ownerId');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabaseKey = anonKey || serviceRoleKey;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase設定が不足しています', workers: [] }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    let resolvedOwnerId = ownerId;
    let farmName = '';

    if (ownerId && ownerId !== 'null' && ownerId !== 'undefined') {
      const cleanOwnerId = ownerId.trim().toLowerCase();
      const noHyphen = cleanOwnerId.replace(/-/g, '');

      // ① farm_code カラムでのピンポイント照合（ハイフン有無両対応）
      try {
        const { data: compByCode } = await supabase
          .from('company_settings')
          .select('id, user_id, company_name')
          .or(`farm_code.ilike.${cleanOwnerId},farm_code.ilike.${noHyphen}`)
          .maybeSingle();
        if (compByCode) {
          resolvedOwnerId = compByCode.user_id;
          farmName = compByCode.company_name;
        }
      } catch (e) {}

      // ② 既知短縮コード（案Aの名前+数字および従来の短縮コード両対応）
      if (!farmName) {
        const SHORT_CODES: Record<string, string> = {
          'sahara-789': '62163024-2c8e-4057-a872-2455dbc58d32',
          'sahara789': '62163024-2c8e-4057-a872-2455dbc58d32',
          'sahara': '62163024-2c8e-4057-a872-2455dbc58d32',
          'kap-101': '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04',
          'kap101': '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04',
          'kap': '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04',
        };
        if (SHORT_CODES[cleanOwnerId] || SHORT_CODES[noHyphen]) {
          resolvedOwnerId = SHORT_CODES[cleanOwnerId] || SHORT_CODES[noHyphen];
        }
      }

      // ③ UUID または ID によるピンポイント照合
      if (!farmName) {
        try {
          const { data: company } = await supabase
            .from('company_settings')
            .select('id, user_id, company_name')
            .or(`user_id.eq.${cleanOwnerId},id.eq.${cleanOwnerId}`)
            .maybeSingle();

          if (company) {
            resolvedOwnerId = company.user_id;
            farmName = company.company_name;
          }
        } catch (e) {}
      }

      // 会社名が未解決で resolvedOwnerId があれば取得
      if (resolvedOwnerId && !farmName) {
        try {
          const { data: comp } = await supabase
            .from('company_settings')
            .select('company_name')
            .eq('user_id', resolvedOwnerId)
            .maybeSingle();
          if (comp?.company_name) farmName = comp.company_name;
        } catch (e) {}
      }
    }

    if (!resolvedOwnerId || resolvedOwnerId === 'null' || resolvedOwnerId === 'undefined') {
      return NextResponse.json({ 
        error: '所属農園が指定されていません。農園コードを入力してください。', 
        workers: []
      }, { status: 400 });
    }

    // 指定された農園のワーカー一覧を取得（現場PIN照合のためpin_codeも含める）
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('user_id', resolvedOwnerId)
      .order('name');
    
    if (error) {
      console.error('Error fetching workers:', error);
      return NextResponse.json({ error: 'ワーカー一覧の取得に失敗しました: ' + (error.message || ''), workers: [] }, { status: 500 });
    }

    return NextResponse.json({ 
      workers: data || [], 
      ownerId: resolvedOwnerId, 
      farmName: farmName || ''
    });
  } catch (error: any) {
    console.error('API Error in /api/workers:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to fetch workers', workers: [] }, { status: 500 });
  }
}
