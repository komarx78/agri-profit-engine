"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, Truck, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { t, LanguageCode } from '@/lib/i18n';

export default function BottomNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [language, setLanguage] = useState<LanguageCode>('ja');

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAdmin(!!session);
    }
    checkSession();

    // テナントIDをURLから抽出（/farm/XXX の場合）
    let currentTenantId = tenantId;
    if (pathname && pathname.startsWith('/farm/') && !pathname.startsWith('/farm/pesticide-check')) {
      const parts = pathname.split('/');
      if (parts.length >= 3) {
        currentTenantId = parts[2];
        setTenantId(currentTenantId);
        localStorage.setItem('agri_current_tenant', currentTenantId); // sales等へ移動しても戻れるように保存
      }
    } else {
      // URLにない場合はローカルストレージから復元
      const saved = localStorage.getItem('agri_current_tenant');
      if (saved && saved !== 'pesticide-check') {
        currentTenantId = saved;
        setTenantId(currentTenantId);
      }
    }

    // 言語設定の読み込み
    const loadLang = () => {
      // tenant_id があれば優先して読む、次に全ページ共通設定を読む
      const tenantKey = currentTenantId ? `agri_lang_${currentTenantId}` : null;
      const savedLang = (tenantKey ? localStorage.getItem(tenantKey) : null) 
                        || localStorage.getItem('agri_lang') 
                        || localStorage.getItem('agri_lang_sales');
      if (savedLang) setLanguage(savedLang as LanguageCode);
    };
    loadLang();
    
    // 他のコンポーネントで言語が切り替わったことを検知するためタイマーで監視(簡易的)
    const interval = setInterval(loadLang, 1000);
    return () => clearInterval(interval);
    
  }, [pathname]);

  // /admin 配下やポータル画面(/)、ログイン画面、販売管理、B2B発注画面ではボトムナビ全体を非表示
  if (pathname === '/' || pathname?.startsWith('/admin') || pathname?.startsWith('/login') || pathname?.startsWith('/hr') || pathname?.startsWith('/sales-management') || pathname?.startsWith('/b2b-order')) {
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
          <span className="text-[10px] font-bold tracking-wider whitespace-nowrap">{t('navWork', language)}</span>
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
          <span className="text-[10px] font-bold tracking-wider whitespace-nowrap">{t('navSales', language)}</span>
        </Link>

      </div>
    </nav>
  );
}
