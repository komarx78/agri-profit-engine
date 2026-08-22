import React from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  FileText,
  LogOut
} from 'lucide-react';

export default function SalesManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col hidden md:flex sticky top-0 h-screen">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
          <FileText className="w-6 h-6 text-indigo-400 mr-2" />
          <span className="font-black text-white text-lg tracking-tight">販売管理システム</span>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          <Link href="/sales-management" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 hover:text-white transition-colors font-bold text-sm">
            <LayoutDashboard className="w-5 h-5 text-indigo-400" />
            ダッシュボード
          </Link>
          <Link href="/sales-management/orders" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 hover:text-white transition-colors font-bold text-sm">
            <ShoppingCart className="w-5 h-5 text-emerald-400" />
            受注・納品管理
          </Link>
          <Link href="/sales-management/customers" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 hover:text-white transition-colors font-bold text-sm">
            <Users className="w-5 h-5 text-blue-400" />
            顧客マスタ
          </Link>
          <Link href="/sales-management/invoices" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 hover:text-white transition-colors font-bold text-sm">
            <FileText className="w-5 h-5 text-amber-400" />
            請求書管理
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-300 transition-colors">
            <LogOut className="w-4 h-4" />
            ポータルへ戻る
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-slate-900 flex items-center px-4 border-b border-slate-800 sticky top-0 z-10">
           <FileText className="w-6 h-6 text-indigo-400 mr-2" />
           <span className="font-black text-white text-lg">販売管理</span>
           <div className="ml-auto">
             <Link href="/" className="text-slate-400 hover:text-white"><LogOut className="w-5 h-5" /></Link>
           </div>
        </header>
        
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
