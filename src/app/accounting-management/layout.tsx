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
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';
import { useCompany } from '@/hooks/useCompany';

export default function AccountingManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { companyName } = useCompany();

  const navItems = [
    { name: '資材購入・直接経費', path: '/accounting-management', icon: Receipt },
    { name: '月次全体経費 (按分用)', path: '/accounting-management/monthly-expenses', icon: Calculator },
    { name: '会計データ出力 (MF等)', path: '/accounting-management/accounting', icon: FileSpreadsheet },
  ];

  return (
    <AdminOnlyGuard>
      <div className="min-h-screen bg-slate-50 flex font-sans">
        
        {/* デスクトップサイドバー */}
        <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col hidden md:flex sticky top-0 h-screen border-r border-slate-800">
          
          {/* ヘッダー */}
          <div className="p-4 border-b border-slate-800 bg-slate-950">
            <Link href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-bold transition-colors mb-2">
              <ArrowLeft className="w-3.5 h-3.5" /> ポータルTOPへ
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-black text-white text-sm truncate" title={companyName || '自社名未設定'}>
                  {companyName || '自社名未設定'}
                </div>
                <p className="text-[10px] text-emerald-400 font-bold">経理・購買・按分管理</p>
              </div>
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
              <span>🛒 販売・B2B受注システムへ</span>
            </Link>
            <Link
              href="/admin/cultivations"
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <Sprout className="w-4 h-4" />
              <span>🌾 農業司令塔へ</span>
            </Link>
            <Link
              href="/portal"
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>現場ポータルTOPへ</span>
            </Link>
          </div>

        </aside>

        {/* メインコンテンツ */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          
          {/* モバイルヘッダー */}
          <header className="md:hidden h-14 bg-slate-900 flex items-center justify-between px-4 border-b border-slate-800 sticky top-0 z-20">
            <div className="flex items-center gap-2 min-w-0">
              <DollarSign className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-xs text-white truncate max-w-[160px]">
                  {companyName || '経理・購買'}
                </div>
                <p className="text-[10px] text-emerald-400 font-bold">経理・購買システム</p>
              </div>
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
    </AdminOnlyGuard>
  );
}
