"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Receipt, 
  Calculator, 
  FileSpreadsheet, 
  LogOut, 
  Sprout, 
  ArrowLeft,
  ShoppingCart,
  DollarSign
} from 'lucide-react';

export default function AccountingManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { name: '資材購入・直接経費', path: '/accounting-management', icon: Receipt },
    { name: '月次全体経費 (按分用)', path: '/accounting-management/monthly-expenses', icon: Calculator },
    { name: '会計データ出力 (MF等)', path: '/accounting-management/accounting', icon: FileSpreadsheet },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      
      {/* デスクトップサイドバー */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col hidden md:flex sticky top-0 h-screen border-r border-slate-800">
        
        {/* ヘッダー */}
        <div className="h-16 flex items-center px-5 border-b border-slate-800 bg-slate-950">
          <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl mr-2.5">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-white text-base leading-tight tracking-tight">経理・購買システム</h1>
            <p className="text-[10px] text-slate-400 font-bold">経費・按分・会計連動</p>
          </div>
        </div>
        
        {/* ナビゲーション */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <h2 className="px-3 text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">
            経理・コスト管理
          </h2>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* フッターリンク */}
        <div className="p-3 border-t border-slate-800 space-y-1 bg-slate-950/60">
          <Link
            href="/sales-management"
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-indigo-400 hover:bg-indigo-950/40 rounded-xl transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>📦 販売管理システムへ</span>
          </Link>
          <Link
            href="/admin/cultivations"
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <Sprout className="w-4 h-4" />
            <span>🌾 農業司令塔へ</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ポータルTOPへ</span>
          </Link>
        </div>

      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* モバイルヘッダー */}
        <header className="md:hidden h-14 bg-slate-900 flex items-center justify-between px-4 border-b border-slate-800 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span className="font-black text-white text-base">経理・購買システム</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/cultivations" className="px-2.5 py-1 bg-emerald-900/60 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-700">
              🌾 農業司令塔
            </Link>
            <Link href="/" className="p-1 text-slate-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </Link>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>

      </main>

    </div>
  );
}
