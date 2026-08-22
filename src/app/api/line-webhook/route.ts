import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client (管理者権限)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // RLSを無視して更新するためService Key推奨

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // LINEからの疎通確認（Webhook検証）対応
    if (body.events.length === 0) {
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    const event = body.events[0];
    
    // メッセージイベントのみ処理
    if (event.type !== 'message' || event.message.type !== 'text') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const text = event.message.text.trim();
    const lineUserId = event.source.userId;
    const replyToken = event.replyToken;

    // もしメッセージが連携用のUUID（長い英数字）だったら連携処理を行う
    // 形式: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(text)) {
      const workerId = text;

      // Supabaseから一致するIDを持つworkerを検索
      const { data: worker, error } = await supabase
        .from('workers')
        .select('*')
        .eq('id', workerId)
        .single();

      if (error || !worker) {
        await replyMessage(replyToken, `入力された連携キーが無効です。\nマイページから再度「システムとLINEを連携する」ボタンを押してやり直してください。`);
        return NextResponse.json({ status: 'not_found' }, { status: 200 });
      }

      // 見つかった場合は line_user_id を保存して連携完了
      const { error: updateError } = await supabase
        .from('workers')
        .update({ 
          line_user_id: lineUserId,
          is_line_notification_enabled: true
        })
        .eq('id', worker.id);

      if (updateError) {
        await replyMessage(replyToken, `連携処理中にエラーが発生しました。システム管理者にお問い合わせください。`);
        return NextResponse.json({ status: 'error' }, { status: 500 });
      }

      await replyMessage(replyToken, `【連携完了】\n${worker.name} さんのアカウントとLINEの連携が完了しました！\n\n以後、退勤の押し忘れがある場合にこちらへ自動的にお知らせいたします。`);
      return NextResponse.json({ status: 'success' }, { status: 200 });
    }

    // その他のメッセージ（連携に関係ないメッセージ）
    await replyMessage(replyToken, `自動返信アカウントです。\n\nAgri-Profitと連携するには、マイページに表示されている「4桁の連携コード（PINコード）」だけを送信してください。`);
    return NextResponse.json({ status: 'ignored_text' }, { status: 200 });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

// LINE Messaging API で返信するヘルパー関数
async function replyMessage(replyToken: string, text: string) {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  
  if (!channelAccessToken) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is not set');
    return;
  }

  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${channelAccessToken}`
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: text }]
    })
  });
}
