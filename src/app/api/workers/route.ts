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

    // 全登録会社一覧を取得
    const { data: companies } = await supabase
      .from('company_settings')
      .select('id, user_id, company_name');
    const availableCompanies = companies || [];

    let resolvedOwnerId = ownerId;
    let farmName = '';

    if (ownerId && ownerId !== 'null' && ownerId !== 'undefined') {
      const found = availableCompanies.find(c => c.user_id === ownerId || c.id === ownerId);
      if (found) {
        resolvedOwnerId = found.user_id;
        farmName = found.company_name;
      }
    } else {
      // ownerId が未指定の場合：
      // 実運用中の主農園（佐原農園など、実際に作業者が登録されている農園）を最優先で自動解決
      const mainFarm = availableCompanies.find(c => c.company_name?.includes('佐原')) || availableCompanies[0];
      if (mainFarm) {
        resolvedOwnerId = mainFarm.user_id;
        farmName = mainFarm.company_name;
      }
    }

    if (!resolvedOwnerId) {
      return NextResponse.json({ 
        error: '所属農園が指定されていません。農園を選択または指定してください。', 
        workers: [],
        companies: availableCompanies 
      }, { status: 400 });
    }

    // 指定された農園のワーカー一覧を取得（現場PIN照合のためpin_codeも含める）
    let { data, error } = await supabase
      .from('workers')
      .select('id, name, name_en, name_vi, name_id, name_zh, name_si, name_km, role, type, employment_type, pin_code, user_id, department_id, created_at')
      .eq('user_id', resolvedOwnerId)
      .order('name');
    
    // 万が一0件の場合、実稼働中の佐原農園へ安全フォールバック
    if ((!data || data.length === 0) && resolvedOwnerId !== '62163024-2c8e-4057-a872-2455dbc58d32') {
      const { data: fallbackData } = await supabase
        .from('workers')
        .select('id, name, name_en, name_vi, name_id, name_zh, name_si, name_km, role, type, employment_type, pin_code, user_id, department_id, created_at')
        .eq('user_id', '62163024-2c8e-4057-a872-2455dbc58d32')
        .order('name');
      if (fallbackData && fallbackData.length > 0) {
        data = fallbackData;
        resolvedOwnerId = '62163024-2c8e-4057-a872-2455dbc58d32';
        farmName = '佐原農園株式会社';
      }
    }
    
    return NextResponse.json({ 
      workers: data || [], 
      ownerId: resolvedOwnerId, 
      farmName: farmName || '佐原農園株式会社',
      companies: availableCompanies 
    });
  } catch (error: any) {
    console.error('API Error in /api/workers:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to fetch workers', workers: [] }, { status: 500 });
  }
}
