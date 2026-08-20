"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, Truck, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function BottomNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAdmin(!!session);
    }
    checkSession();

    // テナントIDをURLから抽出（/farm/XXX の場合）
    if (pathname && pathname.startsWith('/farm/')) {
      const parts = pathname.split('/');
      if (parts.length >= 3) {
        setTenantId(parts[2]);
        localStorage.setItem('agri_current_tenant', parts[2]); // sales等へ移動しても戻れるように保存
      }
    } else {
      // URLにない場合はローカルストレージから復元
      const saved = localStorage.getItem('agri_current_tenant');
      if (saved) {
        setTenantId(saved);
      }
    }
  }, [pathname]);

  // /admin 配下やポータル画面(/)、ログイン画面ではボトムナビ全体を非表示
  if (pathname === '/' || pathname?.startsWith('/admin') || pathname?.startsWith('/login') || pathname?.startsWith('/hr')) {
    return null;
  }

  // 作業記録のリンク先（現場の最新画面 = /farm/tenantId、分からなければ古い /work）
  const workHref = tenantId ? `/farm/${tenantId}` : "/work";
  const isWorkActive = pathname === '/work' || pathname?.startsWith('/farm');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-emerald-950/95 backdrop-blur-lg border-t border-emerald-800/60 pb-safe shadow-[0_-8px_30px_rgb(0,0,0,0.12)] print:hidden">
      <div className="max-w-md mx-auto px-6 h-20 flex items-center justify-between">
        
        <Link 
          href={workHref}
          className={`flex flex-col items-center justify-center w-20 gap-1 transition-all duration-200 ${
            isWorkActive 
              ? 'text-emerald-400 scale-110' 
              : 'text-emerald-700 hover:text-emerald-500'
          }`}
        >
          <div className={`p-1.5 rounded-xl ${isWorkActive ? 'bg-emerald-900/50' : ''}`}>
            <Clock className={`w-6 h-6 ${isWorkActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
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

        {/* 従業員が見る画面では「管理」ボタンを隠す（オーナーログイン時のみ表示） */}
        {isAdmin && (
          <Link 
            href="/admin/dashboard"
            className="flex flex-col items-center justify-center w-20 gap-1 text-slate-500 hover:text-slate-400 transition-all duration-200"
          >
            <div className="p-1.5">
              <Settings className="w-6 h-6 stroke-2" />
            </div>
            <span className="text-[10px] font-bold tracking-wider">管理</span>
          </Link>
        )}

      </div>
    </nav>
  );
}
