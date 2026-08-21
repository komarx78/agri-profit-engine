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
  AlertCircle
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
          <div className="flex items-center gap-4">
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
          
          {/* 農業経営管理 */}
          <Link href="/admin/dashboard" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-emerald-300 transition-all flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sprout className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-emerald-700 transition-colors">農業経営管理</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              作付計画、圃場マップ、売上推移などの農業生産に特化した利益管理ダッシュボードです。
            </p>
          </Link>

          {/* 現場作業・スマホ打刻 */}
          <Link href="/work" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-amber-300 transition-all flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-amber-700 transition-colors">現場作業・スマホ打刻</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              農場スタッフ用のスマートフォン向け画面です。作業開始・終了の打刻や資材使用量の記録を行います。
            </p>
          </Link>

          {/* 勤怠管理 */}
          <Link href="/hr" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all flex flex-col cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-blue-700 transition-colors">勤怠・有給管理</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              従業員の出退勤管理、有給休暇の付与・申請承認、シフト作成などを行います。
            </p>
          </Link>

          {/* 請求書・販売管理 */}
          <Link href="/sales" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 transition-all flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-indigo-700 transition-colors">請求書・販売管理</h3>
            <p className="text-sm font-bold text-slate-500 flex-1 leading-relaxed">
              取引先への請求書の一括発行、入金消込、出荷伝票の作成などを一元管理します。
            </p>
          </Link>

          {/* 経費精算 */}
          <Link href="/admin/purchases" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-rose-300 transition-all flex flex-col">
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
          <Link href="/admin/accounting" className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-cyan-300 transition-all flex flex-col">
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

        </div>
      </main>
    </div>
  );
}
