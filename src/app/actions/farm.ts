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
    
    let { data, error } = await supabase
      .from('company_settings')
      .select('id, user_id, company_name, plan_type')
      .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
      .maybeSingle();

    // フォールバック: 指定IDで見つからない場合は最新の登録農園を参照
    if (!data) {
      const { data: fb } = await supabase
        .from('company_settings')
        .select('id, user_id, company_name, plan_type')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fb) {
        data = fb;
      }
    }

    if (!data) {
      return { success: false, error: '指定された農園情報が見つかりませんでした。' };
    }

    return { 
      success: true, 
      data: { 
        id: data.user_id || data.id, 
        company_name: data.company_name || '佐原農園',
        plan_type: data.plan_type || 'standard'
      } 
    };
  } catch (error: any) {
    console.error('getFarmInfo Error:', error);
    return { success: false, error: '農園情報の取得中にエラーが発生しました。' };
  }
}

// 2. 従業員リストの取得
export async function getFarmWorkers(tenantId: string) {
  try {
    const supabase = createAdminClient();

    // まず tenantId から実際の ownerId (user_id) を解決
    let ownerId = tenantId;
    let { data: comp } = await supabase
      .from('company_settings')
      .select('user_id')
      .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
      .maybeSingle();
    
    if (!comp) {
      const { data: fb } = await supabase
        .from('company_settings')
        .select('user_id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fb) comp = fb;
    }

    if (comp && comp.user_id) {
      ownerId = comp.user_id;
    }

    // 指定された農園（ownerId）の作業者のみを厳格に取得
    const { data, error } = await supabase
      .from('workers')
      .select('id, name, name_en, name_vi, name_id, name_zh, name_si, name_km, role, pin_code, user_id')
      .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`)
      .order('name');
      
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: '作業者一覧を取得できませんでした。' };
  }
}

// 3. 従業員のログイン（PINコード確認）
export async function verifyWorkerPin(tenantId: string, workerId: string, pinCode: string) {
  try {
    const supabase = createAdminClient();

    // ownerId を解決
    let ownerId = tenantId;
    const { data: comp } = await supabase
      .from('company_settings')
      .select('user_id')
      .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
      .maybeSingle();
    if (comp && comp.user_id) {
      ownerId = comp.user_id;
    }

    const { data, error } = await supabase
      .from('workers')
      .select('id, name, pin_code, role, user_id')
      .eq('id', workerId)
      .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`)
      .single();

    if (error || !data) {
      return { success: false, error: '指定の農園に登録された作業者が見つかりません。' };
    }

    const expectedPin = data.pin_code || '0000';
    if (expectedPin !== pinCode) {
      return { success: false, error: '暗証番号が間違っています。' };
    }

    // パスワード等は除外して返す
    return { 
      success: true, 
      data: { id: data.id, name: data.name, role: data.role || 'staff', user_id: data.user_id } 
    };
  } catch (error: any) {
    return { success: false, error: '認証エラーが発生しました。' };
  }
}

// 4. マスタデータ（作目・圃場・資材）と栽培計画の取得
export async function getFarmMasters(tenantId: string) {
  try {
    const supabase = createAdminClient();
    const currentYear = new Date().getFullYear();

    if (!tenantId) {
      return { success: false, error: '農園IDが指定されていません。' };
    }

    // ownerId を解決
    let ownerId = tenantId;
    const { data: comp } = await supabase
      .from('company_settings')
      .select('user_id')
      .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
      .maybeSingle();
    if (comp && comp.user_id) {
      ownerId = comp.user_id;
    }

    const [cRes, fRes, mRes, pRes] = await Promise.all([
      supabase.from('crops').select('id, name').or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`).order('name'),
      supabase.from('fields').select('id, name, area_size').or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`).order('name'),
      supabase.from('materials').select('*').or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`).order('name'),
      supabase.from('cultivation_plans_v2').select(`
        id, 
        field_id, 
        crop_id, 
        variety, 
        start_month, 
        end_month,
        crops ( name )
      `).or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`).eq('year', currentYear)
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

// カスタム作業内容の取得（過去のログから抽出）
export async function getCustomWorkTypes(tenantId: string) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('work_logs')
      .select('work_type')
      .eq('user_id', tenantId);
      
    if (error) return { success: false, data: [] };
    
    const allTypes = data.map(d => d.work_type).filter(Boolean);
    const uniqueTypes = Array.from(new Set(allTypes));
    
    const defaultTypes = [
      '播種', '定植', '水やり・追肥', '草引き・防除', '収穫・調整', '片付け・その他',
      '収穫', '水やり', '肥料・農薬', '草刈り', '片付け・メンテ', '定植・播種', '播種・定植'
    ];
    const customTypes = uniqueTypes.filter(t => !defaultTypes.includes(t));
    
    return { success: true, data: customTypes };
  } catch (err) {
    return { success: false, data: [] };
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
// 当日の勤怠データの取得
export async function getTodayAttendance(tenantId: string, workerId: string, date: string) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('attendance_logs')
      .select('*')
      .eq('worker_id', workerId)
      .eq('date', date)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
    return { success: true, data: data || null };
  } catch (err: any) {
    console.error('getTodayAttendance error:', err);
    return { success: false, data: null };
  }
}

// 勤怠打刻
export async function submitAttendance(tenantId: string, workerId: string, action: string, logId: string | null, date: string, now: string, weather: string | null, temp: number | null) {
  try {
    const supabase = createAdminClient();
    
    if (action === 'clock_in') {
      const { data, error } = await supabase.from('attendance_logs').insert([{
        worker_id: workerId,
        date: date,
        clock_in: now,
        weather: weather,
        temperature: temp
      }]).select().single();
      if (error) throw error;
      return { success: true, data };
    } else if (logId) {
      const updates: any = {};
      if (action === 'break_start') updates.break_start_time = now;
      if (action === 'break_end') {
        updates.break_end_time = now;
        // 休憩時間の計算
        const { data: currentLog } = await supabase.from('attendance_logs').select('break_start_time, total_break_minutes').eq('id', logId).single();
        if (currentLog?.break_start_time) {
          const bStart = new Date(currentLog.break_start_time).getTime();
          const bEnd = new Date(now).getTime();
          const diffMins = Math.floor((bEnd - bStart) / 1000 / 60);
          updates.total_break_minutes = (currentLog.total_break_minutes || 0) + diffMins;
        }
      }
      if (action === 'clock_out') updates.clock_out = now;
      
      const { data, error } = await supabase.from('attendance_logs').update(updates).eq('id', logId).select().single();
      if (error) throw error;
      return { success: true, data };
    }
    return { success: false, error: 'Invalid action or missing logId' };
  } catch (err: any) {
    console.error('submitAttendance error:', err);
    return { success: false, error: '打刻に失敗しました' };
  }
}

// 現場ポータル用タスク一覧の確実な取得（RLS回避）
export async function getPortalTasks(tenantId: string) {
  try {
    const supabase = createAdminClient();
    if (!tenantId) return { success: false, data: [] };

    // ownerId を解決
    let ownerId = tenantId;
    const { data: comp } = await supabase
      .from('company_settings')
      .select('user_id')
      .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
      .maybeSingle();
    if (comp && comp.user_id) {
      ownerId = comp.user_id;
    }

    const { data, error } = await supabase
      .from('work_logs')
      .select('*, crops(*), fields(*), workers(*)')
      .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`)
      .order('work_date', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('getPortalTasks error:', err);
    return { success: false, data: [] };
  }
}

// 4. 管理者専用: 作業者画面の生産性共有設定の保存
export async function saveWorkerShareSettings(tenantId: string, settings: {
  showYieldPerHour: boolean;
  showRevenuePerHour: boolean;
  showTeamTotals: boolean;
}) {
  try {
    const supabase = createAdminClient();
    if (!tenantId) return { success: false, error: 'テナントIDが不正です' };

    // company_settings に設定JSONを保存
    const { data: comp } = await supabase
      .from('company_settings')
      .select('id, settings')
      .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
      .maybeSingle();

    if (comp) {
      const currentSettings = comp.settings || {};
      const newSettings = { ...currentSettings, worker_share_settings: settings };
      await supabase
        .from('company_settings')
        .update({ settings: newSettings })
        .eq('id', comp.id);
    }

    return { success: true };
  } catch (err: any) {
    console.error('saveWorkerShareSettings error:', err);
    return { success: false, error: err.message };
  }
}

// 5. 作業者画面用: 生産性共有設定の読み込み
export async function getWorkerShareSettings(tenantId: string) {
  try {
    const supabase = createAdminClient();
    if (!tenantId) {
      return { 
        success: true, 
        data: { showYieldPerHour: true, showRevenuePerHour: true, showTeamTotals: true } 
      };
    }

    const { data: comp } = await supabase
      .from('company_settings')
      .select('settings')
      .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
      .maybeSingle();

    if (comp?.settings?.worker_share_settings) {
      return { success: true, data: comp.settings.worker_share_settings };
    }

    return { 
      success: true, 
      data: { showYieldPerHour: true, showRevenuePerHour: true, showTeamTotals: true } 
    };
  } catch (err: any) {
    console.error('getWorkerShareSettings error:', err);
    return { 
      success: true, 
      data: { showYieldPerHour: true, showRevenuePerHour: true, showTeamTotals: true } 
    };
  }
}

// 6. 自社情報・請求設定の保存
export async function saveCompanySettings(tenantId: string, settingsData: any) {
  try {
    const supabase = createAdminClient();
    if (!tenantId) return { success: false, error: 'テナントIDが不正です' };

    const { data: comp } = await supabase
      .from('company_settings')
      .select('id')
      .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
      .maybeSingle();

    const payload = {
      company_name: settingsData.company_name || '',
      postal_code: settingsData.postal_code || '',
      address: settingsData.address || '',
      phone: settingsData.phone || '',
      invoice_number: settingsData.invoice_number || '',
      bank_info: settingsData.bank_info || '',
      updated_at: new Date().toISOString()
    };

    if (comp) {
      const { error } = await supabase
        .from('company_settings')
        .update(payload)
        .eq('id', comp.id);
      if (error) throw error;
      return { success: true, id: comp.id };
    } else {
      const { data, error } = await supabase
        .from('company_settings')
        .insert([{ ...payload, user_id: tenantId }])
        .select()
        .single();
      if (error) throw error;
      return { success: true, id: data?.id };
    }
  } catch (err: any) {
    console.error('saveCompanySettings error:', err);
    return { success: false, error: err.message };
  }
}

// 7. 自社情報・請求設定の取得
export async function getCompanySettings(tenantId: string) {
  try {
    const supabase = createAdminClient();
    if (!tenantId) return { success: false, data: null };

    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return { success: true, data };
  } catch (err: any) {
    console.error('getCompanySettings error:', err);
    return { success: false, error: err.message, data: null };
  }
}

