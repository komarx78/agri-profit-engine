import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client (検証済みのキーを優先使用)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // LINEからの疎通確認（Webhook検証）対応
    if (!body.events || body.events.length === 0) {
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    const event = body.events[0];
    
    // メッセージイベントのみ処理
    if (event.type !== 'message' || event.message.type !== 'text') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const rawText = event.message.text || '';
    const text = rawText.trim();
    const lineUserId = event.source?.userId;
    const replyToken = event.replyToken;

    if (!lineUserId || !replyToken) {
      return NextResponse.json({ status: 'ignored_no_user' }, { status: 200 });
    }

    // 1. 【管理者連携コマンド】
    if (['管理者', '管理者連携', 'admin', '管理者登録'].includes(text.toLowerCase())) {
      try {
        await supabase
          .from('system_notification_settings')
          .upsert({
            id: 'default_setting',
            admin_line_user_id: lineUserId,
            is_line_enabled: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        await replyMessage(replyToken, `【👑 管理者LINE連携完了】\nシステム管理者としてLINE登録が完了いたしました！\n\n以後、定時後に未退勤のスタッフがいる場合、こちらへ「打刻忘れ一括アラート」が自動配信されます。`);
        return NextResponse.json({ status: 'admin_linked' }, { status: 200 });
      } catch (e: any) {
        console.error('Admin link error:', e);
        await replyMessage(replyToken, `管理者連携中にエラーが発生しました: ${e.message}`);
        return NextResponse.json({ status: 'error' }, { status: 500 });
      }
    }

    // 2. 【連携解除コマンド】
    if (['解除', '連携解除', 'unlink'].includes(text.toLowerCase())) {
      await supabase
        .from('workers')
        .update({ line_user_id: null, is_line_notification_enabled: false })
        .eq('line_user_id', lineUserId);

      await replyMessage(replyToken, `LINE連携を解除いたしました。\n再度連携したい場合は、お名前や暗証番号を送信してください。`);
      return NextResponse.json({ status: 'unlinked' }, { status: 200 });
    }

    // 3. 【UUID形式（36桁）でのワーカー連携】
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let matchedWorker: any = null;

    if (uuidRegex.test(text)) {
      const { data: worker } = await supabase
        .from('workers')
        .select('*')
        .eq('id', text)
        .maybeSingle();

      matchedWorker = worker;
    }

    // 4. 【4桁の暗証番号（PINコード）でのワーカー連携】
    if (!matchedWorker && /^\d{4}$/.test(text)) {
      const { data: pinWorkers } = await supabase
        .from('workers')
        .select('*')
        .eq('pin_code', text);

      if (pinWorkers && pinWorkers.length === 1) {
        matchedWorker = pinWorkers[0];
      } else if (pinWorkers && pinWorkers.length > 1) {
        // 暗証番号が重複している場合は氏名も要求
        const names = pinWorkers.map(w => w.name).join('、');
        await replyMessage(replyToken, `該当するスタッフが複数名見つかりました（${names}）。\nご本人確認のため、お名前（例: ${pinWorkers[0].name}）をそのまま送信してください。`);
        return NextResponse.json({ status: 'multiple_pins' }, { status: 200 });
      }
    }

    // 5. 【お名前（氏名）でのワーカー連携】
    if (!matchedWorker && text.length >= 2) {
      // 氏名完全一致または部分一致
      const { data: nameWorkers } = await supabase
        .from('workers')
        .select('*')
        .or(`name.eq.${text},name_si.eq.${text},name_km.eq.${text}`);

      if (nameWorkers && nameWorkers.length === 1) {
        matchedWorker = nameWorkers[0];
      } else if (!nameWorkers || nameWorkers.length === 0) {
        // 部分一致で再検索
        const { data: partialWorkers } = await supabase
          .from('workers')
          .select('*')
          .ilike('name', `%${text}%`);

        if (partialWorkers && partialWorkers.length === 1) {
          matchedWorker = partialWorkers[0];
        }
      }
    }

    // マッチしたワーカーがいれば連携更新！
    if (matchedWorker) {
      const { error: updateError } = await supabase
        .from('workers')
        .update({ 
          line_user_id: lineUserId,
          is_line_notification_enabled: true
        })
        .eq('id', matchedWorker.id);

      if (updateError) {
        await replyMessage(replyToken, `連携処理中にエラーが発生しました。システム管理者にお問い合わせください。`);
        return NextResponse.json({ status: 'error' }, { status: 500 });
      }

      await replyMessage(replyToken, `【✅ 連携完了】\n${matchedWorker.name} さんのアカウントとLINEの連携が完了しました！\n\n以後、退勤の押し忘れがある場合に、こちらへ自動的にお知らせをお届けいたします。お仕事お疲れ様です！🌱`);
      return NextResponse.json({ status: 'success', worker_name: matchedWorker.name }, { status: 200 });
    }

    // 6. 【未一致時のスマート案内メッセージ】
    const helpMsg = `Agri-Profit 打刻アシスタントです🌱\n\nLINE連携を行うには、以下のいずれかをこのトークに送信してください：\n\n1️⃣ あなたの「4桁の暗証番号」（例: 0301）\n2️⃣ あなたの「お名前」（例: 佐原由実香）\n3️⃣ 現場ポータルに表示されている「連携キー」\n\n※管理者の方は「管理者連携」と送信してください。`;
    await replyMessage(replyToken, helpMsg);
    return NextResponse.json({ status: 'help_sent' }, { status: 200 });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

// LINE Messaging API で返信するヘルパー関数
async function replyMessage(replyToken: string, text: string) {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  
  if (!channelAccessToken) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is not set');
    return;
  }

  try {
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
  } catch (e) {
    console.error('Failed to reply message:', e);
  }
}

