"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  ShieldAlert, 
  LayoutDashboard, 
  Database, 
  Users, 
  Activity,
  LogOut,
  Menu,
  ChevronRight,
  Server,
  Lock,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// スーパー管理者許可メールアドレス（環境変数またはデフォルト許可リスト）
const DEFAULT_SUPER_ADMINS = [
  'koma@kap-cocotte.com',
  'admin@agri-profit-engine.com'
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function verifySuperAdmin() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setIsAuthorized(false);
          setIsChecking(false);
          return;
        }

        const email = session.user.email?.toLowerCase() || '';
        setCurrentUserEmail(email);

        // 環境変数からの追加リスト取得
        const envAdmins = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '')
          .split(',')
          .map(e => e.trim().toLowerCase())
          .filter(Boolean);

        const allowedEmails = [...DEFAULT_SUPER_ADMINS.map(e => e.toLowerCase()), ...envAdmins];

        // 1. メールアドレスの一致判定
        // 2. メタデータでの super_admin フラグ判定
        const isSuper = allowedEmails.includes(email) || session.user.user_metadata?.role === 'super_admin';

        setIsAuthorized(isSuper);
      } catch (err) {
        console.error('Super admin verify error:', err);
        setIsAuthorized(false);
      } finally {
        setIsChecking(false);
      }
    }
    verifySuperAdmin();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-xs font-black tracking-widest uppercase text-indigo-400">Verifying Super Admin Credentials...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
        <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
              403 Access Denied
            </span>
            <h2 className="text-xl font-black text-white pt-1">スーパー管理者 権限制限</h2>
            <p className="text-xs font-medium text-slate-400 leading-relaxed">
              この画面はシステム統括管理者（HQ）専用の司令室です。<br />
              現在のアカウント（{currentUserEmail || '未認証'}）にはアクセス権限がありません。
            </p>
          </div>
          <div className="pt-2 space-y-2">
            <Link
              href="/"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Cloud Portal へ戻る</span>
            </Link>
            <Link
              href="/login"
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all block text-center"
            >
              統括管理者アカウントで再ログイン
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const menuItems = [
    { name: 'ダッシュボード', href: '/super-admin', icon: LayoutDashboard },
    { name: 'テナント管理', href: '/super-admin/tenants', icon: Users },
    { name: '農薬マスター管理', href: '/super-admin/pesticides', icon: Database },
    { name: '肥料マスター管理', href: '/super-admin/fertilizers', icon: Server },
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
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-500 font-bold truncate">{currentUserEmail}</p>
                <p className="text-xs text-emerald-400 font-bold">SUPER ADMIN</p>
              </div>
            </div>
            
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-rose-500/10 hover:text-rose-400"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-bold">ログアウト</span>
            </button>
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
