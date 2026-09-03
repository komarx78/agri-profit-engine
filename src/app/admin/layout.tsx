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
  Layout,
  ShoppingCart,
  Building
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/hooks/useCompany';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { companyName } = useCompany();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      // 1. Supabase Auth による正規管理者セッションのチェック
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        setTenantId(session.user.id);
        return;
      }

      // 2. 現場スタッフ（PIN認証）の場合、明示的に管理者ロール (role === 'admin') を持つ場合のみ許可
      const savedWorker = localStorage.getItem('agri_current_worker');
      if (savedWorker) {
        try {
          const workerData = JSON.parse(savedWorker);
          if (workerData.role === 'admin' && workerData.user_id) {
            setTenantId(workerData.user_id);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }

      // 未認証、または一般作業員アカウントの場合はログインへ誘導
      router.push('/login');
    }
    checkAuth();
  }, [router]);

  const handleCopyUrl = async () => {
    const url = tenantId 
      ? `${window.location.origin}/portal?farm=${tenantId}`
      : `${window.location.origin}/portal`;
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
      title: '日々の現場・作業日誌',
      items: [
        { name: 'ダッシュボード', path: '/admin/dashboard', icon: LayoutDashboard },
        { name: '作付け・作業 統合司令塔', path: '/admin/cultivations', icon: Sprout },
        { name: 'タスク・スケジュール管理', path: '/admin/tasks', icon: Calendar },
        { name: '作業承認インボックス', path: '/admin/approvals', icon: Inbox },
      ]
    },
    {
      title: '栽培計画・マップ・分析',
      items: [
        { name: '作付地図 (圃場マップ)', path: '/admin/map', icon: MapPin },
        { name: '栽培・予実管理表', path: '/admin/cultivation-schedule', icon: Calendar },
        { name: '作目別 採算分析', path: '/admin/crop-analysis', icon: PieChart },
        { name: '育苗スケジュール', path: '/admin/nursery-schedule', icon: Table },
        { name: '必要資材自動集計', path: '/admin/material-requirements', icon: Calculator },
      ]
    },
    {
      title: '連携システム・マスタ',
      items: [
        { name: '📦 販売管理システム', path: '/sales-management', icon: ShoppingCart, external: true },
        { name: '💳 経理・購買システム', path: '/accounting-management', icon: Receipt, external: true },
        { name: '📱 現場出退勤ポータル', path: '/portal', icon: Layout, external: true },
        { name: '👥 労務・人事システム', path: '/hr', icon: Users, external: true },
        { name: '💊 農薬検索・防除AI', path: '/farm/pesticide-check', icon: FlaskConical },
        { name: '⚙️ マスタ管理全般', path: '/admin/masters', icon: Database },
        { name: '🏢 自社情報設定', path: '/admin/settings', icon: Settings },
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
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/" className="flex items-center gap-1.5 text-emerald-700 font-black text-base shrink-0">
            <Cloud className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <div className="text-xs font-black text-slate-800 truncate max-w-[170px]">
              {companyName || 'Cloud Portal'}
            </div>
            <p className="text-[10px] font-bold text-emerald-600">農業司令塔</p>
          </div>
        </div>
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
        <div className="p-4 border-b border-slate-100 bg-emerald-50/40">
          <Link href="/" className="flex items-center justify-between text-slate-500 hover:text-emerald-700 text-xs font-bold transition-colors mb-2">
            <span className="flex items-center gap-1.5"><Cloud className="w-3.5 h-3.5 text-emerald-600" /> Cloud Portal</span>
            <span className="text-[10px] text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full font-black">ホーム</span>
          </Link>
          <div className="flex items-center gap-2.5 pt-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
              <Building className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-slate-900 truncate" title={companyName || '自社名未設定'}>
                {companyName || '自社名未設定'}
              </div>
              <p className="text-[10px] font-bold text-emerald-600">農業統合司令塔</p>
            </div>
          </div>
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
