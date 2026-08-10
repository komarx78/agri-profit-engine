import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, Database, LogOut, Sprout } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans">
      {/* サイドバー */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-emerald-700 font-black text-lg tracking-tight">
            <Sprout className="w-6 h-6" />
            Agri-Profit Admin
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link 
            href="/admin/dashboard" 
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 transition-colors"
          >
            <LayoutDashboard className="w-5 h-5" />
            ダッシュボード
          </Link>
          
          <Link 
            href="/admin/masters" 
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 font-medium hover:bg-slate-100 transition-colors"
          >
            <Database className="w-5 h-5" />
            マスタ管理
          </Link>
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
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* モバイル用ヘッダー (簡易) */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 md:hidden">
          <div className="flex items-center gap-2 text-emerald-700 font-black text-lg">
            <Sprout className="w-5 h-5" />
            Agri-Profit Admin
          </div>
        </header>

        {/* ページコンテンツ */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
