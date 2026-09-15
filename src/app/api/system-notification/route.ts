import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, key, { auth: { persistSession: false } });
}

const DEFAULT_SETTINGS = {
  id: 'default_setting',
  alert_emails: 'koma@ggmc.secret.jp',
  webhook_url: '',
  is_email_enabled: true,
  is_line_enabled: true
};

// 通知設定の取得
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('system_notification_settings')
      .select('*')
      .eq('id', 'default_setting')
      .maybeSingle();

    if (error) {
      console.warn('GET /api/system-notification warning:', error.message);
      const isMissingTable = error.code === 'PGRST205' || 
                             error.message.includes('relation') || 
                             error.message.includes('does not exist');
      return NextResponse.json({
        success: true,
        settings: DEFAULT_SETTINGS,
        tableReady: !isMissingTable
      });
    }

    return NextResponse.json({
      success: true,
      settings: data || DEFAULT_SETTINGS,
      tableReady: true
    });
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      settings: DEFAULT_SETTINGS,
      tableReady: true,
      error: err.message
    });
  }
}

// 通知設定の保存・更新
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { alert_emails, webhook_url, is_email_enabled, is_line_enabled } = body;

    const supabase = getSupabase();
    const payload = {
      id: 'default_setting',
      alert_emails: alert_emails || 'koma@ggmc.secret.jp',
      webhook_url: webhook_url || '',
      is_email_enabled: is_email_enabled !== false,
      is_line_enabled: is_line_enabled !== false,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('system_notification_settings')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('POST /api/system-notification error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, settings: data });
  } catch (err: any) {
    console.error('POST /api/system-notification failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
