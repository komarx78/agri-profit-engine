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
  Loader2
} from 'lucide-react';

export default function PortalPage() {
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
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <Building className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl text-slate-800 tracking-tight">Cloud Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/portal"
              className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl font-bold text-sm transition-colors shadow-sm"
            >
              <Layout className="w-4 h-4 text-blue-600" />
              <span>現場ポータルへ</span>
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
              <span className="text-sm font-bold text-slate-700 hidden sm:block">システム管理者</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 挨拶と日時 */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">こんにちは、システム管理者さん</h1>
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

        <h2 className="text-sm font-black text-slate-400 mb-4 uppercase tracking-wider">
          ご利用中のサービス
        </h2>

        {/* サービスパネルグリッド */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* 統合ポータル */}
          <Link href="/portal" className="group bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-6 shadow-sm border border-indigo-100 hover:shadow-md hover:border-indigo-300 transition-all flex flex-col relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                <Layout className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-indigo-300 group-hover:text-indigo-600 transition-colors" />
            </div>
            <h3 className="text-lg font-black text-indigo-900 mb-2 group-hover:text-indigo-700 transition-colors relative z-10">出退勤・統合ポータル</h3>
            <p className="text-sm font-bold text-indigo-700/70 flex-1 leading-relaxed relative z-10">
              出退勤の打刻、直近のスケジュール・タスク確認、社内掲示板、各種マニュアル等を1つの画面で確認できる統合ポータルです。
            </p>
          </Link>

          {/* 現場作業・日報アプリ */}
          <Link href="/work" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-emerald-300 transition-all flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sprout className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-emerald-600 transition-colors">現場作業・日報記録</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              圃場での作業日報入力、農薬散布記録、収穫・出荷管理をスマートフォンから素早く記録できます。
            </p>
          </Link>

          {/* 農薬スマートカルテ & 成分重複ガード */}
          <Link href="/farm/pesticide-check" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-amber-300 transition-all flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <FlaskConical className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-amber-600 transition-colors">農薬スマートカルテ</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              作物名・農薬名から適用病害虫・希釈倍率を即座に逆引き照合。有効成分の重複使用回数を自動警告します。
            </p>
          </Link>

          {/* 勤怠管理システム */}
          <Link href="/hr" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">勤怠管理・タイムカード</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              従業員の出退勤打刻状況、休憩時間、残業時間の自動集計、月次タイムカードのエクスポートを行います。
            </p>
          </Link>

          {/* 販売・請求・仕入管理 */}
          <Link href="/sales-management" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-violet-300 transition-all flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Truck className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-violet-500 transition-colors" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-violet-600 transition-colors">販売・受注・請求管理</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              B2B卸取引先からのWeb受注、納品スケジュール管理、インボイス対応請求書の自動発行と売掛金管理を行います。
            </p>
          </Link>

          {/* 会計・原価計算 (将来機能) */}
          <div className="bg-slate-100/60 rounded-2xl p-6 border border-slate-200/80 flex flex-col relative overflow-hidden opacity-75">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-slate-200 text-slate-400 rounded-xl flex items-center justify-center">
                <Calculator className="w-6 h-6" />
              </div>
              <span className="text-xs font-black text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Coming Soon</span>
            </div>
            <h3 className="text-lg font-black text-slate-600 mb-2">品目別・原価管理</h3>
            <p className="text-sm font-bold text-slate-400 flex-1 leading-relaxed">
              資材費、人件費、圃場面積から品目ごとの正確な原価と利益率を自動算定する経営分析機能です。
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
