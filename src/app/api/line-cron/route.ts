import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getJSTDate, getJSTTime } from '@/lib/dateUtils';

// Next.js キャッシュによる古いデータ参照を100%防止
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const forceFamic = searchParams.get('force_famic') === 'true';
    const filterTenantId = searchParams.get('tenant_id');

    // Vercel Cron から叩かれる場合: Authorization: Bearer <CRON_SECRET>
    // 手動やURLパラメータから叩かれる場合: ?key=<CRON_SECRET> または force=true
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'my_super_secret_key_123';
    const isCronAuthValid = (key === cronSecret) || 
                            (authHeader === `Bearer ${cronSecret}`) ||
                            forceRun || forceFamic;

    if (!isCronAuthValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // JSTで今日の日付と時刻を安全に取得
    const todayStr = getJSTDate();
    const currentHourMin = getJSTTime(); // "17:30"

    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const supabase = getSupabase();

    // 🌾【月初限定：農薬マスター更新リマインド通知（FAMIC公式データ公開案内）】
    // 毎月1日〜3日の朝9:00以降（または force_famic=true）に、メール＆LINEで管理者に通知
    const famicAlertResult = await processFamicMonthlyAlert(
      supabase,
      todayStr,
      currentHourMin,
      channelAccessToken,
      forceFamic
    );

    // 🚨【夜間帯（21:30〜翌朝06:30）の勤怠通知停止】
    // 手動強制実行 (forceRun) でない限り、深夜・夜間の管理者へのLINE連打を物理遮断
    const isNightTime = currentHourMin >= '21:30' || currentHourMin < '06:30';
    if (isNightTime && !forceRun) {
      return NextResponse.json({
        status: 'success',
        message: `夜間時間帯（21:30〜06:30、現在 ${currentHourMin}）のため、勤怠アラート通知を休止しています。`,
        current_time: currentHourMin,
        famic_alert: famicAlertResult
      }, { status: 200 });
    }

    // 1. 全未退勤ログを取得
    let logQuery = supabase
      .from('attendance_logs')
      .select('id, worker_id, user_id, date, clock_in, clock_out, memo')
      .not('clock_in', 'is', null)
      .is('clock_out', null)
      .order('date', { ascending: false });

    if (filterTenantId) {
      logQuery = logQuery.eq('user_id', filterTenantId);
    }

    const { data: allUnclockedLogs, error: logsError } = await logQuery;

    if (logsError) {
      console.error('DB Error (logs):', logsError);
      return NextResponse.json({ error: 'Database error', details: logsError.message, famic_alert: famicAlertResult }, { status: 500 });
    }

    if (!allUnclockedLogs || allUnclockedLogs.length === 0) {
      return NextResponse.json({ 
        status: 'success', 
        message: '現時点で未退勤のスタッフはおりません（全員退勤済み、または未出勤です）',
        total_unclocked: 0,
        famic_alert: famicAlertResult
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
    const includePast = searchParams.get('include_past') === 'true';

    // 4. テナントごとに打刻忘れ判定＆農業管理者へ通知！
    for (const [tenantId, logs] of Object.entries(tenantLogsMap)) {
      const compSetting = compSettingsMap.get(tenantId);
      const companyName = compSetting?.company_name || '農園';

      // 該当テナントの農業管理者たち（role=admin）
      const adminWorkers = tenantAdminWorkersMap[tenantId] || [];
      // 管理者のLINE ID一覧（ワーカーマスタ + 会社設定のadmin_line_user_id）
      const adminLineUserIds = adminWorkers
        .map(a => a.line_user_id)
        .filter(Boolean);

      if (compSetting?.admin_line_user_id && !adminLineUserIds.includes(compSetting.admin_line_user_id)) {
        adminLineUserIds.push(compSetting.admin_line_user_id);
      }

      const unclockedStaffList: {
        logId: string;
        originalMemo: string;
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

        // 🚨【多重送信・過去日スパムの完全物理遮断】
        // 1. 過去日の打刻漏れは、明示的に include_past=true が指定されない限り、10分おきの定期cronでは絶対に送らない！
        if (isPastDate && !includePast) {
          continue;
        }

        // 2. すでに通知済みのログ（memoに LINE_ALERT_SENT が記録されている場合）は絶対に再送しない！
        // ※[LINE_ALERT_SENT:2026-09-11 18:30] 等の形式に対応し、同一日・同一スタッフへの1日1回送信を物理保証（憲法10条）
        if (log.memo && (log.memo.includes('LINE_ALERT_SENT') || log.memo.includes('ALERT_SENT'))) {
          continue;
        }

        // 3. 同一Cronバッチ内での同一スタッフ重複追加を物理遮断
        if (unclockedStaffList.some(s => s.workerId === worker.id)) {
          continue;
        }

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

        // 4. 通知予定時刻（退勤時刻 + 30分）を分単位で安全に計算
        const [hours, minutes] = baseEndTime.split(':').map(Number);
        const totalTargetMinutes = (hours || 18) * 60 + (minutes || 0) + offsetMinutes;
        const targetHour = String(Math.floor(totalTargetMinutes / 60) % 24).padStart(2, '0');
        const targetMin = String(totalTargetMinutes % 60).padStart(2, '0');
        const targetTime = `${targetHour}:${targetMin}`;

        // 判定条件：
        // forceRun または 現在時刻 >= targetTime（退勤予定時刻＋30分後）の場合にアラート対象！
        const shouldAlert = forceRun || (currentHourMin >= targetTime);

        if (shouldAlert) {
          unclockedStaffList.push({
            logId: log.id,
            originalMemo: log.memo || '',
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

      // C. 🚨【送信済みフラグの即時記録（次回10分後cronでの重複送信を完全遮断）】
      for (const staff of unclockedStaffList) {
        try {
          const alertStamp = `[LINE_ALERT_SENT:${todayStr} ${currentHourMin}]`;
          const updatedMemo = staff.originalMemo 
            ? `${staff.originalMemo} ${alertStamp}`
            : alertStamp;
          await supabase
            .from('attendance_logs')
            .update({ memo: updatedMemo })
            .eq('id', staff.logId);
        } catch (uErr) {
          console.warn(`Failed to set alert stamp for log ${staff.logId}:`, uErr);
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

/**
 * 🌾 月初限定：FAMIC農薬マスター更新リマインド通知（メール＆LINE）
 * 毎月1日〜3日の朝9:00以降（または force_famic=true）に管理者に通知
 * ※当月に一度送信完了した後は再送しない（憲法10条：無限通知スパム物理遮断）
 */
async function processFamicMonthlyAlert(
  supabase: any,
  todayStr: string,
  currentHourMin: string,
  channelAccessToken: string | undefined,
  forceFamic: boolean
) {
  try {
    const currentMonth = todayStr.substring(0, 7); // 例: "2026-09"
    const currentDay = parseInt(todayStr.split('-')[2], 10);

    // 毎月1日〜3日の朝9:00以降、または手動テスト強制実行 (forceFamic) の場合に実行
    const isTargetSchedule = (currentDay <= 3 && currentHourMin >= '09:00') || forceFamic;
    if (!isTargetSchedule) {
      return { executed: false, reason: 'outside_schedule', current_day: currentDay, current_time: currentHourMin };
    }

    // 1. システム通知設定を取得
    const { data: settings } = await supabase
      .from('system_notification_settings')
      .select('*')
      .eq('id', 'default_setting')
      .maybeSingle();

    // 今月すでに送信済みなら絶対に再送しない（憲法10条：送信履歴ログ照合とクールダウンの絶対義務化）
    const { data: sentLogs } = await supabase
      .from('system_error_logs')
      .select('id')
      .eq('error_category', 'famic_monthly_alert')
      .eq('error_message', `FAMIC_ALERT_SENT_${currentMonth}`)
      .limit(1);

    if (sentLogs && sentLogs.length > 0 && !forceFamic) {
      return { executed: false, reason: 'already_sent_this_month', month: currentMonth };
    }

    const subject = '【農業収益エンジン】農薬マスター更新時期のお知らせ（月初FAMIC最新データ公開）';
    const famicUrl = 'https://www.acis.famic.go.jp/ddownload/index.htm';
    const portalMasterUrl = 'https://agri-profit-engine.vercel.app/super-admin/pesticides';

    const mailBody = [
      'お疲れ様です。農業収益エンジン（システム管理）です。',
      '',
      '月初となりましたので、FAMIC（独立行政法人 農林水産消費安全技術センター）より、当月度の最新農薬データ（新規登録・適用拡大・失効情報等）が更新・公開される時期となりました。',
      '',
      '現場での安全な防除作業、農薬取締法遵守、および出荷前審査の正確性を期すため、以下の手順にて農薬マスターの最新データ取り込みをお願いいたします。',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '▼ 手順1: FAMIC公式から最新CSVをダウンロード',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '以下のリンクを開き、「同意する」をクリックして「基本部（kihon.csv）」および「適用部（tekiyou.csv）」の最新CSVファイルをダウンロードしてください。',
      '',
      '【FAMIC公式ダウンロードページ】',
      famicUrl,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '▼ 手順2: 農業収益エンジンにCSVをインポート',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '以下のスーパー管理者画面を開き、ダウンロードしたCSVファイルをアップロードしてください。',
      '',
      '【農薬マスター管理画面】',
      portalMasterUrl,
      '',
      '--------------------------------------------------',
      '※この通知は、原則毎月月初（1日〜3日頃）にスーパー管理者へ自動送信されます。',
      '※当月中にすでにインポート・通知が完了している場合は再送されません。'
    ].join('\n');

    let mailSent = false;
    let lineSent = false;

    // A. メール送信（GAS Webhook経由）
    if (settings?.is_email_enabled && settings?.webhook_url) {
      try {
        const emailList = settings.alert_emails || 'koma@ggmc.secret.jp';
        const res = await fetch(settings.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: emailList,
            subject: subject,
            body: mailBody,
            timestamp: todayStr
          }),
          redirect: 'follow'
        });
        mailSent = res.ok;
      } catch (mErr) {
        console.warn('Famic alert mail error:', mErr);
      }
    }

    // B. LINE送信（管理者宛て）
    if (settings?.is_line_enabled && channelAccessToken) {
      const { data: adminWorkers } = await supabase
        .from('workers')
        .select('line_user_id')
        .eq('role', 'admin')
        .not('line_user_id', 'is', null);

      const lineIds = Array.from(new Set((adminWorkers || []).map((w: any) => w.line_user_id).filter(Boolean)));

      const lineText = [
        '【農業収益エンジン】農薬マスター更新リマインド🌱',
        '',
        '月初となりました！FAMIC（農林水産消費安全技術センター）より当月度の最新農薬データ（新規登録・適用拡大・失効情報）が公開される時期です。',
        '',
        '現場の安全な防除のため、最新CSVをダウンロードの上、システムへの取り込みをお願いいたします。',
        '',
        '▼ 1. FAMIC公式ダウンロード（最新CSV）',
        famicUrl,
        '',
        '▼ 2. 農薬マスター管理画面（アップロード）',
        portalMasterUrl
      ].join('\n');

      for (const lid of lineIds) {
        try {
          await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${channelAccessToken}`
            },
            body: JSON.stringify({
              to: lid,
              messages: [{ type: 'text', text: lineText }]
            })
          });
          lineSent = true;
        } catch (lErr) {
          console.warn('Famic alert LINE error:', lErr);
        }
      }
    }

    // 送信履歴をDBに記録（今月の再送を完全遮断・憲法10条）
    try {
      await supabase.from('system_error_logs').insert({
        error_category: 'famic_monthly_alert',
        error_level: 'info',
        error_message: `FAMIC_ALERT_SENT_${currentMonth}`,
        page_url: famicUrl
      });
      // 予備でnotification_settingsも更新試行
      await supabase
        .from('system_notification_settings')
        .update({ last_famic_alert_month: currentMonth })
        .eq('id', 'default_setting');
    } catch (uErr) {
      console.warn('Failed to record famic alert history:', uErr);
    }

    return {
      executed: true,
      mailSent,
      lineSent,
      month: currentMonth
    };
  } catch (err: any) {
    console.error('processFamicMonthlyAlert error:', err);
    return { executed: false, error: err.message };
  }
}



