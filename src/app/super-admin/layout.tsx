"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ShieldAlert, 
  LayoutDashboard, 
  Database, 
  Users, 
  Activity,
  LogOut,
  Menu,
  ChevronRight,
  Server
} from 'lucide-react';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { name: 'ダッシュボード', href: '/super-admin', icon: LayoutDashboard },
    { name: 'テナント管理', href: '/super-admin/tenants', icon: Users },
    { name: '農薬マスター管理', href: '/super-admin/pesticides', icon: Database },
    { name: 'システムログ監視', href: '/super-admin/logs', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* モバイルヘッダー */}
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-white text-lg tracking-wider">SUPER ADMIN</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-400 hover:text-white">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <div className="flex">
        {/* サイドバー */}
        <aside className={`${
          isMobileMenuOpen ? 'fixed inset-0 z-50 bg-slate-950' : 'hidden'
        } md:block md:sticky md:top-0 md:h-screen w-full md:w-64 bg-slate-950 border-r border-slate-800 flex-shrink-0 flex flex-col transition-all duration-300`}>
          
          <div className="p-6 hidden md:flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-black text-white tracking-widest text-lg leading-tight">HQ</h1>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">System Control</p>
            </div>
          </div>

          <nav className="flex-1 px-4 py-8 md:py-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              // ルートパスの厳密チェック
              const isStrictActive = item.href === '/super-admin' ? pathname === '/super-admin' : isActive;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isStrictActive 
                      ? 'bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <item.icon className={`w-5 h-5 transition-transform duration-200 ${isStrictActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className="text-sm">{item.name}</span>
                  {isStrictActive && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 rounded-xl border border-slate-800 mb-4">
              <Server className="w-4 h-4 text-emerald-400" />
              <div className="flex-1">
                <p className="text-[10px] text-slate-500 font-bold">SYSTEM STATUS</p>
                <p className="text-xs text-emerald-400 font-bold">ALL SYSTEMS NORMAL</p>
              </div>
            </div>
            
            <Link
              href="/"
              className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-rose-500/10 hover:text-rose-400"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-bold">システムから退出</span>
            </Link>
          </div>
        </aside>

        {/* メインコンテンツ */}
        <main className="flex-1 min-w-0 bg-slate-900">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
