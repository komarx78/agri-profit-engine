import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId || tenantId === 'null' || tenantId === 'undefined') {
      return NextResponse.json({ error: '農園IDが無効です' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. 農園設定と作業者一覧を完全並列（Promise.all）で超高速取得
    const [compRes, workersRes] = await Promise.all([
      supabase
        .from('company_settings')
        .select('id, user_id, company_name, plan_type')
        .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('workers')
        .select('id, name, name_en, name_vi, name_id, name_zh, name_si, name_km, role, user_id')
        .or(`user_id.eq.${tenantId}`)
        .order('name')
    ]);

    let ownerId = tenantId;
    let companyName = '農業システムポータル';
    let planType = 'standard';

    if (compRes.data) {
      ownerId = compRes.data.user_id || compRes.data.id || tenantId;
      companyName = compRes.data.company_name || '農業システムポータル';
      planType = compRes.data.plan_type || 'standard';
    }

    // もし ownerId が tenantId と異なる場合、再度ワーカーを取得
    let workers = workersRes.data || [];
    if (ownerId !== tenantId && workers.length === 0) {
      const { data: moreWorkers } = await supabase
        .from('workers')
        .select('id, name, name_en, name_vi, name_id, name_zh, name_si, name_km, role, user_id')
        .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`)
        .order('name');
      if (moreWorkers) workers = moreWorkers;
    }

    return NextResponse.json({
      success: true,
      farmInfo: {
        id: ownerId,
        company_name: companyName,
        plan_type: planType
      },
      workers: workers
    });
  } catch (error: any) {
    console.error('API Error in /api/farm-init:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '初期化に失敗しました',
      farmInfo: { id: '', company_name: '農業システムポータル', plan_type: 'standard' },
      workers: []
    }, { status: 500 });
  }
}
