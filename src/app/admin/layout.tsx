"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Database, LogOut, Sprout, History, Menu, FileSpreadsheet } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navItems = [
    { name: 'ダッシュボード', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: '作業記録一覧', path: '/admin/history', icon: History },
    { name: 'マスタ管理', path: '/admin/masters', icon: Database },
    { name: '会計データ出力', path: '/admin/accounting', icon: FileSpreadsheet },
  ];

  const NavLinks = () => (
    <>
      {navItems.map((item) => {
        const isActive = pathname === item.path;
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-bold ${
              isActive 
                ? 'bg-emerald-50 text-emerald-700' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className="w-5 h-5" />
            {item.name}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900 font-sans">
      
      {/* モバイル用ヘッダー */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:hidden sticky top-0 z-50">
        <div className="flex items-center gap-2 text-emerald-700 font-black text-lg">
          <Sprout className="w-6 h-6" />
          Agri-Profit Admin
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600">
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* モバイル用ドロップダウンメニュー */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 p-4 space-y-2 shadow-lg absolute w-full z-40">
          <NavLinks />
          <div className="pt-2 mt-2 border-t border-slate-100">
            <Link 
              href="/" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 font-medium hover:bg-slate-100"
            >
              <LogOut className="w-5 h-5" />
              現場入力画面へ戻る
            </Link>
          </div>
        </div>
      )}

      {/* デスクトップ用サイドバー */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col sticky top-0 h-screen">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-emerald-700 font-black text-lg tracking-tight">
            <Sprout className="w-6 h-6" />
            Agri-Profit Admin
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <NavLinks />
        </nav>
        
        <div className="p-4 border-t border-slate-100">
          <Link 
            href="/" 
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 font-medium hover:bg-slate-100 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            現場入力画面へ戻る
          </Link>
        </div>
      </aside>

      {/* メインコンテンツエリア */}
      <main className="flex-1 flex flex-col h-full md:h-screen overflow-auto">
        <div className="flex-1 p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
