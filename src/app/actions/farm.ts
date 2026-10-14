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
    if (!tenantId || tenantId === 'null' || tenantId === 'undefined') {
      return { success: false, error: '指定された農園IDが無効です。' };
    }

    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('company_settings')
      .select('id, user_id, company_name, plan_type')
      .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      return { success: false, error: '指定された農園情報が見つかりませんでした。' };
    }

    return { 
      success: true, 
      data: { 
        id: data.user_id || data.id, 
        company_name: data.company_name || '',
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
    if (!tenantId || tenantId === 'null' || tenantId === 'undefined') {
      return { success: false, error: '農園IDが指定されていません。', data: [] };
    }

    const supabase = createAdminClient();

    // まず tenantId から実際の ownerId (user_id) を解決
    let ownerId = tenantId;
    const { data: comp } = await supabase
      .from('company_settings')
      .select('user_id')
      .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
      .limit(1)
      .maybeSingle();
    
    if (comp && comp.user_id) {
      ownerId = comp.user_id;
    }

    // 指定された農園（ownerIdまたはtenantId）の作業者のみを厳格に取得
    const { data, error } = await supabase
      .from('workers')
      .select('id, name, name_en, name_vi, name_id, name_zh, name_si, name_km, role, pin_code, user_id')
      .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`)
      .order('name');
      
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: '作業者一覧を取得できませんでした。', data: [] };
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
      .select('id, name, pin_code, role, user_id, line_user_id, is_line_notification_enabled')
      .eq('id', workerId)
      .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`)
      .single();

    if (error || !data) {
      return { success: false, error: '指定の農園に登録された作業者が見つかりません。' };
    }

    const expectedPin = String(data.pin_code || '0000').trim();
    const cleanInputPin = String(pinCode || '').trim();
    if (expectedPin !== cleanInputPin) {
      return { success: false, error: '暗証番号が間違っています。' };
    }

    // パスワード等は除外してプロフィール情報ごと返す
    return { 
      success: true, 
      data: { 
        id: data.id, 
        name: data.name, 
        role: data.role || 'staff', 
        user_id: data.user_id,
        line_user_id: data.line_user_id || null,
        is_line_notification_enabled: !!data.is_line_notification_enabled
      } 
    };
  } catch (error: any) {
    console.error('verifyWorkerPin Error:', error);
    return { success: false, error: '認証エラーが発生しました。通信環境をご確認ください。' };
  }
}

// 従業員のプロフィール（LINE連携状態など）の取得
export async function getWorkerProfile(workerId: string) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('workers')
      .select('id, name, role, user_id, line_user_id, is_line_notification_enabled')
      .eq('id', workerId)
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// 従業員のLINE通知設定の更新
export async function toggleWorkerLineNotification(workerId: string, enabled: boolean) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('workers')
      .update({ is_line_notification_enabled: enabled })
      .eq('id', workerId);
    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
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
    if (!tenantId || tenantId === 'null' || tenantId === 'undefined') {
      return { success: false, error: '農園IDが不正です。' };
    }
    
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
// 当日の勤怠データの取得（未退勤ログのフォールバック付き）
export async function getTodayAttendance(tenantId: string, workerId: string, date: string) {
  try {
    const supabase = createAdminClient();
    const { data: todayLogs } = await supabase.from('attendance_logs')
      .select('*')
      .eq('worker_id', workerId)
      .eq('date', date)
      .order('created_at', { ascending: false })
      .limit(1);

    if (todayLogs && todayLogs.length > 0) {
      return { success: true, data: todayLogs[0] };
    }

    // 当日の打刻がない場合、未退勤ログ（直近の未退勤打刻）を検索
    const { data: unclosed } = await supabase.from('attendance_logs')
      .select('*')
      .eq('worker_id', workerId)
      .is('clock_out', null)
      .order('created_at', { ascending: false })
      .limit(1);

    return { success: true, data: (unclosed && unclosed.length > 0) ? unclosed[0] : null };
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
      let resolvedUserId = tenantId;
      if (!resolvedUserId || resolvedUserId === 'null' || resolvedUserId === 'undefined') {
        const { data: w } = await supabase.from('workers').select('user_id').eq('id', workerId).maybeSingle();
        if (w?.user_id) resolvedUserId = w.user_id;
      }

      // 🛡️ 二重出勤防止ガード（連打や通信ラグによる重複レコード作成を物理遮断）
      const { data: existingToday } = await supabase.from('attendance_logs')
        .select('*')
        .eq('worker_id', workerId)
        .eq('date', date)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingToday && existingToday.length > 0) {
        return { success: true, data: existingToday[0] };
      }

      const { data, error } = await supabase.from('attendance_logs').insert([{
        user_id: resolvedUserId || null,
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
      if (tenantId && tenantId !== 'null' && tenantId !== 'undefined') {
        updates.user_id = tenantId;
      }
      if (action === 'break_start') {
        updates.break_start_time = now;
        updates.break_end_time = null;
      }
      if (action === 'break_end') {
        updates.break_end_time = now;
        // 休憩時間の計算
        const { data: currentLog } = await supabase.from('attendance_logs').select('break_start_time, total_break_minutes').eq('id', logId).eq('worker_id', workerId).single();
        if (currentLog?.break_start_time) {
          const bStart = new Date(currentLog.break_start_time).getTime();
          const bEnd = new Date(now).getTime();
          const diffMins = (!isNaN(bStart) && !isNaN(bEnd) && bEnd > bStart)
            ? Math.floor((bEnd - bStart) / 1000 / 60)
            : 0;
          updates.total_break_minutes = (currentLog.total_break_minutes || 0) + diffMins;
        }
      }
      if (action === 'clock_out') {
        updates.clock_out = now;
        // もし休憩終了を押さずに退勤した場合、休憩も自動精算
        const { data: currentLog } = await supabase.from('attendance_logs').select('break_start_time, break_end_time, total_break_minutes').eq('id', logId).eq('worker_id', workerId).single();
        if (currentLog?.break_start_time && !currentLog.break_end_time) {
          updates.break_end_time = now;
          const bStart = new Date(currentLog.break_start_time).getTime();
          const bEnd = new Date(now).getTime();
          const diffMins = (!isNaN(bStart) && !isNaN(bEnd) && bEnd > bStart)
            ? Math.floor((bEnd - bStart) / 1000 / 60)
            : 0;
          updates.total_break_minutes = (currentLog.total_break_minutes || 0) + diffMins;
        }
      }
      
      const { data, error } = await supabase.from('attendance_logs').update(updates).eq('id', logId).eq('worker_id', workerId).select().single();
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
      .order('work_date', { ascending: true })
      .order('step_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

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

// 8. タスク（予定）の安全な作成・編集保存（RLSバイパス）
export async function savePlannedTask(
  tenantId: string, 
  taskData: {
    work_date: string;
    task_title: string;
    crop_id?: string | null;
    department_id?: string | null;
    memo?: string | null;
    field_assignments: Array<{ 
      field_id: string; 
      worker_ids: string[];
      step_order?: number;
      time_slot?: string;
      field_memo?: string;
      leader_worker_id?: string | null;
      leader_name?: string | null;
    }>;
    translations?: any;
  },
  editingTaskId?: string | null
) {
  try {
    const supabase = createAdminClient();
    if (!tenantId) return { success: false, error: 'テナントIDが不正です' };

    const transPayload = taskData.translations || {};

    if (editingTaskId) {
      // 編集更新
      const assignment = taskData.field_assignments[0] || { field_id: '', worker_ids: [] };
      const workerIds = assignment.worker_ids || [];
      const primaryWorkerId = workerIds.length > 0 ? workerIds[0] : null;

      let combinedMemo = assignment.field_memo 
        ? (taskData.memo ? `${taskData.memo}\n${assignment.field_memo}` : assignment.field_memo)
        : (taskData.memo || null);

      if (assignment.leader_worker_id) {
        const isSelfLeader = primaryWorkerId === assignment.leader_worker_id;
        const leaderTag = isSelfLeader ? '【👑現場責任者】' : (assignment.leader_name ? `【👑現場リーダー: ${assignment.leader_name}】` : '【👑現場リーダーあり】');
        if (!combinedMemo || !combinedMemo.includes('【👑')) {
          combinedMemo = combinedMemo ? `${leaderTag} ${combinedMemo}` : leaderTag;
        }
      }

      const updatePayload: any = {
        work_date: taskData.work_date,
        task_title: taskData.task_title,
        work_type: taskData.task_title,
        crop_id: taskData.crop_id || null,
        field_id: assignment.field_id || null,
        worker_id: primaryWorkerId,
        department_id: taskData.department_id || null,
        memo: combinedMemo,
        step_order: assignment.step_order || 1,
        time_slot: assignment.time_slot || null,
        ...transPayload
      };

      const { error: updateError } = await supabase
        .from('work_logs')
        .update(updatePayload)
        .eq('id', editingTaskId);

      if (updateError) throw updateError;

      // 2人目以降の担当者が追加された場合は追加作成
      if (workerIds.length > 1) {
        const additionalInserts = workerIds.slice(1).map(wId => {
          let workerMemo = combinedMemo;
          if (assignment.leader_worker_id) {
            const isSelf = wId === assignment.leader_worker_id;
            const tag = isSelf ? '【👑現場責任者】' : (assignment.leader_name ? `【👑現場リーダー: ${assignment.leader_name}】` : '【👑現場リーダーあり】');
            workerMemo = combinedMemo ? combinedMemo.replace(/【👑[^】]+】/g, '').trim() : '';
            workerMemo = workerMemo ? `${tag} ${workerMemo}` : tag;
          }
          return {
            user_id: tenantId,
            work_date: taskData.work_date,
            task_title: taskData.task_title,
            work_type: taskData.task_title,
            crop_id: taskData.crop_id || null,
            field_id: assignment.field_id || null,
            worker_id: wId,
            department_id: taskData.department_id || null,
            memo: workerMemo,
            step_order: assignment.step_order || 1,
            time_slot: assignment.time_slot || null,
            status: 'planned',
            duration_minutes: 0,
            approval_status: null,
            ...transPayload
          };
        });

        await supabase.from('work_logs').insert(additionalInserts);
      }

      return { success: true };
    } else {
      // 新規一括作成
      const insertData: any[] = [];
      const assignments = taskData.field_assignments && taskData.field_assignments.length > 0
        ? taskData.field_assignments
        : [{ field_id: '', worker_ids: [] }];

      assignments.forEach((assignment, idx) => {
        const fId = assignment.field_id || null;
        const wIds = assignment.worker_ids || [];
        const stepNum = assignment.step_order || (idx + 1);
        const baseMemo = assignment.field_memo 
          ? (taskData.memo ? `${taskData.memo}\n${assignment.field_memo}` : assignment.field_memo)
          : (taskData.memo || null);

        if (wIds.length > 0) {
          wIds.forEach(wId => {
            let combinedMemo = baseMemo;
            if (assignment.leader_worker_id) {
              const isSelf = wId === assignment.leader_worker_id;
              const leaderTag = isSelf ? '【👑現場責任者】' : (assignment.leader_name ? `【👑現場リーダー: ${assignment.leader_name}】` : '【👑現場リーダーあり】');
              combinedMemo = baseMemo ? `${leaderTag} ${baseMemo}` : leaderTag;
            }
            insertData.push({
              user_id: tenantId,
              work_date: taskData.work_date,
              task_title: taskData.task_title,
              work_type: taskData.task_title,
              crop_id: taskData.crop_id || null,
              field_id: fId,
              worker_id: wId,
              department_id: taskData.department_id || null,
              memo: combinedMemo,
              step_order: stepNum,
              time_slot: assignment.time_slot || null,
              status: 'planned',
              duration_minutes: 0,
              approval_status: null,
              ...transPayload
            });
          });
        } else {
          insertData.push({
            user_id: tenantId,
            work_date: taskData.work_date,
            task_title: taskData.task_title,
            work_type: taskData.task_title,
            crop_id: taskData.crop_id || null,
            field_id: fId,
            worker_id: null,
            department_id: taskData.department_id || null,
            memo: baseMemo,
            step_order: stepNum,
            time_slot: assignment.time_slot || null,
            status: 'planned',
            duration_minutes: 0,
            approval_status: null,
            ...transPayload
          });
        }
      });

      const { error: insertError } = await supabase
        .from('work_logs')
        .insert(insertData);

      if (insertError) throw insertError;
      return { success: true };
    }
  } catch (err: any) {
    console.error('savePlannedTask error:', err);
    return { success: false, error: err.message || 'タスクの保存に失敗しました' };
  }
}

// 9. タスクの削除
export async function deletePlannedTask(taskId: string, tenantId?: string | null) {
  try {
    if (!tenantId || tenantId === 'null' || tenantId === 'undefined') {
      return { success: false, error: 'テナントIDが特定できません' };
    }
    const supabase = createAdminClient();

    let ownerId = tenantId;
    const { data: comp } = await supabase
      .from('company_settings')
      .select('user_id')
      .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
      .limit(1)
      .maybeSingle();
    if (comp?.user_id) {
      ownerId = comp.user_id;
    }

    const { error } = await supabase
      .from('work_logs')
      .delete()
      .eq('id', taskId)
      .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('deletePlannedTask error:', err);
    return { success: false, error: err.message || 'タスクの削除に失敗しました' };
  }
}

// 10. 有給・休暇申請の送信（管理者クライアント・RLS完全バイパス）
export async function submitLeaveRequest(
  tenantId: string,
  workerId: string,
  type: string,
  startDate: string,
  endDate: string,
  reason: string,
  isAutoApprove: boolean = false
) {
  try {
    const supabase = createAdminClient();
    let resolvedUserId = tenantId;
    if (!resolvedUserId || resolvedUserId === 'null' || resolvedUserId === 'undefined') {
      const { data: w } = await supabase.from('workers').select('user_id').eq('id', workerId).maybeSingle();
      if (w?.user_id) resolvedUserId = w.user_id;
    }

    const { data, error } = await supabase.from('leave_requests').insert([{
      user_id: resolvedUserId || null,
      worker_id: workerId,
      type: type,
      start_date: startDate,
      end_date: endDate,
      reason: reason || '私用のため',
      status: isAutoApprove ? '承認' : '申請中'
    }]).select().single();

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    console.error('submitLeaveRequest error:', err);
    return { success: false, error: err.message || '休暇申請の送信に失敗しました' };
  }
}

// 11. 特定作業者の休暇申請履歴の取得
export async function getWorkerLeaveRequests(tenantId: string, workerId: string) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, workers(name, user_id)')
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('getWorkerLeaveRequests error:', err);
    return { success: false, data: [] };
  }
}

// 12. 指定日の予定タスクを丸ごと別の日付へ一括複製（前日コピー等）
export async function copyTasksFromDate(
  tenantId: string,
  sourceDate: string,
  targetDate: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const supabase = createAdminClient();
    if (!tenantId) return { success: false, error: '農園IDが不正です' };
    if (!sourceDate || !targetDate) return { success: false, error: '複製元日と複製先日付を指定してください' };

    // 複製元日の予定タスク（planned）を取得
    const { data: sourceTasks, error: fetchErr } = await supabase
      .from('work_logs')
      .select('*')
      .eq('user_id', tenantId)
      .eq('work_date', sourceDate)
      .eq('status', 'planned');

    if (fetchErr) throw fetchErr;
    if (!sourceTasks || sourceTasks.length === 0) {
      return { success: false, error: `${sourceDate} の予定タスクが見つかりません` };
    }

    // 複製先のレコードを作成
    const newTasks = sourceTasks.map(task => {
      const { id, created_at, updated_at, actual_time, completed_at, ...rest } = task;
      return {
        ...rest,
        user_id: tenantId,
        work_date: targetDate,
        status: 'planned',
        duration_minutes: 0,
        approval_status: null
      };
    });

    const { error: insertErr } = await supabase.from('work_logs').insert(newTasks);
    if (insertErr) throw insertErr;

    return { success: true, count: newTasks.length };
  } catch (err: any) {
    console.error('copyTasksFromDate error:', err);
    return { success: false, error: err.message || 'タスクの複製に失敗しました' };
  }
}

// 13. 特定作業者の予定タスクを他の作業者たちへ一括複製（人起点クローン）
export async function cloneWorkerTasks(
  tenantId: string,
  sourceWorkerId: string,
  targetWorkerIds: string[],
  workDate: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const supabase = createAdminClient();
    if (!tenantId) return { success: false, error: '農園IDが不正です' };
    if (!sourceWorkerId || !targetWorkerIds || targetWorkerIds.length === 0) {
      return { success: false, error: 'コピー元およびコピー先の作業者を指定してください' };
    }

    // コピー元の作業者の予定タスクを取得
    let query = supabase
      .from('work_logs')
      .select('*')
      .eq('user_id', tenantId)
      .eq('work_date', workDate)
      .eq('status', 'planned');

    if (sourceWorkerId === 'unassigned') {
      query = query.is('worker_id', null);
    } else {
      query = query.eq('worker_id', sourceWorkerId);
    }

    const { data: sourceTasks, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    if (!sourceTasks || sourceTasks.length === 0) {
      return { success: false, error: 'コピー元のタスクがありません' };
    }

    const newTasks: any[] = [];
    targetWorkerIds.forEach(targetWId => {
      sourceTasks.forEach(task => {
        const { id, created_at, updated_at, ...rest } = task;
        newTasks.push({
          ...rest,
          user_id: tenantId,
          worker_id: targetWId,
          work_date: workDate,
          status: 'planned',
          duration_minutes: 0,
          approval_status: null
        });
      });
    });

    const { error: insertErr } = await supabase.from('work_logs').insert(newTasks);
    if (insertErr) throw insertErr;

    return { success: true, count: newTasks.length };
  } catch (err: any) {
    console.error('cloneWorkerTasks error:', err);
    return { success: false, error: err.message || '作業者タスクの複製に失敗しました' };
  }
}

// 13. 指定日の予定タスクを一括スライド（移動 / 延期 / コピー）
export async function shiftTasksDate(
  tenantId: string,
  sourceDate: string,
  targetDate: string,
  mode: 'move' | 'copy' = 'move',
  reasonNote?: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    if (!tenantId || !sourceDate || !targetDate) {
      return { success: false, error: '農園ID、移動元日、移動先日は必須です' };
    }

    const supabase = createAdminClient();

    // 移動元の予定タスクを取得
    const { data: sourceTasks, error: fetchErr } = await supabase
      .from('work_logs')
      .select('*')
      .eq('user_id', tenantId)
      .eq('work_date', sourceDate)
      .eq('status', 'planned');

    if (fetchErr) throw fetchErr;

    if (!sourceTasks || sourceTasks.length === 0) {
      return { success: false, error: `${sourceDate} に予定タスクが見つかりません` };
    }

    if (mode === 'move') {
      // 一括移動（UPDATE）
      for (const t of sourceTasks) {
        let updatedMemo = t.memo || '';
        if (reasonNote) {
          updatedMemo = updatedMemo ? `${updatedMemo}\n[${reasonNote}]` : `[${reasonNote}]`;
        }
        await supabase
          .from('work_logs')
          .update({
            work_date: targetDate,
            memo: updatedMemo || null
          })
          .eq('id', t.id)
          .eq('user_id', tenantId);
      }
      return { success: true, count: sourceTasks.length };
    } else {
      // 一括複製（INSERT）
      const newTasks = sourceTasks.map(t => {
        const { id, created_at, updated_at, ...rest } = t;
        let memoWithNote = rest.memo || '';
        if (reasonNote) {
          memoWithNote = memoWithNote ? `${memoWithNote}\n[${reasonNote}]` : `[${reasonNote}]`;
        }
        return {
          ...rest,
          user_id: tenantId,
          work_date: targetDate,
          memo: memoWithNote || null,
          status: 'planned',
          duration_minutes: 0,
          approval_status: null
        };
      });

      const { error: insertErr } = await supabase.from('work_logs').insert(newTasks);
      if (insertErr) throw insertErr;
      return { success: true, count: newTasks.length };
    }
  } catch (err: any) {
    console.error('shiftTasksDate error:', err);
    return { success: false, error: err.message || '予定の一括移動に失敗しました' };
  }
}

// 現場ポータル用：タスクの完了更新・日報化（RLS回避・安全実行）
export async function completePortalTask(
  tenantId: string, 
  taskId: string, 
  options?: { 
    durationMinutes?: number; 
    memo?: string; 
    harvestAmount?: number; 
    workerId?: string;
  }
) {
  try {
    const supabase = createAdminClient();
    if (!taskId) return { success: false, error: 'Task ID is required' };

    const updatePayload: any = {
      status: 'completed',
      approval_status: 'pending'
    };

    if (options?.durationMinutes !== undefined && options.durationMinutes !== null && !isNaN(options.durationMinutes)) {
      updatePayload.duration_minutes = Number(options.durationMinutes);
    }
    let nextMemo = options?.memo !== undefined && options.memo !== null ? String(options.memo).trim() : '';
    if (options?.harvestAmount !== undefined && options.harvestAmount !== null && !isNaN(options.harvestAmount) && Number(options.harvestAmount) > 0) {
      nextMemo = nextMemo
        ? `[収穫量: ${Number(options.harvestAmount)}kg] ${nextMemo}`
        : `[収穫量: ${Number(options.harvestAmount)}kg]`;
    }
    if (nextMemo || (options?.memo !== undefined && options.memo !== null)) {
      updatePayload.memo = nextMemo;
    }
    if (options?.workerId) {
      updatePayload.worker_id = options.workerId;
    }

    let ownerId = tenantId;
    if (tenantId && tenantId !== 'null' && tenantId !== 'undefined') {
      const { data: comp } = await supabase
        .from('company_settings')
        .select('user_id')
        .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
        .limit(1)
        .maybeSingle();
      if (comp?.user_id) {
        ownerId = comp.user_id;
      }
    }

    let updateQuery = supabase
      .from('work_logs')
      .update(updatePayload)
      .eq('id', taskId);
    if (ownerId && ownerId !== 'null' && ownerId !== 'undefined') {
      updateQuery = updateQuery.or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`);
    }

    const { data, error } = await updateQuery
      .select('*, crops(*), fields(*), workers(*)')
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    console.error('completePortalTask error:', err);
    return { success: false, error: err.message || '更新に失敗しました' };
  }
}

// 現場ポータル用：タスクの未完了復帰（予定に戻す）
export async function reopenPortalTask(tenantId: string, taskId: string) {
  try {
    const supabase = createAdminClient();
    if (!taskId) return { success: false, error: 'Task ID is required' };

    let ownerId = tenantId;
    if (tenantId && tenantId !== 'null' && tenantId !== 'undefined') {
      const { data: comp } = await supabase
        .from('company_settings')
        .select('user_id')
        .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
        .limit(1)
        .maybeSingle();
      if (comp?.user_id) {
        ownerId = comp.user_id;
      }
    }

    let updateQuery = supabase
      .from('work_logs')
      .update({
        status: 'planned',
        approval_status: null
      })
      .eq('id', taskId);
    if (ownerId && ownerId !== 'null' && ownerId !== 'undefined') {
      updateQuery = updateQuery.or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`);
    }

    const { data, error } = await updateQuery
      .select('*, crops(*), fields(*), workers(*)')
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    console.error('reopenPortalTask error:', err);
    return { success: false, error: err.message || '更新に失敗しました' };
  }
}

// =====================================================================
// 農園単位（同じ農園のオーナー・家族・PINログインスタッフ全員）で共有し、
// よその農園からは完全に遮断する 育苗・作付けこよみ・作目基準 サーバー窓口
// =====================================================================
async function resolveOwnerId(supabase: any, tenantId: string): Promise<string | null> {
  if (!tenantId || tenantId === 'null' || tenantId === 'undefined') return null;
  const clean = tenantId.trim();
  if (!clean) return null;

  const SHORT_MAP: Record<string, string> = {
    'kap': '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04',
    'kap-101': '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04',
    'sahara': '62163024-2c8e-4057-a872-2455dbc58d32',
    'sahara-789': '62163024-2c8e-4057-a872-2455dbc58d32',
  };
  if (SHORT_MAP[clean.toLowerCase()]) {
    return SHORT_MAP[clean.toLowerCase()];
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
  if (!isUuid) {
    try {
      const { data: compByCode } = await supabase
        .from('company_settings')
        .select('user_id')
        .ilike('farm_code', clean)
        .limit(1)
        .maybeSingle();
      if (compByCode?.user_id) return compByCode.user_id;
    } catch {}
    return null;
  }

  let ownerId = clean;
  try {
    const { data: comp } = await supabase
      .from('company_settings')
      .select('user_id')
      .or(`user_id.eq.${clean},id.eq.${clean}`)
      .limit(1)
      .maybeSingle();
    if (comp?.user_id) ownerId = comp.user_id;
  } catch {}
  return ownerId;
}

// 1) 育苗スケジュール画面の一括取得（同じ農園の作付け・基準・育苗記録）
export async function getNurseryPageData(tenantId: string, year: number) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const { data: plansData, error: plansErr } = await supabase
      .from('cultivation_plans_v2')
      .select('*, fields(*), crops(name)')
      .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`)
      .eq('year', year);
    if (plansErr) throw plansErr;
    const plans = plansData || [];

    const { data: cropsData } = await supabase
      .from('crops')
      .select('id')
      .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`);
    const cropIds = Array.from(new Set([...(cropsData || []).map((c: any) => c.id), ...plans.map((p: any) => p.crop_id)].filter(Boolean)));

    let standards: any[] = [];
    if (cropIds.length > 0) {
      const { data: stdData } = await supabase.from('crop_standards').select('*').in('crop_id', cropIds);
      standards = stdData || [];
    }

    let schedules: any[] = [];
    if (plans.length > 0) {
      const { data: schData, error: schErr } = await supabase
        .from('nursery_schedules_v2')
        .select('*')
        .in('plan_id', plans.map((p: any) => p.id));
      if (schErr) throw schErr;
      schedules = schData || [];
    }

    return { success: true, plans, standards, schedules, ownerId };
  } catch (err: any) {
    console.error('getNurseryPageData error:', err);
    return { success: false, error: err.message || '育苗データの取得に失敗しました。' };
  }
}

// 2) 育苗スケジュールの記録・設定の保存（同じ農園のplan_idか検証してから保存）
export async function saveNurseryScheduleAction(
  tenantId: string,
  params: { scheduleId?: string | null; planId: string; scheduleData: any; sownQuantity: number }
) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    // 対象の作付けがこの農園のものか厳格に検証
    const { data: planRow } = await supabase
      .from('cultivation_plans_v2')
      .select('id, user_id')
      .eq('id', params.planId)
      .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`)
      .maybeSingle();
    if (!planRow) {
      return { success: false, error: 'この農園の作付けデータが見つかりません。' };
    }

    if (params.scheduleId) {
      const { data, error } = await supabase
        .from('nursery_schedules_v2')
        .update({ schedule_data: params.scheduleData, sown_quantity: params.sownQuantity })
        .eq('id', params.scheduleId)
        .eq('plan_id', params.planId)
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    } else {
      const { data, error } = await supabase
        .from('nursery_schedules_v2')
        .insert({
          user_id: planRow.user_id || ownerId,
          plan_id: params.planId,
          schedule_data: params.scheduleData,
          sown_quantity: params.sownQuantity
        })
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    }
  } catch (err: any) {
    console.error('saveNurseryScheduleAction error:', err);
    return { success: false, error: err.message || '育苗記録の保存に失敗しました。' };
  }
}

// 3) 自社農園の作目基準（crop_standards）の取得・保存
export async function getTenantCropStandardsAction(tenantId: string) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, data: [] };

    const { data: cropsData } = await supabase
      .from('crops')
      .select('id')
      .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`);
    const cropIds = (cropsData || []).map((c: any) => c.id).filter(Boolean);
    if (cropIds.length === 0) return { success: true, data: [] };

    const { data, error } = await supabase.from('crop_standards').select('*').in('crop_id', cropIds);
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('getTenantCropStandardsAction error:', err);
    return { success: false, data: [], error: err.message };
  }
}

export async function saveTenantCropStandardAction(tenantId: string, cropId: string, payload: Record<string, any>) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    // 対象の作目がこの農園のものか検証
    const { data: cropRow } = await supabase
      .from('crops')
      .select('id')
      .eq('id', cropId)
      .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`)
      .maybeSingle();
    if (!cropRow) return { success: false, error: 'この農園の作目ではありません。' };

    const { data: existing } = await supabase
      .from('crop_standards')
      .select('id')
      .eq('crop_id', cropId)
      .is('variety', null)
      .maybeSingle();

    const runSave = (dataObj: Record<string, any>) =>
      existing
        ? supabase.from('crop_standards').update(dataObj).eq('id', existing.id)
        : supabase.from('crop_standards').insert([{ crop_id: cropId, variety: null, ...dataObj }]);

    let { error } = await runSave(payload);
    let seasonalColumnsMissing = false;
    let nurseryColumnsMissing = false;

    if (error) {
      const msg = `${error.message || ''} ${(error as any).details || ''}`;
      if (/nursery_days_(spring|summer|autumn|winter)/i.test(msg)) {
        const withoutSeasonal = { ...payload };
        delete withoutSeasonal.nursery_days_spring;
        delete withoutSeasonal.nursery_days_summer;
        delete withoutSeasonal.nursery_days_autumn;
        delete withoutSeasonal.nursery_days_winter;
        const retry1 = await runSave(withoutSeasonal);
        if (!retry1.error) {
          seasonalColumnsMissing = true;
          error = null;
        } else {
          error = retry1.error;
        }
      }
      if (error && /column|schema cache|nursery_days|germination|tray_cells|seeds_per_cell|potting_days/i.test(`${error.message || ''} ${(error as any).details || ''}`)) {
        const baseOnly: Record<string, any> = {};
        if ('seedlings_per_10a' in payload) baseOnly.seedlings_per_10a = payload.seedlings_per_10a;
        if ('materials_per_10a' in payload) baseOnly.materials_per_10a = payload.materials_per_10a;
        const retry2 = await runSave(baseOnly);
        if (!retry2.error) {
          nurseryColumnsMissing = true;
          error = null;
        } else {
          error = retry2.error;
        }
      }
    }
    if (error) throw error;
    return { success: true, seasonalColumnsMissing, nurseryColumnsMissing };
  } catch (err: any) {
    console.error('saveTenantCropStandardAction error:', err);
    return { success: false, error: err.message || '作目基準の保存に失敗しました。' };
  }
}

// 4) 自社農園の作付けこよみ（cultivation_plans_v2）の取得・保存・削除
export async function getTenantCultivationPlansAction(tenantId: string, year?: number) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, data: [] };

    let q = supabase
      .from('cultivation_plans_v2')
      .select('*, fields(*), crops(*)')
      .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`);
    if (year !== undefined) {
      q = q.eq('year', year);
    } else {
      q = q.order('created_at', { ascending: false });
    }
    const { data, error } = await q;
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('getTenantCultivationPlansAction error:', err);
    return { success: false, data: [], error: err.message };
  }
}

export async function saveTenantCultivationPlanAction(tenantId: string, planId: string | null, payload: Record<string, any>) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    if (planId) {
      const { data, error } = await supabase
        .from('cultivation_plans_v2')
        .update(payload)
        .eq('id', planId)
        .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`)
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    } else {
      const { data, error } = await supabase
        .from('cultivation_plans_v2')
        .insert([{ ...payload, user_id: ownerId }])
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    }
  } catch (err: any) {
    console.error('saveTenantCultivationPlanAction error:', err);
    return { success: false, error: err.message || '作付け計画の保存に失敗しました。' };
  }
}

export async function deleteTenantCultivationPlanAction(tenantId: string, planId: string) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const { error } = await supabase
      .from('cultivation_plans_v2')
      .delete()
      .eq('id', planId)
      .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('deleteTenantCultivationPlanAction error:', err);
    return { success: false, error: err.message || '作付け計画の削除に失敗しました。' };
  }
}

// 5) 肥料・資材の必要量（買い物・発注リスト）画面用の農園一括データ取得・在庫/単価保存・新規資材追加
export async function getMaterialRequirementsPageData(tenantId: string) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const [mRes, cRes, fRes, pRes, compRes] = await Promise.all([
      supabase.from('materials').select('*').or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`).order('name'),
      supabase.from('crops').select('*').or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`).order('name'),
      supabase.from('fields').select('*').or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`).order('name'),
      supabase.from('cultivation_plans_v2').select('*, fields(*), crops(*)').or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`),
      supabase.from('company_settings').select('id, settings').or(`user_id.eq.${ownerId},id.eq.${ownerId},user_id.eq.${tenantId},id.eq.${tenantId}`).maybeSingle()
    ]);

    const crops = cRes.data || [];
    const cropIds = crops.map((c: any) => c.id).filter(Boolean);
    let cropStandards: any[] = [];
    if (cropIds.length > 0) {
      const { data: csData } = await supabase.from('crop_standards').select('*').in('crop_id', cropIds);
      cropStandards = csData || [];
    }

    const inventoryMap = compRes.data?.settings?.material_inventory || {};
    const planMaterialMap = compRes.data?.settings?.plan_material_overrides || {};

    return {
      success: true,
      materials: mRes.data || [],
      crops,
      fields: fRes.data || [],
      plans: pRes.data || [],
      cropStandards,
      inventoryMap,
      planMaterialMap
    };
  } catch (err: any) {
    console.error('getMaterialRequirementsPageData error:', err);
    return { success: false, error: err.message || 'データの取得に失敗しました。' };
  }
}

// 畑（作付け計画）ごとの個別資材リスト（10aあたり使用量）を保存・解除するサーバーアクション
export async function savePlanMaterialOverrideAction(
  tenantId: string,
  planId: string,
  materialsList: Array<{ material_id: string; amount: number }> | null
) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const { data: comp } = await supabase
      .from('company_settings')
      .select('id, settings')
      .or(`user_id.eq.${ownerId},id.eq.${ownerId},user_id.eq.${tenantId},id.eq.${tenantId}`)
      .maybeSingle();

    if (comp) {
      const currentSettings = comp.settings || {};
      const currentOverrides = { ...(currentSettings.plan_material_overrides || {}) };
      if (materialsList === null) {
        delete currentOverrides[planId];
      } else {
        currentOverrides[planId] = materialsList;
      }
      const nextSettings = {
        ...currentSettings,
        plan_material_overrides: currentOverrides
      };
      const { error } = await supabase
        .from('company_settings')
        .update({ settings: nextSettings })
        .eq('id', comp.id);
      if (error) throw error;
    }

    return { success: true };
  } catch (err: any) {
    console.error('savePlanMaterialOverrideAction error:', err);
    return { success: false, error: err.message || '畑ごとの個別資材設定の保存に失敗しました。' };
  }
}

export async function saveMaterialInventoryAction(
  tenantId: string,
  materialId: string,
  patch: { stock?: number; ordered?: boolean; unitPrice?: number; unit?: string }
) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    if (patch.unitPrice !== undefined || patch.unit !== undefined) {
      const matUpdate: Record<string, any> = {};
      if (patch.unitPrice !== undefined) matUpdate.default_price = Number(patch.unitPrice) || 0;
      if (patch.unit !== undefined) matUpdate.unit = patch.unit;
      await supabase
        .from('materials')
        .update(matUpdate)
        .eq('id', materialId)
        .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`);
    }

    if (patch.stock !== undefined || patch.ordered !== undefined) {
      const { data: comp } = await supabase
        .from('company_settings')
        .select('id, settings')
        .or(`user_id.eq.${ownerId},id.eq.${ownerId},user_id.eq.${tenantId},id.eq.${tenantId}`)
        .maybeSingle();

      if (comp) {
        const currentSettings = comp.settings || {};
        const currentInv = currentSettings.material_inventory || {};
        const prevEntry = currentInv[materialId] || {};
        const nextEntry = {
          ...prevEntry,
          ...(patch.stock !== undefined ? { stock: Math.max(0, Number(patch.stock) || 0) } : {}),
          ...(patch.ordered !== undefined ? { ordered: Boolean(patch.ordered) } : {}),
          updatedAt: new Date().toISOString()
        };
        const nextSettings = {
          ...currentSettings,
          material_inventory: {
            ...currentInv,
            [materialId]: nextEntry
          }
        };
        await supabase.from('company_settings').update({ settings: nextSettings }).eq('id', comp.id);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('saveMaterialInventoryAction error:', err);
    return { success: false, error: err.message || '在庫・単価の保存に失敗しました。' };
  }
}

export async function quickCreateMaterialAction(
  tenantId: string,
  payload: { name: string; category: string; material_type: string; unit: string; default_price: number; specification?: string }
) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const { data, error } = await supabase
      .from('materials')
      .insert([
        {
          user_id: ownerId,
          name: payload.name.trim(),
          category: payload.category || '資材・種苗等',
          material_type: payload.material_type || 'material',
          unit: payload.unit || '袋',
          default_price: Number(payload.default_price) || 0,
          specification: payload.specification || ''
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    console.error('quickCreateMaterialAction error:', err);
    return { success: false, error: err.message || '資材の登録に失敗しました。' };
  }
}

// ==========================================
// 6) 👥 スタッフ・出退勤・給料・有給管理（統合HR画面用サーバーアクション群）
// ==========================================
export async function getHrManagementDataAction(tenantId: string, targetMonth?: string, targetDate?: string) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const nowJst = new Date(Date.now() + 9 * 3600 * 1000);
    const todayStr = targetDate || nowJst.toISOString().substring(0, 10);
    const monthStr = targetMonth || todayStr.substring(0, 7);

    // 対象月の前後を含む広めの範囲（締め日ズレ対応のため前月1日〜翌月10日）を取得
    const [y, m] = monthStr.split('-').map(Number);
    const rangeStart = new Date(Date.UTC(y, m - 2, 1)).toISOString().substring(0, 10);
    const rangeEnd = new Date(Date.UTC(y, m, 10)).toISOString().substring(0, 10);

    const [workersRes, deptsRes, compRes, attRes, workRes] = await Promise.all([
      supabase.from('workers').select('*').or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`).order('name'),
      supabase.from('departments').select('*').or(`tenant_id.eq.${ownerId},tenant_id.eq.${tenantId}`).order('name'),
      supabase.from('company_settings').select('*').or(`user_id.eq.${ownerId},id.eq.${ownerId},user_id.eq.${tenantId},id.eq.${tenantId}`).limit(1).maybeSingle(),
      supabase.from('attendance_logs').select('*').or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`).gte('date', rangeStart).lte('date', rangeEnd).order('date', { ascending: false }).order('clock_in', { ascending: false }),
      supabase.from('work_logs').select('id, worker_id, work_date, work_type, task_title, duration_minutes, harvest_amount, status, crops(name), fields(name)').or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`).gte('work_date', rangeStart).lte('work_date', rangeEnd)
    ]);

    const workersList = workersRes.data || [];
    const workerIds = workersList.map((w: any) => w.id).filter(Boolean);

    // 指定日（targetDate）がrange外の場合も確実に取得
    let attendanceLogs = attRes.data || [];
    let workLogs = workRes.data || [];
    if (todayStr < rangeStart || todayStr > rangeEnd) {
      const [dayAtt, dayWork] = await Promise.all([
        supabase.from('attendance_logs').select('*').or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`).eq('date', todayStr),
        supabase.from('work_logs').select('id, worker_id, work_date, work_type, task_title, duration_minutes, harvest_amount, status, crops(name), fields(name)').or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`).eq('work_date', todayStr)
      ]);
      if (dayAtt.data) attendanceLogs = [...dayAtt.data, ...attendanceLogs];
      if (dayWork.data) workLogs = [...dayWork.data, ...workLogs];
    }

    // 有給・休暇申請と残業申請を取得
    let leaveRequests: any[] = [];
    let overtimeRequests: any[] = [];
    if (workerIds.length > 0) {
      const [leaveRes, overRes] = await Promise.all([
        supabase.from('leave_requests').select('*').in('worker_id', workerIds).order('created_at', { ascending: false }).limit(100),
        supabase.from('overtime_requests').select('*').in('worker_id', workerIds).order('created_at', { ascending: false }).limit(100)
      ]);
      leaveRequests = leaveRes.data || [];
      overtimeRequests = overRes.data || [];
    }

    const hrProfiles = compRes.data?.settings?.worker_hr_profiles || {};
    const enrichedWorkers = workersList.map((w: any) => {
      const prof = hrProfiles[w.id] || {};
      return {
        ...w,
        hourly_wage: Number(w.hourly_wage ?? prof.hourly_wage ?? 1000),
        employment_type: w.employment_type || w.type || prof.employment_type || 'パート・アルバイト',
        phone: w.phone || prof.phone || '',
        paid_leave_balance: Number(w.paid_leave_balance ?? prof.paid_leave_balance ?? 10),
        paid_leave_carryover: Number(w.paid_leave_carryover ?? prof.paid_leave_carryover ?? 0),
        notes: prof.notes || ''
      };
    });

    return {
      success: true,
      ownerId,
      companyName: compRes.data?.company_name || '当農園',
      closingDay: Number(compRes.data?.attendance_closing_day || 0),
      paymentDayRule: compRes.data?.payment_day_rule || '翌月25日払い',
      workers: enrichedWorkers,
      departments: deptsRes.data || [],
      attendanceLogs,
      workLogs,
      leaveRequests,
      overtimeRequests
    };
  } catch (err: any) {
    console.error('getHrManagementDataAction error:', err);
    return { success: false, error: err.message || '勤怠・スタッフ情報の取得に失敗しました。' };
  }
}

// 出退勤記録の手動追加・修正（退勤押し忘れ修正・休憩時間修正・新規打刻追加）
export async function saveAttendanceRecordAction(
  tenantId: string,
  payload: {
    id?: string;
    worker_id: string;
    date: string;
    clock_in_time: string;   // "08:00" 形式
    clock_out_time?: string; // "17:00" 形式（空欄なら勤務中）
    total_break_minutes: number;
  }
) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };
    if (!payload.worker_id || !payload.date || !payload.clock_in_time) {
      return { success: false, error: 'スタッフ・日付・出勤時刻は必須です。' };
    }

    const clockInIso = `${payload.date}T${payload.clock_in_time.slice(0, 5)}:00+09:00`;
    const clockOutIso = payload.clock_out_time && payload.clock_out_time.trim()
      ? `${payload.date}T${payload.clock_out_time.slice(0, 5)}:00+09:00`
      : null;

    if (payload.id) {
      const { error } = await supabase
        .from('attendance_logs')
        .update({
          worker_id: payload.worker_id,
          date: payload.date,
          clock_in: clockInIso,
          clock_out: clockOutIso,
          total_break_minutes: Math.max(0, Number(payload.total_break_minutes) || 0)
        })
        .eq('id', payload.id);
      if (error) throw error;
    } else {
      // 同日・同スタッフの既存レコードがあれば上書き、なければ新規追加
      const { data: existing } = await supabase
        .from('attendance_logs')
        .select('id')
        .eq('worker_id', payload.worker_id)
        .eq('date', payload.date)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('attendance_logs')
          .update({
            clock_in: clockInIso,
            clock_out: clockOutIso,
            total_break_minutes: Math.max(0, Number(payload.total_break_minutes) || 0)
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('attendance_logs')
          .insert([{
            user_id: ownerId,
            worker_id: payload.worker_id,
            date: payload.date,
            clock_in: clockInIso,
            clock_out: clockOutIso,
            total_break_minutes: Math.max(0, Number(payload.total_break_minutes) || 0)
          }]);
        if (error) throw error;
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('saveAttendanceRecordAction error:', err);
    return { success: false, error: err.message || '出退勤データの保存に失敗しました。' };
  }
}

export async function deleteAttendanceRecordAction(tenantId: string, attendanceId: string) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const { error } = await supabase
      .from('attendance_logs')
      .delete()
      .eq('id', attendanceId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('deleteAttendanceRecordAction error:', err);
    return { success: false, error: err.message || '出退勤データの削除に失敗しました。' };
  }
}

// 有給・休暇申請の承認 / 却下
export async function updateLeaveRequestStatusAction(
  tenantId: string,
  requestId: string,
  newStatus: '承認' | '却下'
) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const { error } = await supabase
      .from('leave_requests')
      .update({ status: newStatus })
      .eq('id', requestId);
    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error('updateLeaveRequestStatusAction error:', err);
    return { success: false, error: err.message || '休暇申請のステータス更新に失敗しました。' };
  }
}

// 残業申請の承認 / 却下
export async function updateOvertimeRequestStatusAction(
  tenantId: string,
  requestId: string,
  newStatus: 'approved' | 'rejected'
) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const { error } = await supabase
      .from('overtime_requests')
      .update({ status: newStatus })
      .eq('id', requestId);
    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error('updateOvertimeRequestStatusAction error:', err);
    return { success: false, error: err.message || '残業申請のステータス更新に失敗しました。' };
  }
}

// スタッフの登録・編集（時給・PIN・雇用形態・有給残日数・メモ）
export async function saveWorkerFromHrAction(
  tenantId: string,
  payload: {
    id?: string;
    name: string;
    hourly_wage: number;
    pin_code: string;
    role: string;
    department_id?: string;
    employment_type?: string;
    phone?: string;
    paid_leave_balance?: number;
    paid_leave_carryover?: number;
    notes?: string;
  }
) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };
    if (!payload.name || !payload.name.trim()) {
      return { success: false, error: 'スタッフ名を入力してください。' };
    }

    const coreData: Record<string, any> = {
      user_id: ownerId,
      name: payload.name.trim(),
      hourly_wage: Number(payload.hourly_wage) || 1000,
      pin_code: String(payload.pin_code || '0000').replace(/[^0-9]/g, '').padStart(4, '0').slice(0, 4),
      role: payload.role || 'worker'
    };
    if (payload.department_id) coreData.department_id = payload.department_id;

    let workerId = payload.id;
    if (workerId) {
      const { error } = await supabase
        .from('workers')
        .update(coreData)
        .eq('id', workerId);
      if (error) {
        const { department_id, ...minimalData } = coreData;
        const { error: retryErr } = await supabase.from('workers').update(minimalData).eq('id', workerId);
        if (retryErr) throw retryErr;
      }
    } else {
      const { data, error } = await supabase
        .from('workers')
        .insert([coreData])
        .select('id')
        .single();
      if (error) {
        const { department_id, ...minimalData } = coreData;
        const { data: retryData, error: retryErr } = await supabase.from('workers').insert([minimalData]).select('id').single();
        if (retryErr) throw retryErr;
        workerId = retryData?.id;
      } else {
        workerId = data?.id;
      }
    }

    // 有給残日数カラムが存在する環境ではworkersテーブル側も更新を試行
    if (workerId && (payload.paid_leave_balance !== undefined || payload.paid_leave_carryover !== undefined)) {
      await supabase
        .from('workers')
        .update({
          paid_leave_balance: Number(payload.paid_leave_balance ?? 10),
          paid_leave_carryover: Number(payload.paid_leave_carryover ?? 0)
        })
        .eq('id', workerId);
    }

    // 拡張プロフィール（雇用区分・電話番号・有給残日数・メモ）を company_settings.settings.worker_hr_profiles に確実に保存
    if (workerId) {
      const { data: comp } = await supabase
        .from('company_settings')
        .select('id, settings')
        .or(`user_id.eq.${ownerId},id.eq.${ownerId},user_id.eq.${tenantId},id.eq.${tenantId}`)
        .limit(1)
        .maybeSingle();

      if (comp) {
        const currentSettings = comp.settings || {};
        const currentProfiles = currentSettings.worker_hr_profiles || {};
        currentProfiles[workerId] = {
          ...(currentProfiles[workerId] || {}),
          hourly_wage: Number(payload.hourly_wage) || 1000,
          employment_type: payload.employment_type || 'パート・アルバイト',
          phone: payload.phone || '',
          paid_leave_balance: Number(payload.paid_leave_balance ?? 10),
          paid_leave_carryover: Number(payload.paid_leave_carryover ?? 0),
          notes: payload.notes || '',
          updatedAt: new Date().toISOString()
        };
        await supabase
          .from('company_settings')
          .update({
            settings: {
              ...currentSettings,
              worker_hr_profiles: currentProfiles
            }
          })
          .eq('id', comp.id);
      }
    }

    return { success: true, workerId };
  } catch (err: any) {
    console.error('saveWorkerFromHrAction error:', err);
    return { success: false, error: err.message || 'スタッフ情報の保存に失敗しました。' };
  }
}

export async function deleteWorkerFromHrAction(tenantId: string, workerId: string) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const { error } = await supabase
      .from('workers')
      .delete()
      .eq('id', workerId)
      .or(`user_id.eq.${ownerId},user_id.eq.${tenantId}`);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('deleteWorkerFromHrAction error:', err);
    return { success: false, error: err.message || 'スタッフの削除に失敗しました。' };
  }
}

// =====================================================================
// 携帯版（PINログイン・農園コード指定時）でも100%確実に作付け一覧＆予実データを読み込む一括取得Server Action
// =====================================================================
export async function getCultivationsHubDataAction(tenantId: string) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const isTenantUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((tenantId || '').trim());
    const userFilter = isTenantUuid && tenantId !== ownerId
      ? `user_id.eq.${ownerId},user_id.eq.${tenantId}`
      : `user_id.eq.${ownerId}`;
    const compFilter = isTenantUuid && tenantId !== ownerId
      ? `user_id.eq.${ownerId},id.eq.${ownerId},user_id.eq.${tenantId},id.eq.${tenantId}`
      : `user_id.eq.${ownerId},id.eq.${ownerId}`;

    const [fRes, cRes, pRes, compRes, logsRes, matRes, fertMatRes] = await Promise.all([
      supabase.from('fields').select('*').or(userFilter).order('name'),
      supabase.from('crops').select('*').or(userFilter).order('name'),
      supabase.from('cultivation_plans_v2').select('*, fields(*), crops(*)').or(userFilter).order('start_month', { ascending: true }),
      supabase.from('company_settings').select('company_name').or(compFilter).limit(1).maybeSingle(),
      supabase.from('work_logs').select('*, crops(name), fields(name), workers(name)').or(userFilter).order('work_date', { ascending: false }).limit(500),
      supabase.from('materials').select('*').or(userFilter).or('category.eq.農薬費,material_type.eq.pesticide').order('name'),
      supabase.from('materials').select('*').or(userFilter).or('category.eq.肥料費,material_type.eq.fertilizer').order('name')
    ]);

    const fields = fRes.data || [];
    const crops = cRes.data || [];
    const plans = pRes.data || [];

    const cropIds = Array.from(new Set([...crops.map((c: any) => c.id), ...plans.map((p: any) => p.crop_id)].filter(Boolean)));
    let cropStandards: any[] = [];
    if (cropIds.length > 0) {
      const { data: stdData } = await supabase
        .from('crop_standards')
        .select('*')
        .in('crop_id', cropIds)
        .order('days_after_start', { ascending: true });
      cropStandards = stdData || [];
    }

    return {
      success: true,
      ownerId,
      fields,
      crops,
      plans,
      companyName: compRes?.data?.company_name || '',
      cropStandards,
      workLogs: logsRes.data || [],
      pesticideMaterials: matRes.data || [],
      fertilizerMaterials: fertMatRes.data || []
    };
  } catch (err: any) {
    console.error('getCultivationsHubDataAction error:', err);
    return { success: false, error: err.message || '作付け一覧データの取得に失敗しました。' };
  }
}

export async function getCultivationSchedulePageDataAction(tenantId: string, year: number) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const isTenantUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((tenantId || '').trim());
    const userFilter = isTenantUuid && tenantId !== ownerId
      ? `user_id.eq.${ownerId},user_id.eq.${tenantId}`
      : `user_id.eq.${ownerId}`;

    const rangeStart = `${year - 1}-01-01`;
    const rangeEnd = `${year + 1}-12-31`;

    const [fRes, cRes, pRes, wRes, sRes, mcRes, expRes] = await Promise.all([
      supabase.from('fields').select('*').or(userFilter).order('name'),
      supabase.from('crops').select('*').or(userFilter).order('name'),
      supabase.from('cultivation_plans_v2').select('*, fields(*), crops(*)').or(userFilter).eq('year', year).order('start_month', { ascending: true }),
      supabase
        .from('work_logs')
        .select('*, workers(name, hourly_wage), materials(name, default_price, category, unit)')
        .or(userFilter)
        .gte('work_date', rangeStart)
        .lte('work_date', rangeEnd),
      supabase.from('sales_logs').select('*').or(userFilter).gte('sales_date', rangeStart).lte('sales_date', rangeEnd),
      supabase.from('material_costs').select('*').or(userFilter).gte('expense_date', rangeStart).lte('expense_date', rangeEnd),
      supabase.from('monthly_expenses').select('*').or(userFilter)
    ]);

    return {
      success: true,
      ownerId,
      fields: fRes.data || [],
      crops: cRes.data || [],
      plans: pRes.data || [],
      workLogs: wRes.data || [],
      salesLogs: sRes.data || [],
      materialCosts: mcRes.error ? [] : mcRes.data || [],
      monthlyExpenses: expRes.error ? [] : expRes.data || []
    };
  } catch (err: any) {
    console.error('getCultivationSchedulePageDataAction error:', err);
    return { success: false, error: err.message || '栽培計画・予実データの取得に失敗しました。' };
  }
}

// =====================================================================
// 管理画面全般（ダッシュボード・作業指示・承認・作目分析・マスタ・圃場地図・経理）の
// スマホ / PINログイン完全対応 Server Actions（RLS安全バイパス＆テナント厳格拘束）
// =====================================================================

function buildTenantUserFilter(ownerId: string, tenantId: string) {
  const isTenantUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((tenantId || '').trim());
  return isTenantUuid && tenantId !== ownerId
    ? `user_id.eq.${ownerId},user_id.eq.${tenantId}`
    : `user_id.eq.${ownerId}`;
}

export async function getAdminDashboardDataAction(tenantId: string) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };
    const userFilter = buildTenantUserFilter(ownerId, tenantId);

    const [workRes, salesRes, b2bRes] = await Promise.all([
      supabase
        .from('work_logs')
        .select(`
          work_date,
          duration_minutes,
          material_quantity,
          status,
          approval_status,
          crops(name),
          workers(name, hourly_wage),
          materials(name, default_price),
          fields(name)
        `)
        .or(userFilter),
      supabase
        .from('sales_logs')
        .select(`
          sales_date,
          total_sales,
          status,
          crops(name),
          sales_channels(name)
        `)
        .or(userFilter),
      supabase
        .from('b2b_orders')
        .select(`
          id,
          delivery_date,
          total_amount,
          status,
          items:b2b_order_items(crop_name, quantity, unit_price, amount)
        `)
        .or(userFilter)
    ]);

    return {
      success: true,
      ownerId,
      workLogs: workRes.data || [],
      salesLogs: salesRes.data || [],
      b2bOrders: b2bRes.error ? [] : b2bRes.data || []
    };
  } catch (err: any) {
    console.error('getAdminDashboardDataAction error:', err);
    return { success: false, error: err.message || 'ダッシュボードデータの取得に失敗しました。' };
  }
}

export async function getAdminTasksPageDataAction(tenantId: string) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };
    const userFilter = buildTenantUserFilter(ownerId, tenantId);
    const isTenantUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((tenantId || '').trim());
    const deptFilter = isTenantUuid && tenantId !== ownerId
      ? `tenant_id.eq.${ownerId},tenant_id.eq.${tenantId}`
      : `tenant_id.eq.${ownerId}`;

    const [tasksRes, cropsRes, fieldsRes, workersRes, deptsRes] = await Promise.all([
      supabase
        .from('work_logs')
        .select('id, work_date, task_title, task_title_en, task_title_vi, task_title_id, task_title_zh, status, approval_status, duration_minutes, crop_id, field_id, worker_id, department_id, memo, step_order, time_slot, crops(name), fields(name), workers(name), departments(name)')
        .or(userFilter)
        .eq('status', 'planned')
        .order('work_date', { ascending: true })
        .order('step_order', { ascending: true, nullsFirst: false }),
      supabase.from('crops').select('*').or(userFilter).order('name'),
      supabase.from('fields').select('*').or(userFilter).order('name'),
      supabase.from('workers').select('*').or(userFilter).order('name'),
      supabase.from('departments').select('*').or(deptFilter).order('name')
    ]);

    return {
      success: true,
      ownerId,
      tasks: tasksRes.data || [],
      crops: cropsRes.data || [],
      fields: fieldsRes.data || [],
      workers: workersRes.data || [],
      departments: deptsRes.data || []
    };
  } catch (err: any) {
    console.error('getAdminTasksPageDataAction error:', err);
    return { success: false, error: err.message || 'タスクデータの取得に失敗しました。' };
  }
}

export async function getAdminApprovalsDataAction(tenantId: string) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };
    const userFilter = buildTenantUserFilter(ownerId, tenantId);

    const [logsRes, fieldsRes, cropsRes, workersRes] = await Promise.all([
      supabase
        .from('work_logs')
        .select(`
          *,
          fields(id, name, area_size),
          crops(id, name),
          workers(id, name, hourly_wage),
          departments(id, name),
          materials(id, name, unit, default_price, category)
        `)
        .or(userFilter)
        .eq('status', 'completed')
        .order('work_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(300),
      supabase.from('fields').select('id, name, area_size').or(userFilter).order('name'),
      supabase.from('crops').select('id, name').or(userFilter).order('name'),
      supabase.from('workers').select('id, name, hourly_wage').or(userFilter).order('name')
    ]);

    return {
      success: true,
      ownerId,
      logs: logsRes.data || [],
      fields: fieldsRes.data || [],
      crops: cropsRes.data || [],
      workers: workersRes.data || []
    };
  } catch (err: any) {
    console.error('getAdminApprovalsDataAction error:', err);
    return { success: false, error: err.message || '承認一覧データの取得に失敗しました。' };
  }
}

export async function updateWorkLogApprovalAction(
  tenantId: string,
  ids: string[],
  payload: Record<string, any>
) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };
    const userFilter = buildTenantUserFilter(ownerId, tenantId);

    const { error } = await supabase
      .from('work_logs')
      .update(payload)
      .in('id', ids)
      .or(userFilter);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('updateWorkLogApprovalAction error:', err);
    return { success: false, error: err.message || '承認状態の更新に失敗しました。' };
  }
}

export async function getAdminCropAnalysisDataAction(tenantId: string, year: number) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };
    const userFilter = buildTenantUserFilter(ownerId, tenantId);

    const [cRes, wRes, sRes, b2bRes] = await Promise.all([
      supabase.from('crops').select('*').or(userFilter).order('name'),
      supabase
        .from('work_logs')
        .select('*, workers(name, hourly_wage), materials(default_price)')
        .or(userFilter)
        .gte('work_date', `${year}-01-01`)
        .lte('work_date', `${year}-12-31`),
      supabase
        .from('sales_logs')
        .select('*')
        .or(userFilter)
        .gte('sales_date', `${year}-01-01`)
        .lte('sales_date', `${year}-12-31`),
      supabase
        .from('b2b_orders')
        .select('id, delivery_date, status, total_amount, items:b2b_order_items(crop_name, quantity, unit_price, amount)')
        .or(userFilter)
        .gte('delivery_date', `${year}-01-01`)
        .lte('delivery_date', `${year}-12-31`)
    ]);

    return {
      success: true,
      ownerId,
      crops: cRes.data || [],
      workLogs: wRes.data || [],
      salesLogs: sRes.data || [],
      b2bOrders: b2bRes.error ? [] : b2bRes.data || []
    };
  } catch (err: any) {
    console.error('getAdminCropAnalysisDataAction error:', err);
    return { success: false, error: err.message || '作目別データの取得に失敗しました。' };
  }
}

export async function getAdminMapDataAction(tenantId: string) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };
    const userFilter = buildTenantUserFilter(ownerId, tenantId);

    const [fRes, pRes] = await Promise.all([
      supabase
        .from('fields')
        .select('id, name, area_size, polygon_coordinates, color')
        .or(userFilter)
        .order('name'),
      supabase
        .from('cultivation_plans_v2')
        .select('id, field_id, crop_id, year, start_month, end_month, status, crops(name)')
        .or(userFilter)
        .order('year', { ascending: false })
        .order('start_month', { ascending: false })
    ]);

    return {
      success: true,
      ownerId,
      fields: fRes.data || [],
      plans: pRes.error ? [] : pRes.data || []
    };
  } catch (err: any) {
    console.error('getAdminMapDataAction error:', err);
    return { success: false, error: err.message || '地図用圃場データの取得に失敗しました。' };
  }
}

export async function getAdminMastersDataAction(tenantId: string) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };
    const userFilter = buildTenantUserFilter(ownerId, tenantId);
    const isTenantUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((tenantId || '').trim());
    const deptFilter = isTenantUuid && tenantId !== ownerId
      ? `tenant_id.eq.${ownerId},tenant_id.eq.${tenantId}`
      : `tenant_id.eq.${ownerId}`;

    const [cRes, fRes, wRes, mRes, spRes, csRes, chRes, dRes] = await Promise.all([
      supabase.from('crops').select('*').or(userFilter).order('name'),
      supabase.from('fields').select('*').or(userFilter).order('name'),
      supabase.from('workers').select('*').or(userFilter).order('name'),
      supabase.from('materials').select('*').or(userFilter).order('name'),
      supabase.from('sales_prices').select('*').or(userFilter).order('crop_name'),
      supabase.from('crop_standards').select('*').or(userFilter),
      supabase.from('sales_channels').select('*').or(userFilter).order('name'),
      supabase.from('departments').select('*').or(deptFilter).order('name')
    ]);

    return {
      success: true,
      ownerId,
      crops: cRes.data || [],
      fields: fRes.data || [],
      workers: wRes.data || [],
      materials: mRes.data || [],
      salesPrices: spRes.data || [],
      cropStandards: csRes.data || [],
      channels: chRes.data || [],
      departments: dRes.data || []
    };
  } catch (err: any) {
    console.error('getAdminMastersDataAction error:', err);
    return { success: false, error: err.message || 'マスタデータの取得に失敗しました。' };
  }
}

export async function saveMasterRecordAction(
  tenantId: string,
  table: string,
  dataToSave: Record<string, any>,
  editingId?: string | null
) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const payload = { ...dataToSave };
    if (table === 'departments') {
      payload.tenant_id = ownerId;
      delete payload.user_id;
    } else {
      payload.user_id = ownerId;
    }

    const stripMultilang = (obj: Record<string, any>) => {
      const copy = { ...obj };
      delete copy.name_en;
      delete copy.name_vi;
      delete copy.name_id;
      delete copy.name_zh;
      delete copy.name_si;
      delete copy.name_km;
      return copy;
    };

    if (editingId) {
      const { data, error } = await supabase.from(table).update(payload).eq('id', editingId).select();
      if (error) {
        const fallback = stripMultilang(payload);
        const { data: retryData, error: retryErr } = await supabase.from(table).update(fallback).eq('id', editingId).select();
        if (retryErr) throw retryErr;
        return { success: true, data: retryData };
      }
      return { success: true, data };
    } else {
      const { id, created_at, ...insertPayload } = payload;
      const { data, error } = await supabase.from(table).insert([insertPayload]).select();
      if (error) {
        const fallback = stripMultilang(insertPayload);
        const { data: retryData, error: retryErr } = await supabase.from(table).insert([fallback]).select();
        if (retryErr) throw retryErr;
        return { success: true, data: retryData };
      }
      return { success: true, data };
    }
  } catch (err: any) {
    console.error('saveMasterRecordAction error:', err);
    return { success: false, error: err.message || 'マスタの保存に失敗しました。' };
  }
}

export async function deleteMasterRecordAction(
  tenantId: string,
  table: string,
  id: string
) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('deleteMasterRecordAction error:', err);
    return { success: false, error: err.message || '削除に失敗しました。' };
  }
}

export async function getAccountingPurchasesDataAction(tenantId: string) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };
    const userFilter = buildTenantUserFilter(ownerId, tenantId);

    const [mRes, pRes] = await Promise.all([
      supabase.from('materials').select('*').or(userFilter).order('name'),
      supabase.from('material_purchases').select('*, materials(name, unit)').or(userFilter).order('purchase_date', { ascending: false })
    ]);

    return {
      success: true,
      ownerId,
      materials: mRes.data || [],
      purchases: pRes.error ? [] : pRes.data || []
    };
  } catch (err: any) {
    console.error('getAccountingPurchasesDataAction error:', err);
    return { success: false, error: err.message || '資材購入データの取得に失敗しました。' };
  }
}

export async function saveMaterialPurchaseAction(tenantId: string, payload: Record<string, any>) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const { error } = await supabase.from('material_purchases').insert([{
      user_id: ownerId,
      purchase_date: payload.purchase_date,
      material_id: payload.material_id || null,
      supplier: payload.supplier || '',
      unit_price: Number(payload.unit_price) || 0,
      quantity: Number(payload.quantity) || 1,
      total_price: Number(payload.total_price) || 0,
      notes: payload.notes || '',
      receipt_image_url: payload.receipt_image_url || ''
    }]);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('saveMaterialPurchaseAction error:', err);
    return { success: false, error: err.message || '購入データの保存に失敗しました。' };
  }
}

export async function deleteMaterialPurchaseAction(tenantId: string, id: string) {
  try {
    const supabase = createAdminClient();
    const ownerId = await resolveOwnerId(supabase, tenantId);
    if (!ownerId) return { success: false, error: '農園IDが確認できませんでした。' };

    const { error } = await supabase.from('material_purchases').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('deleteMaterialPurchaseAction error:', err);
    return { success: false, error: err.message || '購入データの削除に失敗しました。' };
  }
}





