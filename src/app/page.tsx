"use client";

import React, { useState } from 'react';
import Link from 'next/link';
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
  Layout
} from 'lucide-react';

export default function PortalPage() {
  const [currentDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* 共通ヘッダー（ポータル） */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
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
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
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
            <p className="text-sm font-bold text-slate-500 mt-1">今日は {currentDate} です。未処理のタスクが3件あります。</p>
          </div>
        </div>

        {/* お知らせ・タスクウィジェット */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-8">
          <h2 className="text-sm font-black text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> ToDo / お知らせ
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-rose-50 border border-rose-100 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <Clock className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <p className="font-bold text-slate-700 text-sm">3名の勤怠打刻エラーがあります</p>
                  <p className="text-xs text-slate-500 font-medium">勤怠管理システムから確認してください</p>
                </div>
              </div>
              <button className="text-rose-600 text-sm font-bold hover:underline">確認する</button>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <FileText className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="font-bold text-slate-700 text-sm">今月の請求書の発行期限が近づいています</p>
                  <p className="text-xs text-slate-500 font-medium">あと3日で末日を迎えます</p>
                </div>
              </div>
              <button className="text-blue-600 text-sm font-bold hover:underline">請求管理へ</button>
            </div>
          </div>
        </div>

        <h2 className="text-sm font-black text-slate-400 mb-4 uppercase tracking-wider">
          ご利用中のサービス
        </h2>

        {/* サービスパネルグリッド */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* 統合ポータル (新機能) */}
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

          {/* 農業経営管理 */}
          <Link href="/admin/cultivations" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-emerald-300 transition-all flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sprout className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-emerald-700 transition-colors">🌾 作付け・作業 統合司令塔</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              作付け一覧、7大一括日誌、散布管理（残回数）、圃場マップ、栽培計画を一元管理します。
            </p>
          </Link>

          {/* 販売・受注・請求管理 (管理者用) */}
          <Link href="/sales-management" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 transition-all flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-indigo-700 transition-colors">💰 販売・請求・経費管理</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              B2B受注、出荷履歴、請求書一括発行、資材購入・経費、会計データ出力（MF/freee）を統合管理します。
            </p>
          </Link>

          {/* 出荷・納品ハブ (現場用) */}
          <Link href="/sales" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-emerald-300 transition-all flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Truck className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-emerald-700 transition-colors">出荷・納品ハブ (現場用)</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              本日の配達予定（受注分）の確認・消込と、JA等への都度出荷を記録します。
            </p>
          </Link>

          {/* 経費精算 */}
          <Link href="/sales-management/purchases" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-rose-300 transition-all flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <CreditCard className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-rose-500 transition-colors" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-rose-700 transition-colors">経費・購買管理</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              農業資材の購入履歴、レシート画像の保存、月別の経費集計などを管理します。
            </p>
          </Link>

          {/* 会計連動 */}
          <Link href="/sales-management/accounting" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-cyan-300 transition-all flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-cyan-100 text-cyan-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Calculator className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-cyan-500 transition-colors" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-cyan-700 transition-colors">クラウド会計データ出力</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              売上・経費データから仕訳データを自動生成し、各種会計ソフトへ取り込める形式で出力します。
            </p>
          </Link>

          {/* 動画マニュアル集 */}
          <Link href="/manuals" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-red-300 transition-all flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Video className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-red-500 transition-colors" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-red-700 transition-colors">動画マニュアル集</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              システムの使い方や各機能の操作手順を動画で分かりやすく解説します。
            </p>
          </Link>

        </div>
      </main>
    </div>
  );
}
