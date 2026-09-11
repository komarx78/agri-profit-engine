import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getJSTDate, getJSTTime } from '@/lib/dateUtils';

// Supabase client (検証済みのキーを優先使用)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    const forceRun = searchParams.get('force') === 'true';
    const filterTenantId = searchParams.get('tenant_id');

    // Vercel Cron から叩かれる場合: Authorization: Bearer <CRON_SECRET>
    // 手動やURLパラメータから叩かれる場合: ?key=<CRON_SECRET> または force=true
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'my_super_secret_key_123';
    const isCronAuthValid = (key === cronSecret) || 
                            (authHeader === `Bearer ${cronSecret}`) ||
                            forceRun;

    if (!isCronAuthValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const supabase = getSupabase();

    // JSTで今日の日付と時刻を安全に取得
    const todayStr = getJSTDate();
    const currentHourMin = getJSTTime(); // "17:30"

    // 1. 全未退勤ログを取得（当日 ＋ 過去の未退勤打刻漏れ放置）
    let logQuery = supabase
      .from('attendance_logs')
      .select('id, worker_id, user_id, date, clock_in, clock_out')
      .not('clock_in', 'is', null)
      .is('clock_out', null)
      .order('date', { ascending: false });

    if (filterTenantId) {
      logQuery = logQuery.eq('user_id', filterTenantId);
    }

    const { data: allUnclockedLogs, error: logsError } = await logQuery;

    if (logsError) {
      console.error('DB Error (logs):', logsError);
      return NextResponse.json({ error: 'Database error', details: logsError.message }, { status: 500 });
    }

    if (!allUnclockedLogs || allUnclockedLogs.length === 0) {
      return NextResponse.json({ 
        status: 'success', 
        message: '現時点で未退勤のスタッフはおりません（全員退勤済み、または未出勤です）',
        total_unclocked: 0
      }, { status: 200 });
    }

    // 2. 関連するマスターデータを一括取得
    // テナント別の会社設定
    const { data: allCompSettings } = await supabase.from('company_settings').select('*');
    const compSettingsMap = new Map((allCompSettings || []).map((s: any) => [s.user_id, s]));

    // 全ワーカー
    const allWorkerIds = Array.from(new Set(allUnclockedLogs.map(l => l.worker_id)));
    const { data: allWorkers } = await supabase
      .from('workers')
      .select('id, name, user_id, role, line_user_id, is_line_notification_enabled, standard_end_time, attendance_rule_id');
    const workersMap = new Map((allWorkers || []).map((w: any) => [w.id, w]));

    // 全テナントの管理者ワーカー（role = 'admin'）をテナントごとにグループ化
    const tenantAdminWorkersMap: Record<string, any[]> = {};
    (allWorkers || []).forEach((w: any) => {
      if (w.role === 'admin' && w.user_id) {
        if (!tenantAdminWorkersMap[w.user_id]) tenantAdminWorkersMap[w.user_id] = [];
        tenantAdminWorkersMap[w.user_id].push(w);
      }
    });

    // 勤怠ルール
    const { data: rules } = await supabase.from('attendance_rules').select('*');
    const rulesList = rules || [];

    // 今日の承認済み残業申請
    const { data: otData } = await supabase
      .from('overtime_requests')
      .select('worker_id, scheduled_end_time')
      .eq('date', todayStr)
      .eq('status', 'approved')
      .in('worker_id', allWorkerIds);
    const otList = otData || [];

    // 3. ログを「テナント（user_id）」ごとにグループ化（マルチテナント完全分離）
    const tenantLogsMap: Record<string, any[]> = {};
    allUnclockedLogs.forEach(log => {
      const tId = log.user_id;
      if (!tId) return;
      if (!tenantLogsMap[tId]) tenantLogsMap[tId] = [];
      tenantLogsMap[tId].push(log);
    });

    const resultsByTenant: any[] = [];

    // 4. テナントごとに打刻忘れ判定＆農業管理者へ通知！
    for (const [tenantId, logs] of Object.entries(tenantLogsMap)) {
      const compSetting = compSettingsMap.get(tenantId);
      const companyName = compSetting?.company_name || '農園';

      // 該当テナントの農業管理者たち（role=admin）
      const adminWorkers = tenantAdminWorkersMap[tenantId] || [];
      // 管理者のLINE ID一覧
      const adminLineUserIds = adminWorkers
        .map(a => a.line_user_id)
        .filter(Boolean);

      // KAPの場合で管理者LINE IDが未設定時のフォールバック
      if (tenantId === '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04' && !adminLineUserIds.includes('U89851b2fdeef65c8082a921727a56314')) {
        adminLineUserIds.push('U89851b2fdeef65c8082a921727a56314');
      }

      const unclockedStaffList: {
        workerId: string;
        name: string;
        date: string;
        isPastDate: boolean;
        endTime: string;
        targetTime: string;
        offsetMinutes: number;
        isOvertime: boolean;
        lineLinked: boolean;
        lineUserId?: string | null;
      }[] = [];

      for (const log of logs) {
        const worker = workersMap.get(log.worker_id);
        if (!worker) continue;

        const isPastDate = log.date < todayStr;

        // 1. 基本退勤予定時刻を算出（定時退勤予定）
        let baseEndTime = '18:00';
        if (worker.standard_end_time) {
          baseEndTime = worker.standard_end_time.substring(0, 5);
        } else if (worker.attendance_rule_id && rulesList.length > 0) {
          const matchedRule = rulesList.find((r: any) => String(r.id) === String(worker.attendance_rule_id) || r.name === worker.attendance_rule_id);
          if (matchedRule?.end_time) {
            baseEndTime = matchedRule.end_time.substring(0, 5);
          }
        } else if (compSetting?.default_end_time) {
          baseEndTime = compSetting.default_end_time.substring(0, 5);
        }

        // 2. 残業申請があれば残業予定時刻を最優先！（当日の場合）
        let isOvertime = false;
        if (!isPastDate) {
          const ot = otList.find(o => o.worker_id === worker.id);
          if (ot?.scheduled_end_time) {
            baseEndTime = ot.scheduled_end_time.substring(0, 5);
            isOvertime = true;
          }
        }

        // 3. 通知オフセット分数（定時または残業終了の◯分後、デフォルト30分）
        const offsetMinutes = Number(compSetting?.line_notification_offset_minutes) || 30;

        // 4. 通知予定時刻（退勤時刻 + 30分）を正確に計算
        const [hours, minutes] = baseEndTime.split(':').map(Number);
        const targetDateObj = new Date();
        targetDateObj.setHours(hours || 18);
        targetDateObj.setMinutes((minutes || 0) + offsetMinutes);
        const targetHour = String(targetDateObj.getHours()).padStart(2, '0');
        const targetMin = String(targetDateObj.getMinutes()).padStart(2, '0');
        const targetTime = `${targetHour}:${targetMin}`;

        // 判定条件：
        // 1. 過去日の打刻漏れ（昨日以前） ➔ 無条件にアラート対象！
        // 2. 当日の打刻漏れ ➔ forceRun または 現在時刻 >= targetTime（退勤予定時刻＋30分後）の場合にアラート対象！
        const shouldAlert = forceRun || isPastDate || (currentHourMin >= targetTime);

        if (shouldAlert) {
          unclockedStaffList.push({
            workerId: worker.id,
            name: worker.name,
            date: log.date,
            isPastDate,
            endTime: baseEndTime,
            targetTime,
            offsetMinutes,
            isOvertime,
            lineLinked: !!worker.line_user_id,
            lineUserId: worker.line_user_id
          });
        }
      }

      if (unclockedStaffList.length === 0) {
        resultsByTenant.push({
          tenant_id: tenantId,
          company_name: companyName,
          status: 'no_unclocked_or_before_target_time',
          logs_count: logs.length
        });
        continue;
      }

      // この農園専用の現場ポータルURL（他農園への誤遷移を物理遮断）
      const farmPortalUrl = `https://agri-profit-engine.vercel.app/portal/${tenantId}`;

      // A. 未退勤スタッフ本人への個別LINEプッシュ（本人がLINE連携済みの場合）
      const workerPushResults: any[] = [];
      if (channelAccessToken) {
        for (const staff of unclockedStaffList) {
          if (staff.lineUserId) {
            const personalMsg = staff.isPastDate
              ? `お疲れ様です！\n${staff.name} さんの【${staff.date}】の「退勤」がまだ打刻されておりません。\n\n現場ポータルより打刻の修正・確認をお願いいたします！\n${farmPortalUrl}`
              : `お疲れ様です！\n本日（${staff.date}）${staff.name} さんの「退勤」がまだ打刻されていません。\n（${staff.isOvertime ? '残業予定' : '定時退勤'}: ${staff.endTime} / 通知設定: ${staff.offsetMinutes}分後）\n\n本日の作業が終了している場合は、現場ポータルより退勤打刻をお願いいたします！🌱\n${farmPortalUrl}`;

            try {
              const pRes = await fetch('https://api.line.me/v2/bot/message/push', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${channelAccessToken}`
                },
                body: JSON.stringify({
                  to: staff.lineUserId,
                  messages: [{ type: 'text', text: personalMsg }]
                })
              });
              workerPushResults.push({ name: staff.name, status: pRes.status });
            } catch (err: any) {
              console.warn(`Worker push error to ${staff.name}:`, err);
            }
          }
        }
      }

      // B. 🚨【この農園の農業管理者へ一括アラート配信】
      let adminAlertSent = false;
      const todayList = unclockedStaffList.filter(s => !s.isPastDate);
      const pastList = unclockedStaffList.filter(s => s.isPastDate);

      let summaryLines: string[] = [];
      if (todayList.length > 0) {
        summaryLines.push('【本日の未退勤】');
        todayList.forEach(s => {
          summaryLines.push(`・${s.name}（${s.isOvertime ? '残業終了' : '定時'}: ${s.endTime} ➔ ${s.offsetMinutes}分超過 / LINE: ${s.lineLinked ? '連携済' : '未連携'}）`);
        });
      }
      if (pastList.length > 0) {
        summaryLines.push('\n【⚠️ 過去日の未退勤打刻漏れ】');
        pastList.forEach(s => {
          summaryLines.push(`・${s.name}（日付: ${s.date}）`);
        });
      }

      const adminTitle = `【${companyName}】打刻忘れアラート: 未退勤スタッフ ${unclockedStaffList.length}名`;
      const adminBody = `お疲れ様です。農業収益エンジン（勤怠監視）です。\n\n${companyName} において、以下のスタッフ（計 ${unclockedStaffList.length}名）の「退勤打刻」が完了しておりません。\n\n${summaryLines.join('\n')}\n\n現場ポータルまたは管理画面よりご確認の上、退勤打刻の案内または代理打刻をお願いいたします。\n【${companyName}】現場ポータルURL:\n${farmPortalUrl}`;

      // 該当農園の農業管理者LINEへプッシュ送信！
      if (channelAccessToken && adminLineUserIds.length > 0) {
        for (const adminLineId of Array.from(new Set(adminLineUserIds))) {
          try {
            await fetch('https://api.line.me/v2/bot/message/push', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${channelAccessToken}`
              },
              body: JSON.stringify({
                to: adminLineId,
                messages: [{ type: 'text', text: `${adminTitle}\n\n${adminBody}` }]
              })
            });
            adminAlertSent = true;
          } catch (adminErr) {
            console.warn(`Admin LINE alert error for ${companyName}:`, adminErr);
          }
        }
      }

      resultsByTenant.push({
        tenant_id: tenantId,
        company_name: companyName,
        admin_line_notified: adminLineUserIds,
        admin_alert_sent: adminAlertSent,
        unclocked_count: unclockedStaffList.length,
        unclocked_staff: unclockedStaffList.map(s => ({ name: s.name, date: s.date, isPastDate: s.isPastDate })),
        worker_push_results: workerPushResults
      });
    }

    return NextResponse.json({
      status: 'success',
      current_time: currentHourMin,
      total_unclocked_logs: allUnclockedLogs.length,
      tenants_processed: resultsByTenant.length,
      results: resultsByTenant
    }, { status: 200 });

  } catch (error: any) {
    console.error('Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}


