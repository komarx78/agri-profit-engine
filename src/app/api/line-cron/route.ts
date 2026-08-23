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

    // 簡易的なセキュリティ認証 (CRON_SECRET)
    if (key !== process.env.CRON_SECRET) {
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

    // 1. 今日の未退勤ログを取得
    const { data: logs, error: logsError } = await supabase
      .from('attendance_logs')
      .select('id, worker_id, clock_in, clock_out')
      .eq('date', dateStr)
      .not('clock_in', 'is', null)
      .is('clock_out', null);

    if (logsError) {
      console.error('DB Error (logs):', logsError);
      return NextResponse.json({ error: 'Database error', details: logsError }, { status: 500 });
    }

    if (!logs || logs.length === 0) {
      return NextResponse.json({ status: 'success', message: '未退勤者はおりませんでした' }, { status: 200 });
    }

    const workerIds = logs.map(l => l.worker_id);

    // 2. マスタ設定を取得 (複数テナント対応のため全件取得。将来的にはworkerのcompany_id等で紐付ける)
    const { data: settings } = await supabase.from('company_settings').select('id, line_notification_time');
    // ※今回は簡略化のため最初の1件をデフォルトマスタとする
    const defaultMasterTime = settings && settings.length > 0 && settings[0].line_notification_time 
      ? settings[0].line_notification_time.substring(0, 5) 
      : '18:00';

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
      .select('id, name, line_user_id, is_line_notification_enabled')
      .in('id', workerIds);

    if (workersError) {
      console.error('DB Error (workers):', workersError);
      return NextResponse.json({ error: 'Database error', details: workersError }, { status: 500 });
    }

    // 現在時刻(HH:MM)
    const currentHourMin = today.toISOString().split('T')[1].substring(0, 5);
    const forceRun = searchParams.get('force') === 'true';

    const pushResults = [];
    
    for (const log of logs) {
      const worker = workers?.find(w => w.id === log.worker_id);
      if (!worker || !worker.line_user_id || !worker.is_line_notification_enabled) continue;

      // そのワーカーの通知時間を決定 (残業申請があればそれを優先)
      let targetTime = defaultMasterTime;
      const ot = overtimes?.find(o => o.worker_id === worker.id);
      
      if (ot) {
        // 残業予定時刻（例: "19:00:00"）に30分の猶予（バッファ）を足す
        const [hours, minutes] = ot.scheduled_end_time.split(':').map(Number);
        const dateObj = new Date();
        dateObj.setHours(hours);
        dateObj.setMinutes(minutes + 30);
        
        const newHours = String(dateObj.getHours()).padStart(2, '0');
        const newMinutes = String(dateObj.getMinutes()).padStart(2, '0');
        targetTime = `${newHours}:${newMinutes}`;
      }

      // 現在時刻と一致しているか、またはforceRun指定時のみ送信
      if (forceRun || targetTime === currentHourMin) {
        const messageText = `お疲れ様です！\n本日 ${worker.name} さんの「退勤」がまだ打刻されていません。\n作業が終わっている場合は、マイページから退勤処理をお願いいたします！\nhttps://agri-profit-engine.vercel.app/work`;

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
            status: response.status
          });
        } catch (err) {
          console.error(`Push Error to ${worker.name}:`, err);
        }
      }
    }

    return NextResponse.json({ 
      status: 'success', 
      notified_count: pushResults.length,
      details: pushResults
    }, { status: 200 });

  } catch (error) {
    console.error('Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
