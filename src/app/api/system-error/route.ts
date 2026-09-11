import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 送信先メールアドレス（我が君のアカウント）
const ALERT_EMAIL = process.env.ALERT_EMAIL_RECIPIENT || 'koma@ggmc.secret.jp';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      company_name,
      worker_id,
      worker_name,
      error_level = 'error',
      error_category = 'general',
      error_message,
      error_stack,
      device_info,
      page_url
    } = body;

    if (!error_message) {
      return NextResponse.json({ error: 'Missing error_message' }, { status: 400 });
    }

    console.error(`🚨 [FRONTEND_ALERT] [${company_name || '未特定農園'}] ${worker_name || '作業者未特定'}: ${error_message}`);

    // 1. Supabase の system_error_logs テーブルへ保存
    let savedLog: any = null;
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false }
        });

        const { data, error } = await supabase.from('system_error_logs').insert([{
          tenant_id,
          company_name,
          worker_id,
          worker_name,
          error_level,
          error_category,
          error_message,
          error_stack,
          device_info,
          page_url,
          created_at: new Date().toISOString()
        }]).select().single();

        if (!error && data) {
          savedLog = data;
        } else if (error) {
          console.warn('system_error_logs insert warning:', error.message);
        }
      } catch (dbErr) {
        console.warn('DB logging failed:', dbErr);
      }
    }

    // 2. 外部通知（メール / LINE / Webhook）の発火
    // ※非同期で安全に送信を試みる（エラー通知処理自体が落ちるのを防ぐ）
    sendAdminNotification({
      toEmail: ALERT_EMAIL,
      companyName: company_name || '未特定農園',
      workerName: worker_name || 'スタッフ未特定',
      category: error_category,
      message: error_message,
      pageUrl: page_url,
      time: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    }).catch(notifyErr => {
      console.warn('Admin notification error:', notifyErr);
    });

    return NextResponse.json({ success: true, log: savedLog });
  } catch (err: any) {
    console.error('API /api/system-error failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ログ取得API（スーパー管理者画面用）
export async function GET(req: Request) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: true, logs: [], message: 'Supabase credentials not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    const { data, error } = await supabase
      .from('system_error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('GET /api/system-error error:', error.message);
      // テーブルがまだ作られていない場合でも画面をクラッシュさせない
      return NextResponse.json({ 
        success: true, 
        logs: [], 
        tableReady: false, 
        error: error.message 
      });
    }

    return NextResponse.json({ 
      success: true, 
      logs: data || [], 
      tableReady: true 
    });
  } catch (err: any) {
    console.error('GET /api/system-error failed:', err);
    return NextResponse.json({ success: false, logs: [], error: err.message }, { status: 500 });
  }
}

// ログ解決ステータス更新API
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, is_resolved, resolved_by } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing log id' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    const updateData: any = {
      is_resolved: !!is_resolved,
      resolved_at: is_resolved ? new Date().toISOString() : null,
      resolved_by: resolved_by || 'スーパー管理者'
    };

    const { data, error } = await supabase
      .from('system_error_logs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, log: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}


// 管理者へのメール・LINE通知実行ヘルパー
async function sendAdminNotification(info: {
  toEmail: string;
  companyName: string;
  workerName: string;
  category: string;
  message: string;
  pageUrl: string;
  time: string;
}) {
  const title = `🚨【現場エラー検知】${info.companyName} (${info.workerName})`;
  const content = `
【発生日時】: ${info.time}
【対象農園】: ${info.companyName}
【作業者名】: ${info.workerName}
【カテゴリ】: ${info.category}
【エラー内容】:
${info.message}

【発生画面URL】:
${info.pageUrl}

----------------------------------------
※このメールは農業収益エンジンの現場監視システムより自動送信されています。
スーパー管理者画面（/super-admin/logs）から詳細ログとスタックトレースを確認できます。
  `.trim();

  // A. GAS (Google Apps Script) Webhook または Resend API が設定されている場合
  const webhookUrl = process.env.ADMIN_ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: info.toEmail,
          subject: title,
          body: content
        })
      });
    } catch (e) {
      console.warn('Webhook mail failed:', e);
    }
  }

  // B. Resend API Key がある場合は直接メール送信
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'AgriEngine Alert <onboarding@resend.dev>',
          to: [info.toEmail],
          subject: title,
          text: content
        })
      });
    } catch (e) {
      console.warn('Resend mail failed:', e);
    }
  }

  // C. LINE Messaging API (すでにトークンがある場合、管理者のLINEへプッシュ通知)
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
  if (lineToken && adminLineUserId) {
    try {
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lineToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: adminLineUserId,
          messages: [{ type: 'text', text: `${title}\n\n${content}` }]
        })
      });
    } catch (e) {
      console.warn('LINE push failed:', e);
    }
  }
}
