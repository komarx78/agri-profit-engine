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

    // 今日の打刻ログのうち、出勤済みで未退勤のもの（かつLINE連携がONのワーカー）を取得
    const { data: logs, error } = await supabase
      .from('attendance_logs')
      .select(`
        id,
        clock_in,
        clock_out,
        workers (
          id,
          name,
          line_user_id,
          is_line_notification_enabled
        )
      `)
      .eq('date', dateStr)
      .not('clock_in', 'is', null)
      .is('clock_out', null);

    if (error) {
      console.error('DB Error:', error);
      return NextResponse.json({ error: 'Database error', details: error }, { status: 500 });
    }

    if (!logs || logs.length === 0) {
      return NextResponse.json({ status: 'success', message: '未退勤者はおりませんでした' }, { status: 200 });
    }

    // 抽出されたワーカーに対してLINEプッシュ通知を送信
    const pushResults = [];
    
    for (const log of logs) {
      const worker = Array.isArray(log.workers) ? log.workers[0] : log.workers;
      
      // LINE連携がOFF、またはIDがない場合はスキップ
      if (!worker || !worker.line_user_id || !worker.is_line_notification_enabled) continue;

      const messageText = `お疲れ様です！\n本日 ${worker.name} さんの「退勤」がまだ打刻されていないようです。\n作業が終了している場合は、マイページから退勤処理をお願いいたします！\nhttps://agri-profit-engine.vercel.app/work`;

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
