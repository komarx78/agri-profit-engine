import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function addDaysJst(days: number): { todayStr: string; endDateStr: string } {
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowJst.toISOString().substring(0, 10);
  const endObj = new Date(nowJst.getTime());
  endObj.setDate(endObj.getDate() + days);
  const endDateStr = endObj.toISOString().substring(0, 10);
  return { todayStr, endDateStr };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      companyName,
      ownerName,
      phone,
      email,
      password,
      preferredFarmCode,
      campaignCode,
      trialDays: reqTrialDays,
      campaignName: reqCampaignName,
    } = body;

    if (!companyName || !ownerName || !email || !password) {
      return NextResponse.json(
        { error: '農園名、代表者名、メールアドレス、パスワードはすべて必須です。' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'パスワードは6文字以上で入力してください。' },
        { status: 400 }
      );
    }

    // キャンペーン日数の確定（標準30日、キャンペーン指定時は60日/90日/180日など）
    const validDays = Number(reqTrialDays) > 0 ? Number(reqTrialDays) : 30;
    const { todayStr, endDateStr: trialEndsAt } = addDaysJst(validDays);
    const resolvedCampaignName =
      reqCampaignName ||
      (validDays >= 180
        ? '🌸 半年無料キャンペーン'
        : validDays >= 90
        ? '🎉 3ヶ月無料キャンペーン'
        : validDays >= 60
        ? '🎁 2ヶ月無料キャンペーン'
        : '標準1ヶ月無料');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    const clientAnon = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    // 1. 農園コードの生成・重複チェック
    let baseCode = (preferredFarmCode || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');

    if (!baseCode || baseCode.length < 3) {
      const randNum = Math.floor(100 + Math.random() * 900);
      baseCode = `farm-${randNum}`;
    }

    let finalFarmCode = baseCode;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: existing } = await clientAnon
        .from('company_settings')
        .select('id')
        .ilike('farm_code', finalFarmCode)
        .maybeSingle();

      if (!existing) break;
      const randSuffix = Math.floor(100 + Math.random() * 900);
      finalFarmCode = `${baseCode}-${randSuffix}`;
    }

    // 2. Supabase Auth ユーザー作成
    let newUserId = '';
    if (serviceRoleKey && serviceRoleKey.length > 20) {
      try {
        const clientAdmin = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false },
        });
        const { data: adminUser, error: adminErr } = await clientAdmin.auth.admin.createUser({
          email: email.trim(),
          password,
          email_confirm: true,
          user_metadata: {
            company_name: companyName.trim(),
            owner_name: ownerName.trim(),
          },
        });
        if (!adminErr && adminUser?.user?.id) {
          newUserId = adminUser.user.id;
        }
      } catch (e) {
        // フォールバックへ
      }
    }

    if (!newUserId) {
      const { data: signUpData, error: signUpErr } = await clientAnon.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            company_name: companyName.trim(),
            owner_name: ownerName.trim(),
          },
        },
      });

      if (signUpErr) {
        if (
          signUpErr.message.includes('already registered') ||
          signUpErr.message.includes('already exists')
        ) {
          return NextResponse.json(
            {
              error:
                'このメールアドレスは既に登録されています。ログイン画面からログインしてください。',
            },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { error: `アカウント作成エラー: ${signUpErr.message}` },
          { status: 400 }
        );
      }

      newUserId = signUpData?.user?.id || crypto.randomUUID();
    }

    // 3. company_settings に農園マスタを作成（本番DBの company_settings には settings カラムが存在しないため、attendance_rules および system_notification_settings に格納）
    const extSettingsPayload = {
      plan_type: 'trial',
      trial_days: validDays,
      trial_ends_at: trialEndsAt,
      campaign_name: resolvedCampaignName,
      campaign_code: (campaignCode || '').trim().toUpperCase(),
      plan_updated_at: new Date().toISOString(),
    };

    const { data: compInserted, error: compErr } = await clientAnon
      .from('company_settings')
      .insert({
        user_id: newUserId,
        company_name: companyName.trim(),
        phone: (phone || '').trim(),
        postal_code: '',
        address: '',
        invoice_number: '',
        bank_info: '',
        plan_type: 'trial',
        default_start_time: '08:00:00',
        default_end_time: '17:00:00',
        default_rest_minutes: 60,
        auto_round_out_time: true,
        line_notification_time: '18:00:00',
        attendance_closing_day: 0,
        payment_day_rule: '翌月25日払い',
        farm_code: finalFarmCode,
        attendance_rules: [{ __ext_settings: true, ...extSettingsPayload }],
      })
      .select('*')
      .maybeSingle();

    if (compErr) {
      return NextResponse.json(
        { error: `農園設定の保存に失敗しました: ${compErr.message}` },
        { status: 500 }
      );
    }

    // 3b. system_notification_settings にもテナント拡張設定を保存（スーパー管理画面・残り日数バッジと100%連動）
    try {
      const targetIds = Array.from(new Set([newUserId, compInserted?.id].filter(Boolean)));
      const nowIso = new Date().toISOString();
      await clientAnon.from('system_notification_settings').upsert(
        targetIds.map((tid) => ({
          id: `tenant_ext_${tid}`,
          alert_emails: 'tenant_ext_settings',
          webhook_url: JSON.stringify(extSettingsPayload),
          is_email_enabled: false,
          is_line_enabled: false,
          updated_at: nowIso,
        })),
        { onConflict: 'id' }
      );
    } catch (extErr) {
      console.warn('tenant_ext save warning:', extErr);
    }

    // 4. 代表者自身を最初のスタッフ（管理者権限・PIN 0000）として workers テーブルに自動登録
    const { data: workerData, error: workerErr } = await clientAnon
      .from('workers')
      .insert({
        user_id: newUserId,
        name: ownerName.trim(),
        role: 'admin',
        pin_code: '0000',
        hourly_wage: 1200,
        type: '正社員',
        employment_type: '正社員',
        join_date: todayStr,
        weekly_days: 5,
        weekly_working_days: 5,
        standard_start_time: '08:00:00',
        standard_end_time: '17:00:00',
        standard_rest_minutes: 60,
        paid_leave_carryover: 0,
        paid_leave_balance: 10,
        is_line_notification_enabled: true,
      })
      .select('*')
      .maybeSingle();

    if (workerErr) {
      console.warn('Initial worker creation warning:', workerErr);
    }

    // 5. スーパー管理者のログ画面（system_error_logs）にも記録
    try {
      await clientAnon.from('system_error_logs').insert({
        tenant_id: newUserId,
        company_name: companyName.trim(),
        worker_name: ownerName.trim(),
        error_level: 'info',
        error_category: 'general',
        error_message: `🎉【新規登録（${resolvedCampaignName}・${validDays}日間）】「${companyName.trim()}」（代表: ${ownerName.trim()}様 / 農園コード: ${finalFarmCode.toUpperCase()} / 無料終了日: ${trialEndsAt} / TEL: ${phone || '未入力'} / Email: ${email.trim()}）が登録されました！`,
        page_url: '/register',
      });
    } catch (logErr) {}

    return NextResponse.json({
      success: true,
      tenantId: newUserId,
      companyName: companyName.trim(),
      farmCode: finalFarmCode.toUpperCase(),
      trialDays: validDays,
      trialEndsAt,
      campaignName: resolvedCampaignName,
      worker: workerData || {
        id: crypto.randomUUID(),
        name: ownerName.trim(),
        role: 'admin',
        pin_code: '0000',
        user_id: newUserId,
        type: '正社員',
        employment_type: '正社員',
      },
    });
  } catch (err: any) {
    console.error('register-farm error:', err);
    return NextResponse.json(
      { error: err.message || '登録処理中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}
