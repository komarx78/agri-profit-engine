"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, Truck, Settings } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  // /admin 配下のページではボトムナビを表示しない
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-emerald-950/95 backdrop-blur-lg border-t border-emerald-800/60 pb-safe shadow-[0_-8px_30px_rgb(0,0,0,0.12)]">
      <div className="max-w-md mx-auto px-6 h-20 flex items-center justify-between">
        
        <Link 
          href="/"
          className={`flex flex-col items-center justify-center w-20 gap-1 transition-all duration-200 ${
            pathname === '/' 
              ? 'text-emerald-400 scale-110' 
              : 'text-emerald-700 hover:text-emerald-500'
          }`}
        >
          <div className={`p-1.5 rounded-xl ${pathname === '/' ? 'bg-emerald-900/50' : ''}`}>
            <Clock className={`w-6 h-6 ${pathname === '/' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          </div>
          <span className="text-[10px] font-bold tracking-wider">作業記録</span>
        </Link>

        <Link 
          href="/sales"
          className={`flex flex-col items-center justify-center w-20 gap-1 transition-all duration-200 ${
            pathname === '/sales' 
              ? 'text-amber-400 scale-110' 
              : 'text-emerald-700 hover:text-emerald-500'
          }`}
        >
          <div className={`p-1.5 rounded-xl ${pathname === '/sales' ? 'bg-amber-900/30' : ''}`}>
            <Truck className={`w-6 h-6 ${pathname === '/sales' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          </div>
          <span className="text-[10px] font-bold tracking-wider">出荷記録</span>
        </Link>

        <Link 
          href="/admin/dashboard"
          className="flex flex-col items-center justify-center w-20 gap-1 text-slate-500 hover:text-slate-400 transition-all duration-200"
        >
          <div className="p-1.5">
            <Settings className="w-6 h-6 stroke-2" />
          </div>
          <span className="text-[10px] font-bold tracking-wider">管理</span>
        </Link>

      </div>
    </nav>
  );
}
