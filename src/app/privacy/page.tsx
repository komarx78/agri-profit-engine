import React from 'react';

export const metadata = {
  title: 'プライバシーポリシー | agri-profit',
  description: 'agri-profit（農業経営・作業管理システム）における個人情報保護方針・プライバシーポリシー',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10">
        <div className="mb-8 pb-6 border-b border-slate-200">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-3">
            個人情報保護方針 / Privacy Policy
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            プライバシーポリシー（個人情報保護方針）
          </h1>
          <p className="mt-3 text-slate-600 text-sm sm:text-base">
            アプリケーション「agri-profit」（以下「本アプリ・本サービス」といいます）は、契約農園およびその従業員・スタッフ等の利用者（以下「ユーザー」といいます）の個人情報および農業経営・作業データの保護を最重要責務と認識し、個人情報の保護に関する法律（個人情報保護法）ならびにGoogle Playデベロッパープログラムポリシーを遵守し、以下の通りプライバシーポリシーを定めます。
          </p>
        </div>

        <div className="space-y-8 text-slate-700 text-sm sm:text-base leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-emerald-600 rounded-full inline-block"></span>
              1. 取得する情報と利用目的
            </h2>
            <p className="mb-2">
              本サービスでは、契約農園における労務管理・栽培管理・出荷管理・経営分析業務を遂行するため、以下の情報を取得・利用いたします。
            </p>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 text-sm">
              <div>
                <p className="font-bold text-slate-900">① アカウント・本人確認情報</p>
                <p className="text-slate-600">氏名、メールアドレス、電話番号、所属農園・役職情報、給与・労務設定情報（ログイン認証、勤怠集計、給与計算連動、業務連絡のため）</p>
              </div>
              <div>
                <p className="font-bold text-slate-900">② 勤怠・作業・栽培記録データ</p>
                <p className="text-slate-600">出退勤打刻時刻、休憩時間、作業日報、農薬・肥料の使用履歴、収穫・出荷記録、売上・経費データ（生産履歴管理、GAP対応帳票出力、圃場別収益分析のため）</p>
              </div>
              <div>
                <p className="font-bold text-slate-900">③ 端末機能（カメラ・マイク・位置情報）へのアクセス</p>
                <ul className="list-disc pl-5 mt-1 text-slate-600 space-y-1">
                  <li><strong>カメラ・画像ファイル</strong>：作業写真、圃場・生育状況の写真、納品書・伝票・農薬ラベル等の撮影およびAI自動読取（OCR）機能のためにのみ使用します。</li>
                  <li><strong>マイク（音声入力）</strong>：現場での作業日誌・メモの音声テキスト変換入力のためにのみ使用します。</li>
                  <li><strong>位置情報（GPS）</strong>：圃場（畑）の区画登録、打刻・作業場所の確認、および圃場周辺の気象データ取得のためにのみ使用します。バックグラウンドでの無断追跡は行いません。</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-emerald-600 rounded-full inline-block"></span>
              2. データの暗号化・安全管理措置とマルチテナント分離
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>通信および保存データの暗号化</strong>：本サービスにおけるすべての通信はSSL/TLS（HTTPS）により暗号化されて送信されます。また、データベース上のパスワードおよび機密情報は暗号化されて安全に保管されます。</li>
              <li><strong>マルチテナント完全分離（RLS制御）</strong>：登録されたすべてのデータは契約農園（テナント識別子）ごとにデータベースレベルで厳格に分離されており、権限を持たない第三者や他の契約農園から閲覧・参照されることは一切ありません。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-emerald-600 rounded-full inline-block"></span>
              3. 第三者提供の禁止および共同管理・外部サービスの利用
            </h2>
            <p className="mb-2">
              当運営者は、法令に基づく場合または人の生命・財産の保護のために緊急の必要がある場合を除き、ユーザーの同意なく個人情報を第三者に提供・売却・貸与することはありません。なお、本アプリの提供・保守および契約サポートのため、開発・システム運営元である株式会社KAPおよび販売・導入支援元である株式会社G.Gの間において、厳格な機密保持契約のもとでサポートに必要な範囲に限り情報を連携する場合があります。また、システム基盤として以下の高セキュリティな外部クラウドサービスを利用しています。
            </p>
            <ul className="list-disc pl-6 space-y-1 text-sm text-slate-600">
              <li><strong>Supabase / Vercel</strong>：データベース保管およびアプリケーション配信基盤（暗号化通信・アクセス制御適用）</li>
              <li><strong>LINE Messaging API</strong>：契約農園が設定した場合の未退勤リマインド・業務通知配信</li>
              <li><strong>Google Cloud / Gemini API</strong>：伝票・農薬ラベル等の画像文字読取および栽培データ解析補助（個人を特定する学習目的での二次利用は行われません）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-emerald-600 rounded-full inline-block"></span>
              4. 広告配信およびトラッキングについて
            </h2>
            <p>
              本アプリには第三者による広告表示は一切含まれておらず、広告目的での行動追跡（トラッキング）や広告IDの収集・販売は一切行いません。セッション維持（ログイン状態の保持）のために必要な最小限のCookie・ローカルストレージのみを使用します。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-emerald-600 rounded-full inline-block"></span>
              5. アカウントおよびデータの削除方法（データ保持と消去）
            </h2>
            <p className="mb-2">
              ユーザーはいつでも自身のアカウントおよび関連する個人データの開示・訂正・利用停止・削除（消去）を求めることができます。
            </p>
            <ul className="list-disc pl-6 space-y-1 text-sm text-slate-600">
              <li><strong>従業員・スタッフアカウントの削除</strong>：所属する契約農園の管理者画面（人事・スタッフ管理メニュー）から即時削除・無効化が可能です。</li>
              <li><strong>農園アカウント全体および全データの完全削除</strong>：管理画面または下記お問い合わせ窓口へ削除をご申請いただくことで、法令上保存が義務付けられている帳票データを除き、速やか（原則30日以内）にサーバーから完全消去いたします。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-emerald-600 rounded-full inline-block"></span>
              6. 改定および運営・お問い合わせ窓口
            </h2>
            <p className="mb-3">
              法令の改正やサービス機能の追加に伴い、本ポリシーを改定する場合があります。重要な変更がある場合は本ページおよびアプリ内にて通知いたします。本ポリシーに関するご質問、データの開示・削除請求は以下までご連絡ください。
            </p>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-sm space-y-1.5">
              <p><strong>サービス名称</strong>：agri-profit</p>
              <p><strong>システム開発・運営主体（アプリ提供元）</strong>：株式会社KAP</p>
              <p><strong>販売・導入サポート元</strong>：株式会社G.G</p>
              <p><strong>お問い合わせ窓口</strong>：システム管理画面内のお問い合わせ窓口、または株式会社G.G ／ 株式会社KAP（agri-profit 運営事務局）までご連絡ください。</p>
            </div>
          </section>

          <div className="pt-6 border-t border-slate-200 flex flex-wrap justify-between items-center text-xs text-slate-500 gap-2">
            <span>制定日：2026年10月18日</span>
            <span>最終改定日：2026年10月18日</span>
          </div>
        </div>
      </div>
    </div>
  );
}
