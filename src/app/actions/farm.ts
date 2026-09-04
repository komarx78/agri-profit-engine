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
    const { data, error } = await supabase.from('attendance_logs')
      .select('*')
      .eq('worker_id', workerId)
      .eq('date', date)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return { success: true, data };
    }

    // 当日の打刻がない場合、未退勤ログ（直近の未退勤打刻）を検索
    const { data: unclosed } = await supabase.from('attendance_logs')
      .select('*')
      .eq('worker_id', workerId)
      .is('clock_out', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return { success: true, data: unclosed || null };
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
        const { data: currentLog } = await supabase.from('attendance_logs').select('break_start_time, total_break_minutes').eq('id', logId).single();
        if (currentLog?.break_start_time) {
          const bStart = new Date(currentLog.break_start_time).getTime();
          const bEnd = new Date(now).getTime();
          const diffMins = Math.max(0, Math.floor((bEnd - bStart) / 1000 / 60));
          updates.total_break_minutes = (currentLog.total_break_minutes || 0) + diffMins;
        }
      }
      if (action === 'clock_out') {
        updates.clock_out = now;
        // もし休憩終了を押さずに退勤した場合、休憩も自動精算
        const { data: currentLog } = await supabase.from('attendance_logs').select('break_start_time, break_end_time, total_break_minutes').eq('id', logId).single();
        if (currentLog?.break_start_time && !currentLog.break_end_time) {
          updates.break_end_time = now;
          const bStart = new Date(currentLog.break_start_time).getTime();
          const bEnd = new Date(now).getTime();
          const diffMins = Math.max(0, Math.floor((bEnd - bStart) / 1000 / 60));
          updates.total_break_minutes = (currentLog.total_break_minutes || 0) + diffMins;
        }
      }
      
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

      const combinedMemo = assignment.field_memo 
        ? (taskData.memo ? `${taskData.memo}\n${assignment.field_memo}` : assignment.field_memo)
        : (taskData.memo || null);

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
        const additionalInserts = workerIds.slice(1).map(wId => ({
          user_id: tenantId,
          work_date: taskData.work_date,
          task_title: taskData.task_title,
          work_type: taskData.task_title,
          crop_id: taskData.crop_id || null,
          field_id: assignment.field_id || null,
          worker_id: wId,
          department_id: taskData.department_id || null,
          memo: combinedMemo,
          step_order: assignment.step_order || 1,
          time_slot: assignment.time_slot || null,
          status: 'planned',
          duration_minutes: 0,
          approval_status: null,
          ...transPayload
        }));

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
        const combinedMemo = assignment.field_memo 
          ? (taskData.memo ? `${taskData.memo}\n${assignment.field_memo}` : assignment.field_memo)
          : (taskData.memo || null);

        if (wIds.length > 0) {
          wIds.forEach(wId => {
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
            memo: combinedMemo,
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
export async function deletePlannedTask(taskId: string) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('work_logs').delete().eq('id', taskId);
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

