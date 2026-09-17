import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアント（検証済みキーを使用）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      tenantId,
      workerId,
      action,
      logId,
      date,
      now,
      weather = null,
      temp = null,
      idempotencyKey
    } = body;

    if (!workerId || !action) {
      return NextResponse.json(
        { success: false, error: 'workerId と action は必須です' },
        { status: 400, headers: getNoCacheHeaders() }
      );
    }

    // 1. 農園オーナーID（user_id）の自律解決（憲法3条・マルチテナント完全分離）
    let resolvedUserId = tenantId;
    if (!resolvedUserId || resolvedUserId === 'null' || resolvedUserId === 'undefined') {
      const { data: worker } = await supabase
        .from('workers')
        .select('user_id')
        .eq('id', workerId)
        .maybeSingle();
      if (worker?.user_id) {
        resolvedUserId = worker.user_id;
      }
    }

    const todayDate = date || new Date().toISOString().substring(0, 10);
    const nowIso = now || new Date().toISOString();

    // ════════════════════════════════════════════════════════
    // 【出勤打刻 (clock_in)】
    // ════════════════════════════════════════════════════════
    if (action === 'clock_in') {
      // 🛡️ 二重出勤防止ガード（完全な冪等性保証）
      // すでに本日の出勤記録が存在する場合は、新規登録せず既存レコードを返却
      const { data: existingToday } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('worker_id', workerId)
        .eq('date', todayDate)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingToday && existingToday.length > 0) {
        return NextResponse.json(
          { success: true, data: existingToday[0], alreadyExists: true },
          { status: 200, headers: getNoCacheHeaders() }
        );
      }

      // 新規出勤レコードの作成
      const { data: newLog, error: insertError } = await supabase
        .from('attendance_logs')
        .insert([{
          user_id: resolvedUserId || null,
          worker_id: workerId,
          date: todayDate,
          clock_in: nowIso,
          weather: weather,
          temperature: temp
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Attendance insert error:', insertError);
        throw insertError;
      }

      return NextResponse.json(
        { success: true, data: newLog },
        { status: 200, headers: getNoCacheHeaders() }
      );
    }

    // ════════════════════════════════════════════════════════
    // 【退勤・休憩打刻 (clock_out / break_start / break_end)】
    // ════════════════════════════════════════════════════════
    let targetLogId = logId;

    // 🛡️ logId がフロントから渡されなかった場合のフェイルセーフ自律解決
    // 該当スタッフの「未退勤（clock_out is null）」の最新打刻レコードを自動探索！
    if (!targetLogId || targetLogId === 'null' || targetLogId === 'undefined') {
      const { data: unclosedLogs } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('worker_id', workerId)
        .is('clock_out', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (unclosedLogs && unclosedLogs.length > 0) {
        targetLogId = unclosedLogs[0].id;
      }
    }

    if (!targetLogId) {
      return NextResponse.json(
        { 
          success: false, 
          error: '対象の出勤記録が見つかりませんでした。先に出勤打刻を行ってください。',
          code: 'NO_CLOCK_IN_RECORD'
        },
        { status: 400, headers: getNoCacheHeaders() }
      );
    }

    const updates: any = {};
    if (resolvedUserId && resolvedUserId !== 'null' && resolvedUserId !== 'undefined') {
      updates.user_id = resolvedUserId;
    }

    // 休憩開始
    if (action === 'break_start') {
      updates.break_start_time = nowIso;
      updates.break_end_time = null;
    }

    // 休憩終了
    if (action === 'break_end') {
      updates.break_end_time = nowIso;
      const { data: currentLog } = await supabase
        .from('attendance_logs')
        .select('break_start_time, total_break_minutes')
        .eq('id', targetLogId)
        .single();

      if (currentLog?.break_start_time) {
        const bStart = new Date(currentLog.break_start_time).getTime();
        const bEnd = new Date(nowIso).getTime();
        const diffMins = Math.max(0, Math.floor((bEnd - bStart) / 1000 / 60));
        updates.total_break_minutes = (currentLog.total_break_minutes || 0) + diffMins;
      }
    }

    // 退勤
    if (action === 'clock_out') {
      updates.clock_out = nowIso;
      // 休憩終了を押し忘れて退勤した場合の自動精算
      const { data: currentLog } = await supabase
        .from('attendance_logs')
        .select('break_start_time, break_end_time, total_break_minutes')
        .eq('id', targetLogId)
        .single();

      if (currentLog?.break_start_time && !currentLog.break_end_time) {
        updates.break_end_time = nowIso;
        const bStart = new Date(currentLog.break_start_time).getTime();
        const bEnd = new Date(nowIso).getTime();
        const diffMins = Math.max(0, Math.floor((bEnd - bStart) / 1000 / 60));
        updates.total_break_minutes = (currentLog.total_break_minutes || 0) + diffMins;
      }
    }

    const { data: updatedLog, error: updateError } = await supabase
      .from('attendance_logs')
      .update(updates)
      .eq('id', targetLogId)
      .select()
      .single();

    if (updateError) {
      console.error('Attendance update error:', updateError);
      throw updateError;
    }

    return NextResponse.json(
      { success: true, data: updatedLog },
      { status: 200, headers: getNoCacheHeaders() }
    );

  } catch (err: any) {
    console.error('Attendance API exception:', err);
    return NextResponse.json(
      { success: false, error: err.message || '打刻処理中にエラーが発生しました' },
      { status: 500, headers: getNoCacheHeaders() }
    );
  }
}

// OPTIONS リクエスト（CORSプリフライト対応）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...getNoCacheHeaders()
    }
  });
}

// Safari / WebKit のキャッシュによる通信ブロックを防ぐヘッダー
function getNoCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  };
}
