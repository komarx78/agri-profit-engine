import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

interface AssistantRequestBody {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  companyName?: string;
  farmCode?: string;
  tenantId?: string;
  currentPath?: string;
}

// 🛡️ ローカルナレッジベース（Gemini API障害・未設定時の完全自動フォールバック）
function getFallbackResponse(
  query: string,
  companyName: string = '当農園',
  farmCode: string = 'sahara-789',
  tenantId: string = ''
): { reply: string; actionLinks?: Array<{ label: string; url: string }> } {
  const q = query.toLowerCase();

  if (q.includes('農園コード') || q.includes('コード') || q.includes('アプリ') || q.includes('ログインできない') || q.includes('入れない') || q.includes('qr')) {
    return {
      reply: `【${companyName}】の現場アプリ用「農園コード」は **${farmCode.toUpperCase()}** です！\n\n【接続方法（2通り）】\n1. **QRコードで自動接続（おすすめ）**: 現場アプリの「📷 ポスターのQRコードをカメラで読み取る」ボタンを押して、A4ポスターをかざすだけで手入力不要で一瞬接続できます。\n2. **手入力**: アプリ起動時に「農園コード（${farmCode.toUpperCase()}）」を入力して接続ボタンを押します。\n\n※農園コードの確認・変更は「自社情報設定」からいつでも行えます。また、スタッフ休憩所に貼れる「A4ポスター印刷」もご利用いただけます。`,
      actionLinks: [
        { label: '自社情報設定を開く', url: tenantId ? `/admin/settings?farm=${tenantId}` : '/admin/settings' },
        { label: '現場ポータルを開く', url: tenantId ? `/portal/${tenantId}` : '/portal' },
      ]
    };
  }

  if (q.includes('打刻') || q.includes('出勤') || q.includes('退勤') || q.includes('勤怠') || q.includes('タイムカード')) {
    return {
      reply: `スタッフの出退勤・勤怠は以下の手順で管理できます：\n\n1. **スタッフの打刻**: スマホアプリまたは現場ポータル（農園コード: ${farmCode.toUpperCase()}）から4桁PINでワンタップ打刻。\n2. **リアルタイム確認**: 「ダッシュボード」で現在の出勤者・本日の作業状況を一目で確認。\n3. **承認・修正**: 「作業承認インボックス」で提出された打刻・日報を確認し、必要に応じて承認・修正できます。`,
      actionLinks: [
        { label: 'ダッシュボードを見る', url: tenantId ? `/admin/dashboard?farm=${tenantId}` : '/admin/dashboard' },
        { label: '作業承認インボックスへ', url: tenantId ? `/admin/approvals?farm=${tenantId}` : '/admin/approvals' },
        { label: '現場打刻画面を開く', url: tenantId ? `/work/${tenantId}` : '/work' },
      ]
    };
  }

  if (q.includes('日報') || q.includes('作業日誌') || q.includes('日誌') || q.includes('作業記録')) {
    return {
      reply: `日報・作業日誌の管理は以下のように行います：\n\n1. 現場スタッフがスマホから「圃場・作物・作業内容・時間・使用資材」を選択して送信。\n2. 管理者は「作業承認インボックス」で内容を確認・ワンクリック承認。\n3. 蓄積された記録は「作業台帳」で過去の検索やCSV出力が可能です。`,
      actionLinks: [
        { label: '作業承認インボックスへ', url: tenantId ? `/admin/approvals?farm=${tenantId}` : '/admin/approvals' },
        { label: '作業台帳を見る', url: tenantId ? `/admin/work-ledger?farm=${tenantId}` : '/admin/work-ledger' },
        { label: 'タスク・スケジュール管理', url: tenantId ? `/admin/tasks?farm=${tenantId}` : '/admin/tasks' },
      ]
    };
  }

  if (q.includes('請求') || q.includes('インボイス') || q.includes('売上') || q.includes('販売')) {
    return {
      reply: `請求書の発行および販売管理は以下の機能をご利用ください：\n\n1. **請求書発行**: 取引先ごとの出荷データからインボイス制度対応の請求書を自動作成・PDF出力。\n2. **販売管理システム**: 出荷先・品目別の売上集計・売掛金管理。\n3. **B2B受発注**: 取引先（飲食店やスーパー様）がスマホ等から直接注文できる専用ポータル。`,
      actionLinks: [
        { label: '請求書一覧・発行へ', url: tenantId ? `/admin/invoices?farm=${tenantId}` : '/admin/invoices' },
        { label: '販売管理システムを開く', url: tenantId ? `/sales-management?farm=${tenantId}` : '/sales-management' },
      ]
    };
  }

  if (q.includes('農薬') || q.includes('防除') || q.includes('希釈') || q.includes('病害虫') || q.includes('散布')) {
    return {
      reply: `農薬の安全基準チェックや防除計画には「農薬検索・防除AI」をご活用ください！\n\n- 作物名と病害虫名を入れるだけで、使用可能な農薬・希釈倍率・収穫前使用日数を即座に案内します。\n- 「防除履歴管理」では散布実績を記録し、残留基準の遵守や帳票出力が行えます。`,
      actionLinks: [
        { label: '農薬検索・防除AIを開く', url: tenantId ? `/farm/pesticide-check?farm=${tenantId}` : '/farm/pesticide-check' },
        { label: '防除履歴管理を見る', url: tenantId ? `/admin/spray-management?farm=${tenantId}` : '/admin/spray-management' },
      ]
    };
  }

  if (q.includes('圃場') || q.includes('マップ') || q.includes('地図') || q.includes('作付け') || q.includes('作付')) {
    return {
      reply: `圃場と作付けの管理は以下の画面で行えます：\n\n- **作付地図 (圃場マップ)**: 航空写真上で圃場の区画、現在の作付け、前作履歴を視覚的に把握。\n- **作付け・作業 統合司令塔**: 品目ごとの定植日、収穫予定、目標収量の一元管理。\n- **作目別 採算分析**: どの作物が一番利益が出ているかを自動グラフ化。`,
      actionLinks: [
        { label: '作付地図 (圃場マップ)へ', url: tenantId ? `/admin/map?farm=${tenantId}` : '/admin/map' },
        { label: '作付け統合司令塔へ', url: tenantId ? `/admin/cultivations?farm=${tenantId}` : '/admin/cultivations' },
        { label: '作目別 採算分析へ', url: tenantId ? `/admin/crop-analysis?farm=${tenantId}` : '/admin/crop-analysis' },
      ]
    };
  }

  if (q.includes('給与') || q.includes('労務') || q.includes('シフト') || q.includes('人事')) {
    return {
      reply: `スタッフの人事労務・給与計算は「労務・人事システム」で行えます。\n\n打刻データから労働時間や残業時間を自動集計し、締め日・支払日ルールに応じた給与台帳の作成や給与明細の発行に対応しています。`,
      actionLinks: [
        { label: '労務・人事システムを開く', url: tenantId ? `/hr?farm=${tenantId}` : '/hr' },
        { label: '自社情報設定（締め日等）', url: tenantId ? `/admin/settings?farm=${tenantId}` : '/admin/settings' },
      ]
    };
  }

  if (q.includes('資材') || q.includes('肥料') || q.includes('仕入れ') || q.includes('経費') || q.includes('経理')) {
    return {
      reply: `資材・肥料の集計および経理・購買は以下の画面で行えます：\n\n- **必要資材自動集計**: 作付計画から必要な肥料や種苗の総量を自動計算。\n- **経理・購買システム**: 資材の仕入れ伝票の入力と買掛金管理。\n- **月次経費管理**: 燃料・光熱費などの間接費を記録し、農園の損益を把握。`,
      actionLinks: [
        { label: '必要資材自動集計へ', url: tenantId ? `/admin/material-requirements?farm=${tenantId}` : '/admin/material-requirements' },
        { label: '経理・購買システムへ', url: tenantId ? `/accounting-management?farm=${tenantId}` : '/accounting-management' },
        { label: '月次経費管理へ', url: tenantId ? `/admin/monthly-expenses?farm=${tenantId}` : '/admin/monthly-expenses' },
      ]
    };
  }

  return {
    reply: `ご質問ありがとうございます！\n\n当システム「agri-profit-engine PRO」では、出退勤打刻・日報から栽培計画・圃場マップ・農薬防除AI・インボイス請求書・給与計算まで、農業経営に必要なすべての業務をサポートしています。\n\n何かお困りの操作や、見つからない機能がございましたら、いつでもお気軽に具体的なキーワード（例:「農園コード」「出退勤」「請求書」「圃場マップ」「農薬」「給与」など）でお尋ねください！`,
    actionLinks: [
      { label: 'ダッシュボードへ', url: tenantId ? `/admin/dashboard?farm=${tenantId}` : '/admin/dashboard' },
      { label: 'マスタ管理全般へ', url: tenantId ? `/admin/masters?farm=${tenantId}` : '/admin/masters' },
      { label: '自社情報設定へ', url: tenantId ? `/admin/settings?farm=${tenantId}` : '/admin/settings' },
    ]
  };
}

export async function POST(req: Request) {
  try {
    const body: AssistantRequestBody = await req.json();
    const { message, history = [], companyName = '当農園', farmCode = 'sahara', tenantId = '', currentPath = '' } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'メッセージが空です' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    // APIキーがない場合は即座にローカルナレッジベースで回答
    if (!apiKey) {
      const fallback = getFallbackResponse(message, companyName, farmCode, tenantId);
      return NextResponse.json({
        reply: fallback.reply,
        actionLinks: fallback.actionLinks || [],
        source: 'local_knowledge'
      });
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      // 利用可能なモデルを順次試行
      const candidateModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
      let model = null;
      let aiResponseText = '';

      const systemInstruction = `
あなたは農業経営統合SaaS「agri-profit-engine PRO」の専任コンシェルジュAI（孔明システムアドバイザー）です。
PC操作やITツールに不慣れな農家様や現場スタッフ、管理者様にも100%直感的でわかりやすい、極めて優しく親切・丁寧な日本語で回答してください。

【現在のアクセス中コンテキスト】
- 農園名: ${companyName}
- 現場アプリ用農園コード: ${farmCode.toUpperCase()}
- テナントID: ${tenantId || '未指定'}
- 現在開いている画面パス: ${currentPath || '管理画面'}

【システム全機能マップとルーティング】
1. 現場アプリ・農園コード:
   - スタッフ用スマホアプリ（Android APK / PWA）の初回起動時は「農園コード (${farmCode.toUpperCase()})」の入力が必要。
   - 確認・変更は「自社情報設定」(/admin/settings) で可能。
   - 休憩所掲示用のA4ポスター印刷機能も備わっています。
2. 現場・打刻・日報:
   - 現場ポータル: /portal/${tenantId || ''} (スタッフがスマホで打刻・日報を入力する画面)
   - 現場打刻: /work/${tenantId || ''} (PINコード入力で出退勤打刻)
   - ダッシュボード: /admin/dashboard (本日の出勤状況、作業進捗、KPI)
   - 作業承認インボックス: /admin/approvals (現場から届いた日報・打刻の確認・承認)
   - タスク管理: /admin/tasks (スタッフへの作業割り当て・指示)
   - 作業台帳: /admin/work-ledger (過去の全日報データ検索・集計・CSV出力)
3. 栽培・圃場・分析:
   - 作付け・作業統合司令塔: /admin/cultivations (品目ごとの計画・進捗)
   - 作付地図 (圃場マップ): /admin/map (Googleマップ航空写真上で圃場と作付けを一元視覚化)
   - 栽培・予実管理表: /admin/cultivation-schedule (ガントチャートでの定植・収穫予定)
   - 作目別 採算分析: /admin/crop-analysis (作物ごとの売上・原価・利益率グラフ)
   - 育苗スケジュール: /admin/nursery-schedule (播種から育苗管理)
   - 必要資材自動集計: /admin/material-requirements (面積に応じた肥料・資材自動計算)
   - 圃場管理: /admin/fields (圃場マスタ・面積・土壌設定)
4. 販売・請求・B2B:
   - 販売管理システム: /sales-management (出荷先・顧客・売上管理)
   - 請求書発行: /admin/invoices (適格インボイス対応の請求書作成・PDF出力)
   - B2B受発注: /b2b-order (卸先・飲食店からのWeb発注受付)
5. 経理・購買・原価:
   - 経理・購買システム: /accounting-management (資材仕入れ・買掛金)
   - 月次経費管理: /admin/monthly-expenses (燃料代・地代・減価償却などの間接費)
6. 人事労務・給与:
   - 労務・人事システム: /hr (タイムカード集計・時給計算・給与明細出力)
7. 農薬・防除安全AI:
   - 農薬検索・防除AI: /farm/pesticide-check (病害虫・作物名から希釈倍率・収穫前日数を即答)
   - 防除履歴管理: /admin/spray-management (散布履歴の台帳記録)
8. マスタ・設定:
   - マスタ管理全般: /admin/masters (作物・品目・作業・資材の一括管理)
   - 自社情報設定: /admin/settings (農園名、適格請求書番号、住所、農園コード、締め日)

【回答の絶対ルール】
1. 専門用語（API、UUID、デプロイ、コンポーネント等）は絶対に使わず、現場の日常言葉で説明すること。
2. ユーザーが案内された画面へ1秒で移動できるよう、関連する画面がある場合は回答本文中に必ず以下の形式でアクションタグを含めてください：
   [ACTION: 〇〇画面を開く, /admin/xxx]
   （例: [ACTION: 自社情報設定を開く, /admin/settings?farm=${tenantId}]）
   ※URLには必要に応じて ?farm=${tenantId} を付与してください。
3. 農園コードを聞かれたら、自信を持って「貴社の農園コードは【${farmCode.toUpperCase()}】です」と答えてください。
4. 簡潔で要点がすぐに分かり、箇条書きを活用した親しみやすいレイアウトにすること。
`;

      let lastError = null;
      for (const modelName of candidateModels) {
        try {
          model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemInstruction
          });

          // 会話履歴を整形
          const chatHistory = (history || []).slice(-6).map(h => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }]
          }));

          const chat = model.startChat({
            history: chatHistory
          });

          const result = await chat.sendMessage(message);
          aiResponseText = result.response.text();
          if (aiResponseText) break;
        } catch (err) {
          lastError = err;
          console.warn(`Model ${modelName} failed, trying next...`, err);
        }
      }

      if (!aiResponseText) {
        throw lastError || new Error('All models failed');
      }

      // [ACTION: ラベル, URL] タグを抽出
      const actionLinks: Array<{ label: string; url: string }> = [];
      const actionRegex = /\[ACTION:\s*([^,]+?)\s*,\s*([^\]]+?)\s*\]/g;
      let match;
      while ((match = actionRegex.exec(aiResponseText)) !== null) {
        actionLinks.push({
          label: match[1].trim(),
          url: match[2].trim(),
        });
      }

      // 本文からタグをクリーンアップ（またはそのまま自然に読めるように整形）
      const cleanReply = aiResponseText.replace(actionRegex, '').trim();

      return NextResponse.json({
        reply: cleanReply,
        actionLinks,
        source: 'gemini'
      });

    } catch (aiErr: any) {
      console.warn('Gemini API execution error, switching to fallback:', aiErr);
      const fallback = getFallbackResponse(message, companyName, farmCode, tenantId);
      return NextResponse.json({
        reply: fallback.reply,
        actionLinks: fallback.actionLinks || [],
        source: 'fallback_after_error'
      });
    }

  } catch (error: any) {
    console.error('AI Assistant API Fatal Error:', error);
    return NextResponse.json(
      { error: `案内ボットの処理中にエラーが発生しました: ${error.message}` },
      { status: 500 }
    );
  }
}
