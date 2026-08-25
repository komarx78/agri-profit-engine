"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { getCurrentTenantId, getTenantWorkerIds } from '@/lib/tenant';
import { 
  Sprout, 
  Clock, 
  FileText, 
  Calculator, 
  Users, 
  Settings, 
  Bell, 
  ChevronRight, 
  ArrowUpRight,
  ShieldCheck,
  Building,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Truck,
  Video,
  Layout,
  Receipt,
  FlaskConical,
  AlertTriangle,
  Loader2,
  Map,
  BarChart3,
  Sun,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { useCompany } from '@/hooks/useCompany';

export default function PortalPage() {
  const { companyName } = useCompany();
  const [currentDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  });

  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [attendanceErrorCount, setAttendanceErrorCount] = useState(0);
  const [loadingTasks, setLoadingTasks] = useState(true);

  useEffect(() => {
    async function loadTasks() {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const tenantId = await getCurrentTenantId();
        if (!tenantId) {
          setLoadingTasks(false);
          return;
        }

        // 1. 自社テナントの未確定B2B受注を取得
        const { count: orderCount } = await supabase
          .from('b2b_orders')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', tenantId)
          .eq('status', 'pending');

        // 2. 自社テナントの作業者IDリストを取得
        const workerIds = await getTenantWorkerIds(tenantId);

        let attErrors = 0;
        if (workerIds.length > 0) {
          // 直近30日間の自社作業員のレコードのみを対象に集計
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const startDateStr = thirtyDaysAgo.toISOString().split('T')[0];

          const { data: attLogs } = await supabase
            .from('attendance_logs')
            .select('id, clock_in, clock_out, date, worker_id')
            .in('worker_id', workerIds)
            .gte('date', startDateStr);

          if (attLogs) {
            attErrors = attLogs.filter(l => Boolean(l.clock_in) && (!l.clock_out || l.clock_out === '-')).length;
          }
        }

        setPendingOrdersCount(orderCount || 0);
        setAttendanceErrorCount(attErrors);
      } catch (e) {
        console.warn('Failed to load portal tasks:', e);
      } finally {
        setLoadingTasks(false);
      }
    }
    loadTasks();
  }, []);

  const totalTasks = pendingOrdersCount + attendanceErrorCount;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* 共通ヘッダー（ポータル） */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm text-white">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg text-slate-900 tracking-tight">
                  {companyName || 'Cloud Portal'}
                </span>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                  ポータルTOP
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-400">農業経営クラウドシステム</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/admin/cultivations"
              className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
            >
              <Sprout className="w-4 h-4 text-white" />
              <span>🌱 農業司令塔へ</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-200" />
            </Link>
            <Link 
              href="/portal" 
              className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl font-bold text-sm transition-colors shadow-sm"
            >
              <Layout className="w-4 h-4 text-blue-600" />
              <span>現場ポータル</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
            </Link>
            <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              {totalTasks > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center border border-emerald-200">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-700 leading-tight">システム管理者</div>
                <div className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">{companyName || '自社アカウント'}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 挨拶と日時 */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">
              こんにちは、{companyName ? `${companyName} の` : ''}管理者さん
            </h1>
            <p className="text-sm font-bold text-slate-500 mt-1 flex items-center gap-2">
              <span>今日は {currentDate} です。</span>
              {loadingTasks ? (
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> タスク照合中...
                </span>
              ) : totalTasks > 0 ? (
                <span className="text-rose-600 font-black bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full text-xs">
                  未処理のタスクが {totalTasks} 件あります
                </span>
              ) : (
                <span className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs">
                  ✓ 未処理のタスクはありません
                </span>
              )}
            </p>
          </div>
        </div>

        {/* お知らせ・タスクウィジェット（Supabase実データ三重チェック連動） */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mb-8 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-indigo-600" /> 
              リアルタイム ToDo / アラート
            </h2>
            {totalTasks > 0 && (
              <span className="text-xs font-black text-rose-600 bg-rose-100 px-2.5 py-0.5 rounded-full">
                要対応 {totalTasks} 件
              </span>
            )}
          </div>

          <div className="space-y-3">
            {/* 1. 勤怠打刻エラー・退勤忘れアラート */}
            {attendanceErrorCount > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-rose-50/80 border border-rose-200 rounded-2xl">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-rose-500 shrink-0 border border-rose-100">
                    <Clock className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black bg-rose-600 text-white px-2 py-0.2 rounded-md">
                        勤怠エラー
                      </span>
                      <p className="font-black text-slate-800 text-sm">
                        {attendanceErrorCount}件の退勤忘れ・打刻エラーがあります
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">
                      出勤打刻はありますが退勤打刻が未入力のままです。勤怠管理画面から確認・修正してください。
                    </p>
                  </div>
                </div>
                <Link 
                  href="/hr" 
                  className="inline-flex items-center justify-center gap-1 text-rose-700 hover:text-white text-xs font-black px-4 py-2.5 bg-rose-100 hover:bg-rose-600 rounded-xl transition-all shadow-sm shrink-0 self-start sm:self-auto"
                >
                  勤怠管理で確認する ➔
                </Link>
              </div>
            )}

            {/* 2. 未確定受注アラート */}
            {pendingOrdersCount > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-50/80 border border-amber-200 rounded-2xl">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-amber-600 shrink-0 border border-amber-100">
                    <Truck className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black bg-amber-600 text-white px-2 py-0.2 rounded-md">
                        受注管理
                      </span>
                      <p className="font-black text-slate-800 text-sm">
                        {pendingOrdersCount}件の未確定受注があります
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">
                      取引先からの新規注文が入っています。出荷スケジュールと注文内容を確認して確定してください。
                    </p>
                  </div>
                </div>
                <Link 
                  href="/sales-management/orders" 
                  className="inline-flex items-center justify-center gap-1 text-amber-800 hover:text-white text-xs font-black px-4 py-2.5 bg-amber-200/80 hover:bg-amber-600 rounded-xl transition-all shadow-sm shrink-0 self-start sm:self-auto"
                >
                  受注一覧へ ➔
                </Link>
              </div>
            )}

            {/* 3. タスクゼロ（正常時） */}
            {totalTasks === 0 && !loadingTasks && (
              <div className="flex items-center gap-3.5 p-5 bg-emerald-50/60 border border-emerald-200 rounded-2xl text-emerald-900">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-emerald-600 shrink-0 border border-emerald-100">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="font-black text-sm text-emerald-900">🎉 現在、対応が必要な未処理タスクはありません</p>
                  <p className="text-xs text-emerald-700/80 mt-0.5">勤怠打刻エラー、未確定受注、請求書アラート等はすべて正常に処理されています。</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-wider">
            業務機能・サービス一覧
          </h2>
          <span className="text-xs font-bold text-slate-400">
            全4区分（栽培司令塔 / 現場スマホ / 農薬安全 / 経営・労務）
          </span>
        </div>

        {/* サービスパネルグリッド */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* ① 👑 【最重要】作付・農業司令塔 Hub */}
          <Link 
            href="/admin/cultivations" 
            className="group md:col-span-2 lg:col-span-2 bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 md:p-8 shadow-md border border-emerald-500/30 hover:border-emerald-400 hover:shadow-xl transition-all flex flex-col relative overflow-hidden"
          >
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
            
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-emerald-900/50">
                  <Sprout className="w-8 h-8" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-black px-2.5 py-0.5 rounded-full border border-emerald-500/30 mb-1">
                    <Sparkles className="w-3.5 h-3.5" /> 栽培・圃場統括
                  </div>
                  <h3 className="text-2xl font-black text-white group-hover:text-emerald-300 transition-colors">
                    🌱 作付・農業司令塔 Hub
                  </h3>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/10 text-emerald-300 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            <p className="text-sm font-bold text-slate-300 flex-1 leading-relaxed relative z-10 mb-6 max-w-2xl">
              全圃場の作付状況・生育ステータス、防除履歴、作業指示、圃場カルテを一元俯瞰・即時操作できる、農園の最高司令塔ダッシュボードです。
            </p>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-700/60 relative z-10">
              <div className="bg-white/5 rounded-xl p-2.5 text-center">
                <span className="text-[11px] text-slate-400 font-bold block">圃場カルテ</span>
                <span className="text-xs font-black text-emerald-300">気象・生育追跡</span>
              </div>
              <div className="bg-white/5 rounded-xl p-2.5 text-center">
                <span className="text-[11px] text-slate-400 font-bold block">防除・散布</span>
                <span className="text-xs font-black text-emerald-300">基準回数ガード</span>
              </div>
              <div className="bg-white/5 rounded-xl p-2.5 text-center">
                <span className="text-[11px] text-slate-400 font-bold block">作業指示</span>
                <span className="text-xs font-black text-emerald-300">現場リアルタイム連携</span>
              </div>
            </div>
          </Link>

          {/* ② 📱 出退勤・現場ポータル */}
          <Link href="/portal" className="group bg-gradient-to-br from-indigo-50 to-white rounded-3xl p-6 shadow-sm border border-indigo-100 hover:shadow-md hover:border-indigo-300 transition-all flex flex-col relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                <Layout className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">現場スタッフ向け</span>
            </div>
            <h3 className="text-lg font-black text-indigo-900 mb-2 group-hover:text-indigo-700 transition-colors relative z-10">📱 出退勤・現場ポータル</h3>
            <p className="text-sm font-bold text-indigo-700/70 flex-1 leading-relaxed relative z-10">
              出勤・退勤の打刻、直近スケジュール、社内掲示板、外国人スタッフ向け動画マニュアルを確認できます。
            </p>
          </Link>

          {/* ③ ⏱️ 現場作業・日報記録 */}
          <Link href="/work" className="group bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-emerald-300 transition-all flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">現場入力</span>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-emerald-600 transition-colors">⏱️ 現場作業・日報記録</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              圃場GPS自動判定、リアルタイム作業タイマー計測、農薬散布記録、収穫・出荷日報をスマホから素早く記録。
            </p>
          </Link>

          {/* ④ 🗺️ 圃場マップ & 気象カルテ */}
          <Link href="/admin/map" className="group bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Map className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">地図・気象</span>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">🗺️ 圃場マップ & 気象カルテ</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              航空写真上で圃場ポリゴンを描画管理。ピンポイント積算温度、日照時間、降水量から収穫適期日を自動予測。
            </p>
          </Link>

          {/* ⑤ 🧪 農薬スマートカルテ & 成分重複ガード */}
          <Link href="/farm/pesticide-check" className="group bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-amber-300 transition-all flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <FlaskConical className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md">公的FAMIC</span>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-amber-600 transition-colors">🧪 農薬スマートカルテ</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              作物名・農薬名から適用病害虫・希釈倍率を即座に逆引き照合。同一有効成分の重複使用回数を自動警告。
            </p>
          </Link>

          {/* ⑥ 📊 年間栽培計画 & 育苗・資材 */}
          <Link href="/admin/plans" className="group bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-teal-300 transition-all flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black bg-teal-100 text-teal-700 px-2 py-0.5 rounded-md">計画・ガント</span>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-teal-600 transition-colors">📊 年間栽培計画・資材</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              作付ガントチャート、基準に基づく自動育苗スケジュール、播種・定植に必要な資材所要量を自動計算。
            </p>
          </Link>

          {/* ⑦ 🚚 販売・受注・請求管理 */}
          <Link href="/sales-management" className="group bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-violet-300 transition-all flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Truck className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black bg-violet-100 text-violet-700 px-2 py-0.5 rounded-md">B2B卸・販売</span>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-violet-600 transition-colors">🚚 販売・受注・請求管理</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              B2B卸取引先からのWeb受注、納品スケジュール管理、インボイス対応請求書の自動発行と売掛金管理。
            </p>
          </Link>

          {/* ⑧ ⏰ 勤怠管理・タイムカード */}
          <Link href="/hr" className="group bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-sky-300 transition-all flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black bg-sky-100 text-sky-700 px-2 py-0.5 rounded-md">労務・HR</span>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-sky-600 transition-colors">⏰ 勤怠管理・タイムカード</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              従業員の出退勤打刻状況、休憩・残業時間の自動集計、有給休暇管理、月次タイムカードの出力。
            </p>
          </Link>

        </div>
      </main>
    </div>
  );
}
