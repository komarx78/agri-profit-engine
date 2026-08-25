"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  FileText, 
  Truck, 
  LogOut, 
  Sprout, 
  ArrowLeft,
  CreditCard
} from 'lucide-react';
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';
import { useCompany } from '@/hooks/useCompany';

export default function SalesManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { companyName } = useCompany();

  const navItems = [
    { name: '販売ダッシュボード', path: '/sales-management', icon: LayoutDashboard },
    { name: 'B2B受注・納品管理', path: '/sales-management/orders', icon: ShoppingCart },
    { name: '出荷履歴一覧', path: '/sales-management/sales-history', icon: Truck },
    { name: '請求書一括発行', path: '/sales-management/invoices', icon: FileText },
    { name: '顧客・取引先マスタ', path: '/sales-management/customers', icon: Users },
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
              <div className="p-2 bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-xl shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-black text-white text-sm truncate" title={companyName || '自社名未設定'}>
                  {companyName || '自社名未設定'}
                </div>
                <p className="text-[10px] text-indigo-400 font-bold">販売・B2B受注管理</p>
              </div>
            </div>
          </div>
          
          {/* ナビゲーション */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            <h2 className="px-3 text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">
              販売・受注メニュー
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
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* フッター */}
          <div className="p-4 border-t border-slate-800 space-y-2">
            <Link
              href="/admin/cultivations"
              className="w-full py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Sprout className="w-4 h-4" />
              <span>農業司令塔へ戻る</span>
            </Link>
            <Link
              href="/portal"
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>現場ポータルへ戻る</span>
            </Link>
          </div>
        </aside>

        {/* メインコンテンツエリア */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-50">
          
          {/* モバイル用ヘッダー */}
          <header className="h-14 bg-slate-900 text-white flex items-center justify-between px-4 md:hidden border-b border-slate-800 sticky top-0 z-30">
            <div className="flex items-center gap-2 min-w-0">
              <ShoppingCart className="w-5 h-5 text-indigo-400 shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-xs text-white truncate max-w-[160px]">
                  {companyName || '販売管理'}
                </div>
                <p className="text-[10px] text-indigo-400 font-bold">販売・受注システム</p>
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
