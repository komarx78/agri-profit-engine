"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Sprout, 
  LayoutDashboard, 
  Table, 
  BookOpen, 
  MapPin, 
  Video, 
  LogOut, 
  Menu,
  ArrowUpRight,
  Database,
  Store,
  Settings,
  Truck,
  FileText,
  Calendar,
  Receipt,
  FileSpreadsheet,
  Calculator,
  History,
  Copy,
  Check,
  Users,
  Coffee,
  Cloud,
  PieChart,
  FlaskConical,
  CheckSquare,
  Inbox,
  Layout
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setTenantId(session.user.id);
        return;
      }

      // 現場PINログイン（スタッフ管理者）の認証チェック
      const savedWorker = localStorage.getItem('agri_current_worker');
      const savedOwnerId = localStorage.getItem('agri_owner_id');

      if (savedWorker && savedOwnerId) {
        try {
          const workerData = JSON.parse(savedWorker);
          if (workerData.role === 'admin' || workerData.role === 'manager') {
            setTenantId(savedOwnerId);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }

      router.push('/login');
    }
    checkAuth();
  }, [router]);

  const handleCopyUrl = async () => {
    if (!tenantId) return;
    const url = `${window.location.origin}/work`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    if (tenantId) localStorage.removeItem(`agri_worker_${tenantId}`);
    router.push('/login');
  };

  const navGroups = [
    {
      title: '計画・予実管理',
      items: [
        { name: 'ダッシュボード', path: '/admin/dashboard', icon: LayoutDashboard },
        { name: '作付地図', path: '/admin/map', icon: MapPin },
        { name: '作目別 分析', path: '/admin/crop-analysis', icon: PieChart },
        { name: '栽培・予実管理表', path: '/admin/cultivation-schedule', icon: Calendar },
        { name: '育苗スケジュール', path: '/admin/nursery-schedule', icon: Table },
        { name: '必要資材自動集計', path: '/admin/material-requirements', icon: Calculator },
      ]
    },
    {
      title: '売上・経費管理',
      items: [
        { name: '出荷履歴一覧', path: '/admin/sales-history', icon: Truck },
        { name: '請求書一括発行', path: '/admin/invoices', icon: FileText },
        { name: '資材購入・直接経費', path: '/admin/purchases', icon: Receipt },
        { name: '月次全体経費(按分用)', path: '/admin/monthly-expenses', icon: Calculator },
        { name: '会計データ出力', path: '/admin/accounting', icon: FileSpreadsheet },
      ]
    },
    {
      title: 'タスク・作業記録',
      items: [
        { name: 'タスク・スケジュール', path: '/admin/tasks', icon: CheckSquare },
        { name: '承認インボックス', path: '/admin/approvals', icon: Inbox },
        { name: '作業記録一覧', path: '/admin/history', icon: History },
        { name: '作業内容台帳 (集計)', path: '/admin/work-ledger', icon: Table },
      ]
    },
    {
      title: '連携アプリ',
      items: [
        { name: '出退勤・現場ポータルへ', path: '/portal', icon: Layout, external: true },
        { name: '販売管理システムへ', path: '/sales-management/orders', icon: Truck, external: true },
        { name: '労務・人事システムへ', path: '/hr', icon: Users, external: true },
        { name: '農薬検索・管理システムへ', path: '/pesticides', icon: FlaskConical, external: true },
        { name: '動画マニュアル集', path: '/manuals', icon: Video, external: true },
      ]
    },
    {
      title: '設定・マスタ',
      items: [
        { name: 'マスタ管理全般', path: '/admin/masters', icon: Database },
        { name: '自社情報設定', path: '/admin/settings', icon: Settings },
      ]
    },
    {
      title: 'サポート',
      items: [
        { name: '使い方ガイド', path: '/admin/manual', icon: BookOpen },
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
            {group.items.map((item: any) => {
              const isActive = pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  target={item.external ? "_blank" : undefined}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors font-bold ${
                    isActive 
                      ? 'bg-emerald-50 text-emerald-700' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${item.external ? 'text-blue-500' : ''}`} />
                  <span className={`truncate flex-1 ${item.external ? 'text-blue-700' : ''}`}>{item.name}</span>
                  {item.external && <ArrowUpRight className="w-4 h-4 text-slate-400" />}
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
      
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:hidden sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 text-emerald-700 font-black text-lg">
          <Cloud className="w-6 h-6" />
          Cloud Portal
        </Link>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600">
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 p-4 space-y-2 shadow-lg absolute top-16 left-0 right-0 w-full z-40">
          <NavLinks />
          <div className="pt-2 mt-2 border-t border-slate-100">
            {tenantId && (
              <>
                <Link 
                  href="/portal" 
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-blue-700 font-bold bg-blue-50 hover:bg-blue-100 transition-colors mb-1.5"
                >
                  <Layout className="w-5 h-5 text-blue-600" />
                  現場ポータルへ行く
                </Link>
                <Link 
                  href="/work" 
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  <Sprout className="w-5 h-5" />
                  現場打刻画面へ行く
                </Link>
                <button 
                  onClick={handleCopyUrl}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-emerald-600 font-bold bg-emerald-50 hover:bg-emerald-100 transition-colors text-left mt-1.5"
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

      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col sticky top-0 h-screen">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <Link href="/" className="flex items-center gap-2 text-emerald-700 font-black text-lg tracking-tight hover:text-emerald-800 transition-colors">
            <Cloud className="w-6 h-6" />
            <span>Cloud Portal<span className="text-sm text-emerald-500/80 ml-2">ホーム</span></span>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <NavLinks />
        </nav>
        
        <div className="p-4 border-t border-slate-100">
          {tenantId && (
            <>
              <Link 
                href="/portal" 
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-blue-700 font-bold bg-blue-50 hover:bg-blue-100 transition-colors mb-2 shadow-sm"
              >
                <Layout className="w-5 h-5 text-blue-600" />
                現場ポータルへ行く
              </Link>
              <Link 
                href="/work" 
                className="flex items-center gap-3 px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors"
              >
                <Sprout className="w-5 h-5" />
                現場打刻画面へ行く
              </Link>
              <button 
                onClick={handleCopyUrl}
                className="w-full mt-1.5 flex items-center gap-3 px-4 py-2.5 rounded-xl text-emerald-600 font-bold bg-emerald-50 hover:bg-emerald-100 transition-colors text-left shadow-sm"
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
      </aside>

      <main className="flex-1 flex flex-col w-full md:h-screen md:overflow-auto relative">
        <div className="flex-1 p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
