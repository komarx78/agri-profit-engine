"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Database, LogOut, Sprout, History, Menu, FileSpreadsheet, Truck, FileText, Settings, Store, Copy, Check, Table, Target, Receipt, Youtube } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const supabase = createClient();

  React.useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setTenantId(user.id);
    };
    getUser();
  }, [supabase]);

  const handleCopyUrl = () => {
    if (!tenantId) return;
    const url = `${window.location.origin}/farm/${tenantId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // 現場のワーカーログイン情報もついでに消去
    if (tenantId) localStorage.removeItem(`agri_worker_${tenantId}`);
    router.push('/login');
  };

  const navGroups = [
    {
      title: 'メイン',
      items: [
        { name: 'ダッシュボード', path: '/admin/dashboard', icon: LayoutDashboard },
        { name: '予実管理', path: '/admin/plans', icon: Target },
      ]
    },
    {
      title: '売上・経費管理',
      items: [
        { name: '出荷記録一覧', path: '/admin/sales-history', icon: Truck },
        { name: '請求書一括発行', path: '/admin/invoices', icon: FileText },
        { name: '資材・経費管理', path: '/admin/purchases', icon: Receipt },
        { name: '会計データ出力', path: '/admin/accounting', icon: FileSpreadsheet },
      ]
    },
    {
      title: '作業管理',
      items: [
        { name: '作業記録一覧', path: '/admin/history', icon: History },
        { name: '作業内容台帳 (集計)', path: '/admin/work-ledger', icon: Table },
        { name: '動画マニュアル集', path: '/admin/manuals', icon: Youtube }, // lucide-reactのYoutubeまたはPlayCircleを使うがインポートを確認
      ]
    },
    {
      title: '設定・マスタ',
      items: [
        { name: 'マスタ管理全般', path: '/admin/masters', icon: Database },
        { name: '出荷先・メール設定', path: '/admin/channels', icon: Store },
        { name: '自社情報設定', path: '/admin/settings', icon: Settings },
      ]
    }
  ];

  const NavLinks = () => (
    <div className="space-y-6">
      {navGroups.map((group) => (
        <div key={group.title}>
          <h3 className="px-4 text-xs font-black text-slate-400 tracking-wider mb-2 uppercase">
            {group.title}
          </h3>
          <div className="space-y-1">
            {group.items.map((item) => {
              const isActive = pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors font-bold ${
                    isActive 
                      ? 'bg-emerald-50 text-emerald-700' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
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
            {tenantId && (
              <>
                <Link 
                  href={`/farm/${tenantId}`} 
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 font-medium hover:bg-slate-100"
                >
                  <Sprout className="w-5 h-5" />
                  現場画面へ行く
                </Link>
                <button 
                  onClick={handleCopyUrl}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-emerald-600 font-bold bg-emerald-50 hover:bg-emerald-100 transition-colors text-left mt-2"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  従業員用URLをコピー
                </button>
              </>
            )}
            <button 
              onClick={handleSignOut}
              className="w-full mt-2 flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 font-medium hover:bg-rose-50 transition-colors text-left"
            >
              <LogOut className="w-5 h-5" />
              ログアウト
            </button>
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
          {tenantId && (
            <>
              <Link 
                href={`/farm/${tenantId}`} 
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 font-medium hover:bg-slate-100 transition-colors"
              >
                <Sprout className="w-5 h-5" />
                現場画面へ行く
              </Link>
              <button 
                onClick={handleCopyUrl}
                className="w-full mt-2 flex items-center gap-3 px-4 py-3 rounded-xl text-emerald-600 font-bold bg-emerald-50 hover:bg-emerald-100 transition-colors text-left shadow-sm"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                従業員URLコピー
              </button>
            </>
          )}
          <button 
            onClick={handleSignOut}
            className="w-full mt-2 flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 font-medium hover:bg-rose-50 transition-colors text-left"
          >
            <LogOut className="w-5 h-5" />
            ログアウト
          </button>
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
