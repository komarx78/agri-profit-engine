'use server';

import { createAdminClient } from '@/lib/supabase-admin';

export type TenantInfo = {
  id: string;
  company_name: string;
  plan_type: string;
};

// 1. 農園情報の取得
export async function getFarmInfo(tenantId: string): Promise<{ success: boolean; data?: TenantInfo; error?: string }> {
  try {
    const supabase = createAdminClient();
    
    // UUIDの形式チェック (簡易的)
    if (!tenantId || tenantId.length !== 36) {
      return { success: false, error: '無効な農園URLです。' };
    }

    const { data, error } = await supabase
      .from('company_settings')
      .select('user_id, company_name, plan_type')
      .eq('user_id', tenantId)
      .single();

    if (error || !data) {
      return { success: false, error: '農園情報が見つかりませんでした。URLを確認してください。' };
    }

    return { 
      success: true, 
      data: { 
        id: data.user_id, 
        company_name: data.company_name || '名称未設定の農園',
        plan_type: data.plan_type || 'standard'
      } 
    };
  } catch (error: any) {
    console.error('getFarmInfo Error:', error);
    return { success: false, error: 'システムエラーが発生しました。' };
  }
}

// 2. 従業員リストの取得
export async function getFarmWorkers(tenantId: string) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('workers')
      .select('id, name')
      .eq('user_id', tenantId)
      .order('name');
      
    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: '作業者一覧を取得できませんでした。' };
  }
}

// 3. 従業員のログイン（PINコード確認）
export async function verifyWorkerPin(tenantId: string, workerId: string, pinCode: string) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('workers')
      .select('id, name, pin_code, role')
      .eq('id', workerId)
      .eq('user_id', tenantId)
      .single();

    if (error || !data) {
      return { success: false, error: '作業者が見つかりません。' };
    }

    if (data.pin_code !== pinCode) {
      return { success: false, error: '暗証番号が間違っています。' };
    }

    // パスワード等は除外して返す
    return { 
      success: true, 
      data: { id: data.id, name: data.name, role: data.role || 'staff' } 
    };
  } catch (error: any) {
    return { success: false, error: '認証エラーが発生しました。' };
  }
}

// 4. マスタデータ（作目・圃場・資材）と栽培計画の取得
export async function getFarmMasters(tenantId: string) {
  try {
    const supabase = createAdminClient();
    
    // 現在の年度を取得（8月始まりの事業年度と仮定、簡易的に現在の年を使用）
    const currentYear = new Date().getFullYear();

    const [cRes, fRes, mRes, pRes] = await Promise.all([
      supabase.from('crops').select('id, name').eq('user_id', tenantId).order('name'),
      supabase.from('fields').select('id, name, area_size').eq('user_id', tenantId).order('name'),
      supabase.from('materials').select('*').eq('user_id', tenantId).order('name'),
      supabase.from('cultivation_plans_v2').select(`
        id, 
        field_id, 
        crop_id, 
        variety, 
        start_month, 
        end_month,
        crops ( name )
      `).eq('year', currentYear)
    ]);

    return {
      success: true,
      data: {
        crops: cRes.data || [],
        fields: fRes.data || [],
        materials: mRes.data || [],
        plans: pRes.data || []
      }
    };
  } catch (error: any) {
    return { success: false, error: 'マスタデータの取得に失敗しました。' };
  }
}

// 5. 作業記録の保存
export async function submitWorkLog(tenantId: string, workerId: string, logData: any) {
  try {
    const supabase = createAdminClient();
    
    // 強制的に tenant_id と worker_id をセットして保存
    const insertData = {
      ...logData,
      user_id: tenantId,
      worker_id: workerId
    };

    const { error } = await supabase.from('work_logs').insert([insertData]);
    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('submitWorkLog error:', error);
    return { success: false, error: '作業記録の保存に失敗しました。' };
  }
}
// 出荷記録マスタの取得
export async function getSalesMasters(tenantId: string) {
  try {
    const supabase = createAdminClient();
    const [cRes, chRes, spRes] = await Promise.all([
      supabase.from('crops').select('*').eq('user_id', tenantId),
      supabase.from('sales_channels').select('*').eq('user_id', tenantId),
      supabase.from('sales_prices').select('*').eq('user_id', tenantId)
    ]);
    return { success: true, crops: cRes.data || [], channels: chRes.data || [], salesPrices: spRes.data || [] };
  } catch (error: any) {
    console.error('getSalesMasters error:', error);
    return { success: false, crops: [], channels: [], salesPrices: [] };
  }
}

// 出荷記録の保存
export async function submitSalesLog(tenantId: string, logData: any) {
  try {
    const supabase = createAdminClient();
    const insertData = {
      ...logData,
      user_id: tenantId
    };
    const { error } = await supabase.from('sales_logs').insert([insertData]);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('submitSalesLog error:', error);
    return { success: false, error: '出荷記録の保存に失敗しました。' };
  }
}
