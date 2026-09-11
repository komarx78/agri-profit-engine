import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { toEmails, webhookUrl } = body;

    const emailList = toEmails || 'koma@ggmc.secret.jp';
    const targetWebhook = webhookUrl || process.env.ADMIN_ALERT_WEBHOOK_URL;
    const nowJst = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    const title = '🔔【テスト通知】農業収益エンジン システム監視テスト';
    const message = [
      'これは農業収益エンジン（スーパー管理者コンソール）からのテスト通知です。',
      '',
      `【送信日時】: ${nowJst}`,
      `【設定先アドレス】: ${emailList}`,
      `【ステータス】: 正常疎通確認完了`,
      '',
      '----------------------------------------',
      '現場スタッフのスマートフォンで打刻エラーやログイン異常が発生した際、',
      'この設定アドレス宛にリアルタイムで詳細アラートが自動送信されます。'
    ].join('\n');

    let sendResult = {
      webhookSent: false,
      resendSent: false,
      lineSent: false,
      message: ''
    };

    // 1. GAS Webhook または カスタムWebhook への送信
    if (targetWebhook) {
      try {
        const res = await fetch(targetWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: emailList,
            subject: title,
            body: message,
            timestamp: nowJst
          })
        });
        sendResult.webhookSent = res.ok;
      } catch (webhookErr: any) {
        console.warn('Webhook test notification error:', webhookErr);
      }
    }

    // 2. Resend API Key がある場合の送信
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const emailsArray = emailList.split(',').map((e: string) => e.trim()).filter(Boolean);
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'AgriEngine Alert <onboarding@resend.dev>',
            to: emailsArray,
            subject: title,
            text: message
          })
        });
        sendResult.resendSent = res.ok;
      } catch (resendErr: any) {
        console.warn('Resend test notification error:', resendErr);
      }
    }

    // 3. LINE Messaging API
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
    if (lineToken && adminLineUserId) {
      try {
        const res = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lineToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: adminLineUserId,
            messages: [{ type: 'text', text: `${title}\n\n${message}` }]
          })
        });
        sendResult.lineSent = res.ok;
      } catch (lineErr: any) {
        console.warn('LINE test notification error:', lineErr);
      }
    }

    const hasAnySuccess = sendResult.webhookSent || sendResult.resendSent || sendResult.lineSent;

    return NextResponse.json({
      success: true,
      hasExternalSender: !!targetWebhook || !!resendKey || (!!lineToken && !!adminLineUserId),
      delivered: hasAnySuccess,
      details: sendResult,
      message: hasAnySuccess 
        ? `テスト通知を送信しました（送信先: ${emailList}）`
        : targetWebhook
          ? 'Webhookへ送信リクエストを送りました'
          : '⚠️ メール送信エンジン（GAS Webhook URL等）が未設定です。URLを入力して保存してください。'
    });
  } catch (err: any) {
    console.error('Test notification API failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
