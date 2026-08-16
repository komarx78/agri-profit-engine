"use client";

import React, { useState } from 'react';
import { BookOpen, UserPlus, Map, PackageOpen, Sprout, ClipboardList, Smartphone, Receipt, TrendingUp, AlertCircle, ArrowRight, CheckCircle2, RefreshCw, LayoutDashboard, MapPin, Pointer, Banknote, FileSpreadsheet, Sparkles, Globe, Camera, Video } from 'lucide-react';

export default function ManualPage() {
  const [activeTab, setActiveTab] = useState<number>(1);

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
    { id: 1, title: '作付地図で圃場登録', icon: MapPin },
    { id: 2, title: 'その他の初期設定', icon: UserPlus },
    { id: 3, title: '栽培計画を立てる', icon: Sprout },
    { id: 4, title: '現場からスマホ入力', icon: Smartphone },
    { id: 5, title: '月ごとの経費入力', icon: Receipt },
    { id: 6, title: '利益の確認・分析', icon: TrendingUp },
    { id: 0, title: '補足: 画面の見方', icon: LayoutDashboard },
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
            
            <div className="flex justify-end pt-4 border-t border-slate-100 mt-8">
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
              
              {/* 自動多言語翻訳のハイライト */}
              <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
                <Globe className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed">
                  <strong className="text-emerald-800 font-bold block mb-0.5">✨ AIが多言語に自動翻訳！</strong>
                  作目名・圃場名・資材名を日本語で登録するだけで、システムが自動的に <strong>英語・ベトナム語・インドネシア語・中国語</strong> に翻訳して保存します。外国人技能実習生や特定技能のスタッフも、母国語で現場入力が可能になります。
                </div>
              </div>
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
                      <PackageOpen className="w-6 h-6 text-emerald-600" /> 3. 資材・農薬を登録しよう
                    </h3>
                    <p className="text-slate-600 leading-relaxed mb-4">
                      よく使う肥料や農薬、マルチ・ダンボール等の梱包材の「購入単価」や「単位」を登録します。<br/>
                      <strong className="text-emerald-700">ポイント:</strong> 現場の入力画面で「1袋使った」「2本使った」と選ぶだけで、資材費が自動計算されます。
                    </p>
                  </div>
                  <div>
                    <ImagePlaceholder src="/manual/step2-3.png" alt="資材・農薬登録" filename="step2-3.png" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-5 sm:p-8 rounded-3xl border border-slate-100">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  <div>
                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2 mb-3">
                      <Banknote className="w-6 h-6 text-emerald-600" /> 4. 販売価格を登録しよう
                    </h3>
                    <p className="text-slate-600 leading-relaxed mb-3">
                      出荷先ごと（JA、直売所、各スーパーなど）の作目ごとの販売単価を設定します。<br/>
                      出荷記録を入力した際に売上金額が自動計算されるようになります。
                    </p>
                    <div className="space-y-2 bg-white p-4 rounded-2xl border border-slate-200 text-sm mb-2 shadow-sm">
                      <div className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> 便利な機能
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-600 list-disc ml-4">
                        <li>
                          <strong className="text-slate-700">「作目別」「販路別」の切り替え:</strong> 右上のボタンで、作物ごとに各出荷先の単価を見比べる「作目別」と、出荷先ごとに納品商品の一覧を見る「販路別」をいつでも切り替えられます。
                        </li>
                        <li>
                          <strong className="text-slate-700">「販路から一括コピー」:</strong> 新しい出荷先が増えた際も、既存の価格設定を丸ごとコピーして一瞬で設定できます。
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div>
                    <ImagePlaceholder src="/manual/step2-4.png" alt="販売価格登録" filename="step2-4.png" />
                  </div>
                </div>
              </div>

              {/* CSV一括登録の解説 */}
              <div className="bg-emerald-50/50 p-5 sm:p-8 rounded-3xl border-2 border-dashed border-emerald-200">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white text-xs font-black rounded-full mb-3">
                      <Sparkles className="w-3.5 h-3.5" /> 応用・時短テクニック
                    </div>
                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2 mb-3">
                      <FileSpreadsheet className="w-6 h-6 text-emerald-600" /> データが多い時は「CSV一括追加」が便利！
                    </h3>
                    <p className="text-slate-600 leading-relaxed mb-4 text-sm">
                      登録する作目・圃場・資材・販売単価がたくさんある場合は、Excel等を使ってまとめて一気に登録することができます。
                    </p>

                    <div className="space-y-2.5 bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm text-sm">
                      <div className="flex items-start gap-2.5 text-slate-700">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
                        <span>各カードの下にある <strong>「雛形DL」</strong> を押して、入力用テンプレート（CSV）をダウンロードします。</span>
                      </div>
                      <div className="flex items-start gap-2.5 text-slate-700">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
                        <span>ダウンロードしたファイルをExcelで開き、資材名や単価などを入力して保存します。</span>
                      </div>
                      <div className="flex items-start gap-2.5 text-slate-700">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
                        <span><strong>「CSVで一括追加」</strong> を押してファイルを選択するだけで、一瞬で登録完了です！</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                      ※ <strong>「データDL」</strong> を押すと、現在登録されているデータをいつでもExcel形式（CSV）でパソコンに保存・バックアップできます。
                    </p>
                  </div>
                  <div>
                    <ImagePlaceholder src="/manual/step2-csv.png" alt="CSV一括追加とデータダウンロード" filename="step2-csv.png" />
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
                    <ClipboardList className="w-5 h-5" /> 栽培計画を作成する手順
                  </h3>
                  <ol className="list-decimal ml-5 space-y-3 text-slate-700 font-medium text-sm leading-relaxed">
                    <li>カレンダー表の中から、計画を立てたい <strong>「畑（圃場）」</strong> と <strong>「開始月」</strong> のマス目にカーソルを合わせます。</li>
                    <li>マス目に表示される <strong className="text-blue-600">「＋」マーク（またはマス目全体）</strong> をクリックします。</li>
                    <li><strong>「育てる作物（作目）」</strong> と <strong>「終了月」</strong> を選択して「保存する」を押します。</li>
                  </ol>
                  <div className="mt-4 p-3.5 bg-white rounded-xl text-xs text-slate-600 border border-emerald-100 shadow-sm space-y-1">
                    <strong className="text-amber-600 flex items-center gap-1 mb-1 font-bold"><CheckCircle2 className="w-4 h-4" /> ここが便利！</strong>
                    <p>保存するだけで、圃場の面積と作物の基準値から <strong>「必要苗数」「資材の予算」「売上目標」</strong> が自動計算され、カレンダー上に計画バーが表示されます。</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-800 border border-blue-200 mt-3 space-y-1">
                    <strong className="flex items-center gap-1 font-bold"><AlertCircle className="w-4 h-4" /> TIPS（便利な小技）</strong>
                    <p>・<strong>作付地図からの作成:</strong> 「作付地図」画面で、マップ上の畑をクリックしてそこから直接計画を立てることもできます。</p>
                    <p>・<strong>詳細・予実の確認:</strong> カレンダー上の計画バーをクリックすると、作業実績や売上、詳細な予実分析グラフを確認・入力できます。</p>
                  </div>
                </div>
              </div>
              <div className="sticky top-20">
                <ImagePlaceholder 
                  src="/manual/step3.png" 
                  alt="栽培計画作成画面" 
                  filename="step3.png" 
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
              <h2 className="text-2xl font-black text-slate-800 mb-2">【ステップ4】 日常の記録（現場からスマホで簡単入力！）</h2>
              <p className="text-slate-600 text-lg">
                毎日の作業や収穫記録を、農場（現場）からスマートフォンで簡単に入力できます。<br/>
                外国人スタッフ向けの多言語対応や、カメラ撮影・写真添付など便利な機能が満載です。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="space-y-6">
                {/* 1. 現場画面と多言語ログイン */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-emerald-600" /> 1. 現場用画面を開いてログイン
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    管理者画面の左下にある <strong>「現場URL（作業者用）」</strong> のコピーボタンを押し、LINEなどでスマホに送ってアクセスします。
                  </p>
                  
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
                    <div className="flex items-center gap-1 text-emerald-700 font-bold">
                      <UserPlus className="w-3.5 h-3.5" /> ログインの手順
                    </div>
                    <ol className="list-decimal ml-4 space-y-1 text-slate-600">
                      <li>作業者一覧から <strong>「自分の名前」</strong> を選択します。</li>
                      <li>【ステップ2】で決めた <strong>「4桁のPINコード（暗証番号）」</strong> を入力してログインします。</li>
                    </ol>
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-blue-700 font-bold">
                      <Globe className="w-4 h-4 text-blue-600 shrink-0" /> 
                      <span>画面右上で言語（🇯🇵日本語・🇺🇸英語・🇻🇳ベトナム語・🇮🇩インドネシア語・🇨🇳中国語）をいつでも切り替え可能です！</span>
                    </div>
                  </div>
                </div>

                {/* 2. スマート入力アシスト機能 */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-emerald-600" /> 2. 作業を記録する（スマート連携）
                  </h3>
                  
                  <div className="space-y-3 text-sm">
                    {/* 圃場と計画の自動連動 */}
                    <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs text-slate-700">
                      <strong className="text-emerald-800 font-bold flex items-center gap-1 mb-1">
                        <Sparkles className="w-4 h-4 text-emerald-600" /> 圃場を選ぶと「進行中の作物」を自動表示！
                      </strong>
                      <p className="leading-relaxed">
                        作業する <strong>「畑（圃場）」</strong> を選ぶと、その畑で今まさに栽培中の作目・品種（ステップ3で立てた計画）が最優先で自動表示されるため、作物を探す手間なくワンタップで選択できます。（※計画外の作業も選択可能）
                      </p>
                    </div>

                    {/* タイマー / 手入力 */}
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-700">
                      <strong className="text-slate-800 font-bold block mb-1">
                        ⏱️ 選べる2つの記録モード
                      </strong>
                      <ul className="space-y-1 list-disc ml-4 text-slate-600">
                        <li><strong>タイマーモード:</strong> 「作業開始」を押すだけで秒単位で自動計測、「作業終了」で自動保存されます。</li>
                        <li><strong>手入力モード:</strong> 「〇〇分作業した」と後からまとめて作業時間を手入力することも可能です。</li>
                      </ul>
                    </div>

                    {/* 写真・動画添付 */}
                    <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 text-xs text-slate-700">
                      <strong className="text-blue-800 font-bold flex items-center gap-1 mb-1">
                        <Camera className="w-4 h-4 text-blue-600" /> 写真や動画の添付機能
                      </strong>
                      <p className="leading-relaxed">
                        カメラアイコンを押すと、スマホのカメラで野菜の生育状況や病害虫、畑の様子を撮影して日報に添付できます（自動圧縮で高速送信）。動画の添付にも対応しています。
                      </p>
                    </div>

                    <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 border border-amber-200 leading-relaxed">
                      <strong className="flex items-center gap-1 mb-0.5 font-bold"><AlertCircle className="w-4 h-4" /> 毎日の記録が経営を強くする！</strong>
                      現場で入力された作業日報や収穫記録をもとに、システムが「畑ごとの利益や実質時給」をリアルタイムに自動計算し続けます。
                    </div>
                  </div>
                </div>
              </div>

              <div className="sticky top-20 flex gap-4">
                <div className="flex-1">
                  <ImagePlaceholder src="/manual/step4-1.png" alt="スマホログイン画面" filename="step4-1.png" />
                  <p className="text-xs text-slate-400 text-center mt-2">ログイン画面（多言語切替）</p>
                </div>
                <div className="flex-1">
                  <ImagePlaceholder src="/manual/step4-2.png" alt="スマホ入力画面" filename="step4-2.png" />
                  <p className="text-xs text-slate-400 text-center mt-2">現場入力画面（計画自動連動・写真添付）</p>
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
                    左メニューの **「月次全体経費(按分用)」** をクリックします。<br/>
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
                  src="/manual/step5.png" 
                  alt="月次経費入力画面" 
                  filename="step5.png" 
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
                  src="/manual/step6.png" 
                  alt="分析画面" 
                  filename="step6.png" 
                />
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100 mt-8">
              <button onClick={() => setActiveTab(5)} className="text-slate-500 font-bold px-4 py-2 hover:bg-slate-50 rounded-lg transition-colors">戻る</button>
              <div className="flex gap-3">
                <button onClick={() => setActiveTab(0)} className="text-slate-600 bg-slate-100 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-200 transition-colors">
                  補足: メニュー早見表へ
                </button>
                <button onClick={() => setActiveTab(1)} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm">
                  最初に戻る <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === STEP 0: メニュー早見表 (補足) === */}
        {activeTab === 0 && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="border-b border-slate-100 pb-6">
              <h2 className="text-2xl font-black text-slate-800 mb-2">【補足】 画面の見方（左メニュー早見表）</h2>
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
            
            <div className="flex justify-between pt-4 border-t border-slate-100 mt-8">
              <button onClick={() => setActiveTab(6)} className="text-slate-500 font-bold px-4 py-2 hover:bg-slate-50 rounded-lg transition-colors">戻る</button>
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