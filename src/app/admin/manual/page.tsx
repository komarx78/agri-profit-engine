"use client";

import React, { useState } from 'react';
import { BookOpen, UserPlus, Map, PackageOpen, Sprout, ClipboardList, Smartphone, Receipt, TrendingUp, AlertCircle, ArrowRight, CheckCircle2, RefreshCw, LayoutDashboard, MapPin, Pointer } from 'lucide-react';

export default function ManualPage() {
  const [activeTab, setActiveTab] = useState<number>(0);

  const ImagePlaceholder = ({ src, alt, filename }: { src: string, alt: string, filename: string }) => {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden border-2 border-slate-200 shadow-sm bg-slate-50 group">
        <img 
          src={src} 
          alt={alt}
          className="w-full h-auto object-cover"
          onError={(e) => {
            const target = e.currentTarget;
            target.onerror = null; 
            target.src = `https://placehold.co/800x450/f8fafc/94a3b8?text=Image+Not+Found%5CnPlease+save+[+${filename}+]+in+public/manual/`;
          }}
        />
        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
          画像ファイル名: {filename}
        </div>
      </div>
    );
  };

  const steps = [
    { id: 0, title: '画面の見方 (メニュー)', icon: LayoutDashboard },
    { id: 1, title: '作付地図で圃場登録', icon: MapPin },
    { id: 2, title: 'その他の初期設定', icon: UserPlus },
    { id: 3, title: '栽培計画を立てる', icon: Sprout },
    { id: 4, title: '現場からスマホ入力', icon: Smartphone },
    { id: 5, title: '月ごとの経費入力', icon: Receipt },
    { id: 6, title: '利益の確認・分析', icon: TrendingUp },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 pt-4 sm:pt-6">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 flex items-center gap-3 mb-2">
          <BookOpen className="w-8 h-8 text-emerald-600" />
          ご利用スタートガイド
        </h1>
        <p className="text-slate-500 font-medium">
          「どの畑で・どの作物を育てると・いくら儲かるのか」を正確に把握するためのステップです。<br className="hidden sm:block" />
          パソコンやスマートフォンが苦手な方でも、この順序通りに進めれば簡単に使い始めることができます！
        </p>
      </div>

      <div className="flex overflow-x-auto pb-4 mb-6 hide-scrollbar gap-2 snap-x">
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = activeTab === step.id;
          return (
            <button
              key={step.id}
              onClick={() => setActiveTab(step.id)}
              className={`flex-shrink-0 snap-start flex items-center gap-2 px-5 py-4 rounded-2xl font-bold transition-all border-2 ${
                isActive 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' 
                  : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50 hover:border-slate-200'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {step.id}
              </div>
              <span className="whitespace-nowrap">{step.title}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* === STEP 0: メニュー早見表 === */}
        {activeTab === 0 && (
          <div className="space-y-8">
            <div className="border-b border-slate-100 pb-6">
              <h2 className="text-2xl font-black text-slate-800 mb-2">画面の見方（左メニュー早見表）</h2>
              <p className="text-slate-600 text-lg">
                管理画面の左側にあるメニューは、大きく分けて4つのグループに分かれています。<br/>
                「どこで何ができるか」を一覧で確認しておきましょう。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* 計画・予実管理 */}
              <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 h-full">
                <h3 className="font-bold text-lg text-emerald-800 border-b border-emerald-200 pb-2 mb-3">🌱 計画・予実管理</h3>
                <ul className="space-y-2 text-sm text-emerald-900 leading-relaxed">
                  <li><strong className="text-emerald-700">ダッシュボード:</strong> 農場全体の状況や利益サマリーを確認します。</li>
                  <li><strong className="text-emerald-700">作付地図:</strong> 地図上で畑の状況を確認・新しい畑を登録できます。</li>
                  <li><strong className="text-emerald-700">栽培・予実管理表:</strong> 栽培計画を作成し、利益分析を行います。</li>
                  <li><strong className="text-emerald-700">育苗スケジュール:</strong> 種まきから定植までの苗のスケジュールを管理します。</li>
                  <li><strong className="text-emerald-700">必要資材自動集計:</strong> 今後必要になる肥料や農薬の量を予測計算します。</li>
                </ul>
              </div>

              {/* 売上・経費管理 */}
              <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 h-full">
                <h3 className="font-bold text-lg text-blue-800 border-b border-blue-200 pb-2 mb-3">💰 売上・経費管理</h3>
                <ul className="space-y-2 text-sm text-blue-900 leading-relaxed">
                  <li><strong className="text-blue-700">出荷記録一覧:</strong> 過去の売上履歴の確認と編集を行います。</li>
                  <li><strong className="text-blue-700">請求書一括発行:</strong> 取引先への請求書を自動作成します。</li>
                  <li><strong className="text-blue-700">資材購入・直接経費:</strong> 現場でその都度発生した経費（買い物など）を入力します。</li>
                  <li><strong className="text-blue-700">月次全体経費(按分用):</strong> 電気代など、全体にかかる月ごとの経費を入力します。</li>
                  <li><strong className="text-blue-700">会計データ出力:</strong> 確定申告などに使うためのデータをダウンロードします。</li>
                </ul>
              </div>

              {/* 作業履歴・記録 */}
              <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 h-full">
                <h3 className="font-bold text-lg text-amber-800 border-b border-amber-200 pb-2 mb-3">📝 作業履歴・記録</h3>
                <ul className="space-y-2 text-sm text-amber-900 leading-relaxed">
                  <li><strong className="text-amber-700">作業記録一覧:</strong> スマホから入力された記録の確認と修正を行います。</li>
                  <li><strong className="text-amber-700">QRコード一覧:</strong> 現場でスキャンするためのQRコードを印刷できます。</li>
                </ul>
              </div>

              {/* 各種設定 */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 h-full">
                <h3 className="font-bold text-lg text-slate-800 border-b border-slate-200 pb-2 mb-3">⚙️ 各種設定</h3>
                <ul className="space-y-2 text-sm text-slate-700 leading-relaxed">
                  <li><strong className="text-slate-900">各種マスタ管理:</strong> 作物、作業者、資材などの基本データを登録・修正します。</li>
                  <li><strong className="text-slate-900">出荷先・メール設定:</strong> 請求書を送る取引先やメールの設定を行います。</li>
                  <li><strong className="text-slate-900">自社情報設定:</strong> 農場名や住所などの基本情報を設定します。</li>
                </ul>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-slate-100 mt-8">
              <button onClick={() => setActiveTab(1)} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors">
                ステップ1に進む <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* === STEP 1: 作付地図で圃場登録 === */}
        {activeTab === 1 && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="border-b border-slate-100 pb-6">
              <h2 className="text-2xl font-black text-slate-800 mb-2">【ステップ1】 作付地図で圃場（畑・ハウス）を登録しよう</h2>
              <p className="text-slate-600 text-lg">
                Googleマップの航空写真を使って、持っている畑やビニールハウスを直感的に登録します。<br/>
                自分の畑を地図上で囲むだけで、面積が自動計算されます！
              </p>
            </div>

            <div className="space-y-8">
              <div className="bg-emerald-50 p-5 sm:p-8 rounded-3xl border border-emerald-100">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  <div>
                    <h3 className="font-bold text-xl text-emerald-900 flex items-center gap-2 mb-3">
                      <MapPin className="w-6 h-6 text-emerald-600" /> 1. 地図を開いて畑を追加する
                    </h3>
                    <p className="text-emerald-800 leading-relaxed mb-4">
                      左メニューの**「作付地図」**を開きます。<br/>
                      左側には圃場の一覧、右側には航空写真が表示されます。<br/><br/>
                      地図の左上にある <strong className="bg-white px-2 py-1 rounded border border-emerald-200">＋ 地図に畑を追加</strong> ボタンを押します。
                    </p>
                  </div>
                  <div>
                    <ImagePlaceholder src="/manual/step1-map1.png" alt="作付地図画面" filename="step1-map1.png" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-5 sm:p-8 rounded-3xl border border-slate-100">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  <div>
                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2 mb-3">
                      <Pointer className="w-6 h-6 text-emerald-600" /> 2. 地図をクリックして畑を囲む
                    </h3>
                    <p className="text-slate-600 leading-relaxed mb-4">
                      航空写真を見ながら、自分の畑の角（カド）を順番にポチポチとクリックしていきます。
                    </p>
                    <div className="p-3 bg-amber-50 rounded-xl text-sm text-amber-800 border border-amber-200 mb-4">
                      <strong className="flex items-center gap-1 mb-1"><CheckCircle2 className="w-4 h-4" /> 面積の自動計算！（重要）</strong>
                      畑を囲んでいくと、右上に**「現在の面積: 〇〇 a」**と表示され、システムが自動で正確な面積（アール: a）を計算してくれます。メジャーで測る必要はありません！<br/><br/>
                      <strong>この面積をもとに、あとで経費が自動的に各畑へ割り振られます。</strong>
                    </div>
                    <p className="text-slate-500 text-xs">※地図を使わず、リストから直接手動で面積を入力して登録したい場合は、左メニューの「各種マスタ管理」からも行えます。</p>
                  </div>
                  <div className="space-y-4">
                    <ImagePlaceholder src="/manual/step1-map2.png" alt="描画ボタン" filename="step1-map2.png" />
                    <ImagePlaceholder src="/manual/step1-map3.png" alt="描画中の画面" filename="step1-map3.png" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between pt-4 border-t border-slate-100 mt-8">
              <button onClick={() => setActiveTab(0)} className="text-slate-500 font-bold px-4 py-2 hover:bg-slate-50 rounded-lg transition-colors">戻る</button>
              <button onClick={() => setActiveTab(2)} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors">
                次のステップへ <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* === STEP 2: その他の初期設定 === */}
        {activeTab === 2 && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="border-b border-slate-100 pb-6">
              <h2 className="text-2xl font-black text-slate-800 mb-2">【ステップ2】 その他の初期設定（基本データの登録）</h2>
              <p className="text-slate-600 text-lg">
                圃場の登録が終わったら、残りの基本データを登録しましょう。<br/>
                左メニューから **「各種マスタ管理」** を開いてください。
              </p>
            </div>

            <div className="space-y-8">
              <div className="bg-slate-50 p-5 sm:p-8 rounded-3xl border border-slate-100">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  <div>
                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2 mb-3">
                      <Sprout className="w-6 h-6 text-emerald-600" /> 1. 作目（育てる作物）を登録しよう
                    </h3>
                    <p className="text-slate-600 leading-relaxed mb-4">
                      キャベツやトマトなど、育てる作物を登録します。<br/>
                      <strong className="text-emerald-700">ポイント:</strong> 「10aあたりの概算経費（予算）」を設定しておくと、システムが自動で経費予測をしてくれます。
                    </p>
                  </div>
                  <div>
                    <ImagePlaceholder src="/manual/step2-1.png" alt="作目登録" filename="step2-1.png" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-5 sm:p-8 rounded-3xl border border-slate-100">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  <div>
                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2 mb-3">
                      <UserPlus className="w-6 h-6 text-emerald-600" /> 2. 作業者を登録しよう
                    </h3>
                    <p className="text-slate-600 leading-relaxed mb-4">
                      一緒に働く従業員さんや、あなた自身を登録します。<br/>
                      <strong className="text-emerald-700">ポイント:</strong> 「時給」や「現場で使う4桁のPINコード」を設定します。家族経営の場合でも、あなた自身の仮想時給を設定しておくと、正確な人件費が計算できます。
                    </p>
                  </div>
                  <div>
                    <ImagePlaceholder src="/manual/step2-2.png" alt="作業者登録" filename="step2-2.png" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-5 sm:p-8 rounded-3xl border border-slate-100">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  <div>
                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2 mb-3">
                      <PackageOpen className="w-6 h-6 text-emerald-600" /> 3. 資材・農薬と販売価格を登録しよう
                    </h3>
                    <p className="text-slate-600 leading-relaxed mb-4">
                      <strong>【資材・農薬】</strong> よく使う肥料や梱包材の「購入金額」を登録しておくと、現場で「1キロ使った」と入力するだけで自動計算されます。<br/><br/>
                      <strong>【販売価格】</strong> 出荷先ごと（JA、直売所など）の販売単価を登録しておくと、出荷記録を入力した際の売上が自動計算されます。
                    </p>
                  </div>
                  <div>
                    <ImagePlaceholder src="/manual/step2-3.png" alt="資材と販売価格" filename="step2-3.png" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between pt-4 border-t border-slate-100 mt-8">
              <button onClick={() => setActiveTab(1)} className="text-slate-500 font-bold px-4 py-2 hover:bg-slate-50 rounded-lg transition-colors">戻る</button>
              <button onClick={() => setActiveTab(3)} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors">
                次のステップへ <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* === STEP 3 === */}
        {activeTab === 3 && (
          <div className="space-y-8">
            <div className="border-b border-slate-100 pb-6">
              <h2 className="text-2xl font-black text-slate-800 mb-2">【ステップ3】 栽培計画を立てよう</h2>
              <p className="text-slate-600 text-lg">
                基本データの登録が終わったら、いよいよ「今年の計画」を立てます。<br/>
                左メニューの **「栽培・予実管理表」** をクリックしてください。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="space-y-6">
                <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
                  <h3 className="font-bold text-lg text-emerald-800 flex items-center gap-2 mb-3">
                    <ClipboardList className="w-5 h-5" /> 新しい計画を作成する
                  </h3>
                  <ol className="list-decimal ml-5 space-y-3 text-slate-700 font-medium">
                    <li>画面右上の <strong className="text-emerald-700">「新規計画を作成」</strong> ボタンを押します。</li>
                    <li>「どの畑で」育てるかを選びます。</li>
                    <li>「どの作物を」育てるかを選びます。</li>
                    <li>「いつからいつまで」育てるのかを選んで保存します。</li>
                  </ol>
                  <div className="mt-4 p-3 bg-white rounded-xl text-sm text-slate-600 border border-emerald-100 shadow-sm mb-3">
                    <strong className="text-amber-600 flex items-center gap-1 mb-1"><CheckCircle2 className="w-4 h-4" /> ここが便利！</strong>
                    これだけで、ステップで登録したデータをもとに、「売上の目標」や「かかるであろう経費の予算」が自動で計算され、グラフが完成します！
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 border border-amber-200">
                    <strong className="flex items-center gap-1 mb-1"><AlertCircle className="w-4 h-4" /> TIPS（便利な小技）</strong>
                    作付地図画面で、マップ上の「畑」をクリックして、そこから直接計画を作成することも可能です。
                  </div>
                </div>
              </div>
              <div className="sticky top-20">
                <ImagePlaceholder 
                  src="/manual/step2.png" 
                  alt="栽培計画作成画面" 
                  filename="step2.png" 
                />
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100 mt-8">
              <button onClick={() => setActiveTab(2)} className="text-slate-500 font-bold px-4 py-2 hover:bg-slate-50 rounded-lg transition-colors">戻る</button>
              <button onClick={() => setActiveTab(4)} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors">
                次のステップへ <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* === STEP 4 === */}
        {activeTab === 4 && (
          <div className="space-y-8">
            <div className="border-b border-slate-100 pb-6">
              <h2 className="text-2xl font-black text-slate-800 mb-2">【ステップ4】 日常の記録（現場からスマホで入力！）</h2>
              <p className="text-slate-600 text-lg">
                ここからは、毎日の作業記録です。これは農場（現場）からスマートフォンで簡単に入力できます。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="space-y-6">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-2">
                    <Smartphone className="w-5 h-5 text-emerald-600" /> 1. 従業員用画面を開く
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    管理者用画面左下にある「従業員URLコピー」を押して、LINEなどで従業員のスマホに送って開いてもらいます。<br/>
                    自分の名前を選び、ステップで決めた **「4桁のPINコード」** を入力してログインします。
                  </p>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-2">
                    <ClipboardList className="w-5 h-5 text-emerald-600" /> 2. 作業や収穫を記録する
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-3">
                    <strong>【作業記録】</strong> 「どの畑で」「何時間」「どんな作業をしたか」を記録します。肥料や農薬を使った場合は「何キロ使ったか」も入力します。<br/>
                    <strong>【出荷記録】</strong> 野菜が採れて出荷したら「いくつ出荷したか」「いくらで売れたか」を入力します。
                  </p>
                  <div className="p-3 bg-amber-50 rounded-xl text-sm text-amber-800 border border-amber-200">
                    <strong className="flex items-center gap-1 mb-1"><AlertCircle className="w-4 h-4" /> なぜ記録するの？</strong>
                    これを毎日続けることで、システムが自動的に「いま、この畑は儲かっているか？人件費がかかりすぎていないか？」を正確に計算し続けてくれます。
                  </div>
                </div>
              </div>
              <div className="sticky top-20 flex gap-4">
                <div className="flex-1">
                  <ImagePlaceholder src="/manual/step3-1.png" alt="スマホログイン画面" filename="step3-1.png" />
                  <p className="text-xs text-slate-400 text-center mt-2">ログイン画面</p>
                </div>
                <div className="flex-1">
                  <ImagePlaceholder src="/manual/step3-2.png" alt="スマホ入力画面" filename="step3-2.png" />
                  <p className="text-xs text-slate-400 text-center mt-2">入力画面</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100 mt-8">
              <button onClick={() => setActiveTab(3)} className="text-slate-500 font-bold px-4 py-2 hover:bg-slate-50 rounded-lg transition-colors">戻る</button>
              <button onClick={() => setActiveTab(5)} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors">
                次のステップへ <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* === STEP 5 === */}
        {activeTab === 5 && (
          <div className="space-y-8">
            <div className="border-b border-slate-100 pb-6">
              <h2 className="text-2xl font-black text-slate-800 mb-2">【ステップ5】 月に1回の経費入力</h2>
              <p className="text-slate-600 text-lg">
                請求書が届いたら入力します。電気代、ハウスの燃料代、トラクターのガソリン代など、「農場全体にかかったお金」を月に1回入力します。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="space-y-6">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-3">
                    <Receipt className="w-5 h-5 text-emerald-600" /> 対象月を選んで金額を入力
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-4">
                    左メニューの **「月次全体経費の入力」** をクリックします。<br/>
                    該当する月の「動力光熱費」「機械・車両費」「その他経費」の合計金額を入力して保存します。
                  </p>
                  
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <h4 className="font-black text-emerald-800 flex items-center gap-2 mb-2">
                      ✨ 魔法の自動計算システム
                    </h4>
                    <p className="text-sm text-emerald-700 leading-relaxed">
                      ここに金額を入力すると、システムが自動的に「いま稼働している畑の面積」に合わせて、<strong>経費をそれぞれの畑のレポートに公平に割り振ってくれます。</strong><br/>
                      あなたが面倒な電卓叩きをする必要はありません！
                    </p>
                  </div>
                </div>
              </div>
              <div className="sticky top-20">
                <ImagePlaceholder 
                  src="/manual/step4.png" 
                  alt="月次経費入力画面" 
                  filename="step4.png" 
                />
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100 mt-8">
              <button onClick={() => setActiveTab(4)} className="text-slate-500 font-bold px-4 py-2 hover:bg-slate-50 rounded-lg transition-colors">戻る</button>
              <button onClick={() => setActiveTab(6)} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors">
                最後のステップへ <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* === STEP 6 === */}
        {activeTab === 6 && (
          <div className="space-y-8">
            <div className="border-b border-slate-100 pb-6">
              <h2 className="text-2xl font-black text-slate-800 mb-2">【ステップ6】 利益を確認し、次につなげよう！</h2>
              <p className="text-slate-600 text-lg">
                1ヶ月の終わりや、栽培が終わったタイミングで、左メニューの **「栽培・予実管理表」** を見てみましょう。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="space-y-6">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-emerald-600" /> 分析タブを見る
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-4">
                    計画をクリックして「分析」タブを開くと、以下のことが一目でわかります。
                  </p>
                  <ul className="space-y-2 text-sm text-slate-700 font-bold bg-white p-4 rounded-xl border border-slate-200">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 利益: 最終的にいくら手元に残ったか（儲かったか）</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 時給換算: 作業時間に対して、実質時給いくらになったか</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 経費の内訳: 何に一番お金がかかっているか</li>
                  </ul>
                </div>

                <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
                  <h3 className="font-bold text-lg text-amber-800 mb-2 flex items-center gap-2">
                    💡 次の計画に活かす
                  </h3>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    「Aの畑のキャベツは儲かったけど、Bの畑のトマトは人件費がかかりすぎて赤字だった」といったことがデータとしてハッキリわかります。<br/><br/>
                    これをもとに、「来年はトマトの作業を効率化しよう」「キャベツの面積を増やそう」といった、<strong>強い農業経営のための作戦</strong> を立てることができます！
                  </p>
                </div>
              </div>
              <div className="sticky top-20">
                <ImagePlaceholder 
                  src="/manual/step5.png" 
                  alt="分析画面" 
                  filename="step5.png" 
                />
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100 mt-8">
              <button onClick={() => setActiveTab(5)} className="text-slate-500 font-bold px-4 py-2 hover:bg-slate-50 rounded-lg transition-colors">戻る</button>
              <button onClick={() => setActiveTab(1)} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm">
                最初に戻る <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}