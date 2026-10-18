import React from 'react';

export const metadata = {
  title: 'プライバシーポリシー | アグリ現場 - 農業収益エンジン',
  description: 'アグリ現場（農業収益エンジン）における個人情報保護方針・プライバシーポリシー',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6 pb-4 border-b border-slate-200">
          プライバシーポリシー（個人情報保護方針）
        </h1>

        <div className="space-y-6 text-slate-700 text-sm sm:text-base leading-relaxed">
          <p>
            本アプリケーション「アグリ現場（農業収益エンジン）」（以下「本サービス」といいます）は、利用者の個人情報および農業経営・作業データの保護を最重要責務と認識し、以下の通りプライバシーポリシーを定め、適切な管理と保護に努めます。
          </p>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">1. 取得する情報および利用目的</h2>
            <p>本サービスでは、契約農園およびその従業員・スタッフによる業務遂行のため、以下の情報を取得・利用いたします。</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>氏名、メールアドレス、電話番号等のアカウント識別情報（ログイン認証および業務連絡のため）</li>
              <li>出退勤時刻、作業日報、栽培記録、圃場位置情報、作業写真（勤怠管理、労務管理、生産履歴記録のため）</li>
              <li>出荷・売上・経費・資材在庫に関する経営データ（収益分析および帳票出力のため）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">2. データの管理とマルチテナント分離</h2>
            <p>
              本サービスに登録されたすべてのデータは、契約農園（テナント）ごとに厳格に分離・暗号化して保管され、権限を持たない第三者や他農園から閲覧されることはありません。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">3. 第三者提供の禁止</h2>
            <p>
              法令に基づく場合を除き、利用者の同意なく個人情報を第三者に提供・開示することはありません。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">4. データの削除・お問い合わせ</h2>
            <p>
              アカウントの削除、登録データの開示・訂正・削除のご請求、その他プライバシーに関するお問い合わせは、各契約農園の管理者または本サービス運営窓口までご連絡ください。
            </p>
          </section>

          <div className="pt-6 border-t border-slate-200 text-xs text-slate-500">
            制定日：2026年10月18日
          </div>
        </div>
      </div>
    </div>
  );
}
