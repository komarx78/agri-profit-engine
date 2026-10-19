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
    const lineUserId = event.source?.userId;
    const replyToken = event.replyToken;

    if (!lineUserId || !replyToken) {
      return NextResponse.json({ status: 'ignored_no_user' }, { status: 200 });
    }

    // 0. 友だち追加イベント (follow)
    if (event.type === 'follow') {
      const welcomeText = 
`友だち追加ありがとうございます！🎉
【アグリプロフィット】公式通知アカウントです🌱

📱 画面に表示されている【4桁の連携コード】をこのトークにそのまま送信してください。

連携が完了すると、退勤打刻の忘れ防止通知や作業・業務連絡がこのLINEに自動で届きます！🌾`;
      await replyMessage(replyToken, welcomeText);
      return NextResponse.json({ status: 'followed' }, { status: 200 });
    }
    
    // メッセージイベントのみ処理
    if (event.type !== 'message' || event.message.type !== 'text') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const rawText = event.message.text || '';
    const text = rawText.trim();

    // 受信内容を即座にDBログへ記録（監査・追跡用）
    try {
      await supabase.from('system_error_logs').insert({
        company_name: 'LINE_WEBHOOK',
        error_level: 'info',
        error_category: 'webhook_received',
        error_message: `Text: "${text}", UserId: ${lineUserId || 'none'}, Token: ${replyToken ? 'present' : 'none'}`
      });
    } catch (logErr) {
      console.error('Log insert error:', logErr);
    }

// 各農園の専用リッチメニュー設定（SaaS個別バインド）
const FARM_RICH_MENUS: Record<string, { farmUserId: string; companyName: string; richMenuId: string }> = {
  kap: {
    farmUserId: '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04',
    companyName: '株式会社KAP',
    richMenuId: 'richmenu-c1ec7f8a5c71fe96f19dab6fdaae6eb3'
  },
  sahara: {
    farmUserId: '62163024-2c8e-4057-a872-2455dbc58d32',
    companyName: '佐原農園株式会社',
    richMenuId: 'richmenu-0bac6b2dfa110035303eff1d8f1cf36b'
  }
};

    // 0. 【農園登録・所属バインドコマンド（SaaSハイブリッド連携）】
    // 例: "kap", "join_kap", "農園登録_kap", "sahara", "join_sahara", "佐原" など
    const lowerText = text.toLowerCase().replace(/^(join_|登録_|農園登録_|農園_)/, '');
    const matchedFarmKey = Object.keys(FARM_RICH_MENUS).find(
      k => k === lowerText || FARM_RICH_MENUS[k].companyName.toLowerCase().includes(lowerText) || lowerText.includes(k)
    );

    if (matchedFarmKey) {
      const farmInfo = FARM_RICH_MENUS[matchedFarmKey];
      const portalUrl = `https://agri-profit-engine.vercel.app/portal/${farmInfo.farmUserId}?openExternalBrowser=1`;

      // 1. 最優先で返信
      await replyMessage(
        replyToken,
        `🎉【${farmInfo.companyName}】の現場ポータルに登録が完了いたしました！\n\n画面下のメニューが「${farmInfo.companyName} 専用メニュー」に切り替わりました。\n\n今後は下のボタンを押すだけで、いつでも${farmInfo.companyName}の打刻画面が開きます🌱\n\n▼直通リンク：\n${portalUrl}`
      );

      // 2. 個別リッチメニューを連携（他社は一切不可視・完全ロック）
      await linkRichMenuToUser(lineUserId, farmInfo.richMenuId);

      return NextResponse.json({ status: 'farm_linked', farm: farmInfo.companyName }, { status: 200 });
    }

    // 1. 【管理者連携コマンド】
    if (['管理者', '管理者連携', 'admin', '管理者登録'].includes(text.toLowerCase())) {
      try {
        await replyMessage(replyToken, `【👑 管理者LINE連携完了】\nシステム管理者としてLINE登録が完了いたしました！\n\n以後、定時後に未退勤のスタッフがいる場合、こちらへ「打刻忘れ一括アラート」が自動配信されます。`);

        await supabase
          .from('system_notification_settings')
          .upsert({
            id: 'default_setting',
            admin_line_user_id: lineUserId,
            is_line_enabled: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        return NextResponse.json({ status: 'admin_linked' }, { status: 200 });
      } catch (e: any) {
        console.error('Admin link error:', e);
        return NextResponse.json({ status: 'error' }, { status: 500 });
      }
    }

    // 2. 【連携解除・農園リセットコマンド】
    if (['解除', '連携解除', 'unlink', 'リセット', 'reset', '初期化'].includes(text.toLowerCase())) {
      // 1. 最優先で即座に返信
      await replyMessage(
        replyToken,
        `【🔄 所属・連携をリセットいたしました】\n農園の専用メニューおよびLINE連携を解除し、初期状態に戻しました。\n\n別の農園に登録する場合は、各農園のコード（例: 「kap」または「sahara」）を送信してください🌱`
      );

      // 2. ユーザーの農園専用リッチメニューを剥奪（デフォルト共通メニューへリセット）
      await unlinkRichMenuFromUser(lineUserId);

      // 3. ワーカーの通知連携も解除
      try {
        await supabase
          .from('workers')
          .update({ line_user_id: null, is_line_notification_enabled: false })
          .eq('line_user_id', lineUserId);
      } catch (err) {
        console.error('DB worker update error:', err);
      }

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

    // 4. 【4〜6桁のLINE連携専用コードでのワーカー連携】
    // 全角英数字を半角に変換し、前後の日本語（「連携コード:」等）を除去して正規化
    const halfText = text.replace(/[！-～]/g, (s: string) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
    const extractedCode = halfText.replace(/^.*?(コード|CODE|PIN)[:：\s]*/i, '').trim();

    if (!matchedWorker && /^[A-Za-z0-9]{4,6}$/.test(extractedCode)) {
      const codeUpper = extractedCode.toUpperCase();
      const { data: allWorkers } = await supabase
        .from('workers')
        .select('*');

      // ① 最優先：LINE専用連携コード（line_link_pin）で厳格照合（打刻暗証番号とは別物）
      const matchedByLinePin = (allWorkers || []).filter(w => 
        w.line_link_pin && w.line_link_pin.trim().toUpperCase() === codeUpper
      );

      if (matchedByLinePin.length === 1) {
        matchedWorker = matchedByLinePin[0];
      } else if (matchedByLinePin.length > 1) {
        const names = matchedByLinePin.map(w => w.name).join('、');
        await replyMessage(replyToken, `該当するスタッフが複数名見つかりました（${names}）。\nご本人確認のため、お名前（例: ${matchedByLinePin[0].name}）をそのまま送信してください。`);
        return NextResponse.json({ status: 'multiple_pins' }, { status: 200 });
      } else {
        // ② フォールバック：従来の暗証番号で送信された場合の後方互換
        const matchedByPinCode = (allWorkers || []).filter(w => 
          w.pin_code && w.pin_code.trim().toUpperCase() === codeUpper
        );
        if (matchedByPinCode.length === 1) {
          matchedWorker = matchedByPinCode[0];
        }
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

    // マッチしたワーカーがいれば連携更新！（※打刻暗証番号は1ミリも変更せず、LINE情報のみ安全に更新）
    if (matchedWorker) {
      const updatePayload: any = {
        line_user_id: lineUserId,
        is_line_notification_enabled: true
      };
      // line_link_pin を消費（安全のためクリア）
      if (matchedWorker.line_link_pin) {
        updatePayload.line_link_pin = null;
      }

      const { error: updateError } = await supabase
        .from('workers')
        .update(updatePayload)
        .eq('id', matchedWorker.id);

      if (updateError) {
        await replyMessage(replyToken, `連携処理中にエラーが発生しました。システム管理者にお問い合わせください。`);
        return NextResponse.json({ status: 'error' }, { status: 500 });
      }

      await replyMessage(
        replyToken, 
        `🎉【アグリプロフィット】\n${matchedWorker.name} 様、LINE連携が正常に完了いたしました！\n\n今後、退勤打刻の忘れ防止通知や、重要な作業・業務連絡がこのLINEに自動で届きます。今日も一日お疲れ様です！🌱`
      );
      return NextResponse.json({ status: 'success', worker_name: matchedWorker.name }, { status: 200 });
    }

    // 6. 【未一致時のスマート案内メッセージ】
    const helpMsg = `アグリプロフィット 現場クラウドです🌱\n\n【所属農園のLINE連携】\nあなたの農園コードを送信してください：\n・株式会社KAP ➔ 「kap」\n・佐原農園株式会社 ➔ 「sahara」\n\n送信すると、画面下のメニューが自社専用の打刻メニューに切り替わります！\n\n※スタッフ個人の通知連携は「お名前」または「4桁の連携コード」を送信してください。\n※管理者の方は「管理者連携」と送信してください。`;
    await replyMessage(replyToken, helpMsg);
    return NextResponse.json({ status: 'help_sent' }, { status: 200 });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

// LINE Messaging API トークン（環境変数から安全に取得）
const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

// LINE Messaging API で個別リッチメニューをユーザーにバインドする関数
async function linkRichMenuToUser(userId: string, richMenuId: string) {
  if (!LINE_ACCESS_TOKEN || !userId || !richMenuId) return;

  try {
    const res = await fetch(`https://api.line.me/v2/bot/user/${userId}/richmenu/${richMenuId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
      }
    });
    console.log(`Linked richmenu ${richMenuId} to user ${userId}: status ${res.status}`);
  } catch (e) {
    console.error('Failed to link rich menu to user:', e);
  }
}

// LINE Messaging API でユーザーの個別リッチメニューを解除する関数（デフォルト共通メニューへ復帰）
async function unlinkRichMenuFromUser(userId: string) {
  if (!LINE_ACCESS_TOKEN || !userId) return;

  try {
    const res = await fetch(`https://api.line.me/v2/bot/user/${userId}/richmenu`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
      }
    });
    console.log(`Unlinked richmenu from user ${userId}: status ${res.status}`);
  } catch (e) {
    console.error('Failed to unlink rich menu from user:', e);
  }
}

// LINE Messaging API で返信するヘルパー関数（失敗時は即座にpushMessageで確実に配送）
async function replyMessage(replyToken: string, text: string, userId?: string) {
  if (!LINE_ACCESS_TOKEN) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is not set');
    return;
  }

  let sent = false;
  if (replyToken && replyToken !== 'dummy_token') {
    try {
      const res = await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          replyToken: replyToken,
          messages: [{ type: 'text', text: text }]
        })
      });
      if (res.ok) {
        sent = true;
        console.log(`Successfully replied message via replyToken`);
      } else {
        const errText = await res.text();
        console.warn(`ReplyToken failed (${res.status}): ${errText}`);
      }
    } catch (e) {
      console.warn('Reply error:', e);
    }
  }

  // replyTokenで届かなかった場合は、ユーザーIDへのダイレクトpushで確実に配送！
  if (!sent && userId && userId.startsWith('U')) {
    await pushMessage(userId, text);
  }
}

// LINE Messaging API でダイレクトプッシュ送信する関数
async function pushMessage(userId: string, text: string) {
  if (!LINE_ACCESS_TOKEN || !userId) return;

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: text }]
      })
    });
    console.log(`Direct push to ${userId}: status ${res.status}`);
  } catch (e) {
    console.error('Push error:', e);
  }
}

