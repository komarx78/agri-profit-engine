import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client (管理者権限)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    const forceRun = searchParams.get('force') === 'true';
    const testTenantId = searchParams.get('tenant_id');

    // 簡易的なセキュリティ認証 (CRON_SECRET)
    if (key !== process.env.CRON_SECRET && !forceRun) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!channelAccessToken) {
      return NextResponse.json({ error: 'LINE Token is not configured' }, { status: 500 });
    }

    // JSTで今日の日付を取得
    const today = new Date();
    today.setHours(today.getHours() + 9);
    const dateStr = today.toISOString().split('T')[0];
    const currentHourMin = today.toISOString().split('T')[1].substring(0, 5); // "17:30"

    // 1. 今日の未退勤ログを取得
    let logQuery = supabase
      .from('attendance_logs')
      .select('id, worker_id, user_id, clock_in, clock_out')
      .eq('date', dateStr)
      .not('clock_in', 'is', null)
      .is('clock_out', null);

    if (testTenantId) {
      logQuery = logQuery.eq('user_id', testTenantId);
    }

    const { data: logs, error: logsError } = await logQuery;

    if (logsError) {
      console.error('DB Error (logs):', logsError);
      return NextResponse.json({ error: 'Database error', details: logsError }, { status: 500 });
    }

    if (!logs || logs.length === 0) {
      return NextResponse.json({ 
        status: 'success', 
        message: '本日、現時点で未退勤のスタッフはおりません（全員退勤済み、または未出勤です）',
        notified_count: 0
      }, { status: 200 });
    }

    const workerIds = logs.map(l => l.worker_id);

    // 2. テナント別の会社設定を取得
    const { data: allSettings } = await supabase
      .from('company_settings')
      .select('id, user_id, line_notification_time');

    const settingsMap: Record<string, string> = {};
    (allSettings || []).forEach((s: any) => {
      if (s.user_id && s.line_notification_time) {
        settingsMap[s.user_id] = s.line_notification_time.substring(0, 5);
      }
    });

    // 3. 承認済みの残業申請を取得
    const { data: overtimes } = await supabase
      .from('overtime_requests')
      .select('worker_id, scheduled_end_time')
      .eq('date', dateStr)
      .eq('status', 'approved')
      .in('worker_id', workerIds);

    // 4. ワーカー情報を取得
    const { data: workers, error: workersError } = await supabase
      .from('workers')
      .select('id, name, user_id, line_user_id, is_line_notification_enabled')
      .in('id', workerIds);

    if (workersError) {
      console.error('DB Error (workers):', workersError);
      return NextResponse.json({ error: 'Database error', details: workersError }, { status: 500 });
    }

    const pushResults: any[] = [];
    const skippedResults: any[] = [];

    for (const log of logs) {
      const worker = workers?.find(w => w.id === log.worker_id);
      if (!worker) continue;

      if (!worker.line_user_id) {
        skippedResults.push({ name: worker.name, reason: 'LINE未連携 (line_user_idなし)' });
        continue;
      }

      if (!worker.is_line_notification_enabled) {
        skippedResults.push({ name: worker.name, reason: 'LINE通知OFF設定' });
        continue;
      }

      // そのワーカーの所属テナントの通知時間を取得（デフォルト 17:30）
      const tenantId = worker.user_id || log.user_id;
      let targetTime = (tenantId && settingsMap[tenantId]) ? settingsMap[tenantId] : '17:30';

      // 残業申請があれば残業時刻+30分を優先
      const ot = overtimes?.find(o => o.worker_id === worker.id);
      if (ot && ot.scheduled_end_time) {
        const [hours, minutes] = ot.scheduled_end_time.split(':').map(Number);
        const dateObj = new Date();
        dateObj.setHours(hours);
        dateObj.setMinutes(minutes + 30);
        const newHours = String(dateObj.getHours()).padStart(2, '0');
        const newMinutes = String(dateObj.getMinutes()).padStart(2, '0');
        targetTime = `${newHours}:${newMinutes}`;
      }

      // 現在時刻が通知時刻を過ぎている（currentHourMin >= targetTime）か、forceRunの場合に送信
      const shouldSend = forceRun || (currentHourMin >= targetTime);

      if (shouldSend) {
        const messageText = `お疲れ様です！\n本日 ${worker.name} さんの「退勤」がまだ打刻されていません。\n\n本日の作業が終了している場合は、現場ポータルより退勤打刻をお願いいたします！\nhttps://agri-profit-engine.vercel.app/portal`;

        try {
          const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${channelAccessToken}`
            },
            body: JSON.stringify({
              to: worker.line_user_id,
              messages: [{ type: 'text', text: messageText }]
            })
          });

          pushResults.push({
            worker_id: worker.id,
            name: worker.name,
            status: response.status,
            target_time: targetTime
          });
        } catch (err: any) {
          console.error(`Push Error to ${worker.name}:`, err);
          pushResults.push({
            worker_id: worker.id,
            name: worker.name,
            status: 'error',
            error: err.message
          });
        }
      } else {
        skippedResults.push({
          name: worker.name,
          reason: `通知時刻前 (予定: ${targetTime}, 現在: ${currentHourMin})`
        });
      }
    }

    return NextResponse.json({ 
      status: 'success', 
      current_time: currentHourMin,
      notified_count: pushResults.length,
      push_results: pushResults,
      skipped_results: skippedResults
    }, { status: 200 });

  } catch (error: any) {
    console.error('Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
