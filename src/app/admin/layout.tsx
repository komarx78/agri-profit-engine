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
  Building,
  Smartphone,
  Printer
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { normalizeTenantId } from '@/lib/tenant';
import { useCompany } from '@/hooks/useCompany';
import { AiAssistant } from '@/components/AiAssistant';
import { FarmPosterModal } from '@/components/FarmPosterModal';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return normalizeTenantId(params.get('farm') || params.get('tenant') || params.get('farmId')) || '';
    }
    return '';
  });
  const {
    companyName,
    farmCode,
    planType,
    trialEndsAt,
    trialDaysLeft,
    campaignName,
  } = useCompany(tenantId);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isPosterOpen, setIsPosterOpen] = useState(false);
  // 現在のURLクエリ（?tab= 等）。同じ画面を開く2つのメニュー入口の見分けに使う
  const [currentSearch, setCurrentSearch] = useState<string>('');
  useEffect(() => {
    const sync = () => setCurrentSearch(window.location.search.replace(/^\?/, ''));
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [pathname]);

  const displayFarmCode = (farmCode || (tenantId === '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04' ? 'kap' : tenantId === '62163024-2c8e-4057-a872-2455dbc58d32' ? 'sahara' : tenantId ? tenantId.substring(0, 8) : '')).toUpperCase();

  useEffect(() => {
    async function checkAuth() {
      // 1. URLクエリから farm / tenant パラメータを検知
      let urlFarm: string | null = null;
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        urlFarm = normalizeTenantId(params.get('farm') || params.get('tenant') || params.get('farmId'));
      }

      // 2. Supabase Auth による正規管理者セッションのチェック
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        const resolvedId = urlFarm || session.user.id;
        setTenantId(resolvedId);
        if (typeof window !== 'undefined') {
          try { localStorage.setItem('agri_owner_id', resolvedId); } catch (e) {}
        }
        return;
      }

      // 3. 現場スタッフ（PIN認証）の場合、明示的に管理者ロール (role === 'admin') を持つ場合のみ許可
      if (typeof window !== 'undefined') {
        const candidateKeys = ['agri_current_worker', 'current_worker'];
        if (urlFarm) candidateKeys.unshift(`agri_worker_${urlFarm}`);
        const savedOwner = normalizeTenantId(localStorage.getItem('agri_owner_id'));
        if (savedOwner && !candidateKeys.includes(`agri_worker_${savedOwner}`)) {
          candidateKeys.push(`agri_worker_${savedOwner}`);
        }
        for (const key of candidateKeys) {
          const savedWorker = localStorage.getItem(key);
          if (savedWorker) {
            try {
              const workerData = JSON.parse(savedWorker);
              if (workerData && workerData.role === 'admin') {
                const resolvedId = urlFarm || normalizeTenantId(workerData.user_id) || savedOwner || '';
                if (resolvedId) {
                  setTenantId(resolvedId);
                  try { localStorage.setItem('agri_owner_id', resolvedId); } catch (e) {}
                }
                return;
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
      }

      // 4. URLで特定農園が指定されている場合は即時リダイレクトせず表示を継続（AdminOnlyGuard側で詳細制御）
      if (urlFarm) {
        setTenantId(urlFarm);
        try { localStorage.setItem('agri_owner_id', urlFarm); } catch (e) {}
        return;
      }

      // 未認証、または一般作業員アカウントの場合はログインへ誘導
      router.push('/login');
    }
    checkAuth();
  }, [router]);

  const handleCopyUrl = async () => {
    const url = tenantId 
      ? `${window.location.origin}/portal/${tenantId}`
      : `${window.location.origin}/portal`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleCopyFarmCode = async () => {
    try {
      await navigator.clipboard.writeText(displayFarmCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy farm code', err);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    if (tenantId) localStorage.removeItem(`agri_worker_${tenantId}`);
    router.push('/login');
  };

  // 🧭 左メニュー：農家さんの1年の流れ（毎日 → シーズン前の準備 → お金のふり返り → 設定）でグループ化
  // matchTab: 同じ画面（/admin/cultivations）を開く2つの入口を、URLの ?tab= で見分けて正しい方だけ光らせる
  const farmQ = (base: string, extra = '') => {
    const params = [tenantId ? `farm=${tenantId}` : '', extra].filter(Boolean).join('&');
    return params ? `${base}?${params}` : base;
  };
  const navGroups = [
    {
      title: '毎日つかう（現場・日報）',
      items: [
        { name: 'ダッシュボード（稼働・直接作業率）', path: farmQ('/admin/dashboard'), icon: LayoutDashboard },
        { name: '作業予定（タスク指示）', path: farmQ('/admin/tasks'), icon: Calendar },
        { name: '日報・写真の確認・承認', path: farmQ('/admin/approvals'), icon: Inbox },
        { name: '作業・栽培日誌（写真・履歴）', path: farmQ('/admin/cultivations', 'tab=history'), icon: BookOpen, matchTab: 'diary' },
      ]
    },
    {
      title: '作付けを決める・準備する',
      items: [
        { name: '畑の地図', path: farmQ('/admin/map'), icon: MapPin },
        { name: '作付けこよみ（計画）', path: farmQ('/admin/cultivations', 'tab=cultivations&focus=calendar'), icon: Sprout, matchTab: 'plan' },
        { name: '育苗スケジュール', path: farmQ('/admin/nursery-schedule'), icon: Table },
      ]
    },
    {
      title: '業務改善・収支PDCA（時間効率）',
      items: [
        { name: '作付け別の収支・時間按分', path: farmQ('/admin/cultivation-schedule'), icon: Receipt },
        { name: '品目・作業工程PDCA（前年比較）', path: farmQ('/admin/crop-analysis'), icon: PieChart },
      ]
    },
    {
      title: 'スタッフ・マスタ設定',
      items: [
        { name: '👥 スタッフ・出退勤・時給', path: farmQ('/hr'), icon: Users },
        { name: '⚙️ 畑・品目マスタ管理', path: farmQ('/admin/masters'), icon: Database },
        { name: '🏢 自社情報設定', path: farmQ('/admin/settings'), icon: Settings },
      ]
    }
  ];

  // 作付け・作業日誌画面のどちらの入口が選ばれているか（tab=cultivations または指定なし → こよみ ／ それ以外 → 日誌）
  const currentCultEntry = (() => {
    const tab = new URLSearchParams(currentSearch).get('tab');
    return !tab || tab === 'cultivations' ? 'plan' : 'diary';
  })();

  const NavLinks = () => (
    <div className="space-y-6">
      {navGroups.map((group) => (
        <div key={group.title}>
          <h3 className="px-4 text-xs font-black text-slate-400 tracking-wider mb-2 uppercase">
            {group.title}
          </h3>
          <div className="space-y-1">
            {group.items.map((item: any) => {
              const isActive = pathname === item.path.split('?')[0] && (!item.matchTab || item.matchTab === currentCultEntry);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  target={item.external ? "_blank" : undefined}
                  onClick={() => { setIsMobileMenuOpen(false); if (!item.external) setCurrentSearch(item.path.split('?')[1] || ''); }}
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
      
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:hidden sticky top-0 z-50 print:hidden">
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
        <div className="md:hidden bg-white border-b border-slate-200 p-4 space-y-2 shadow-lg fixed top-16 left-0 right-0 max-h-[calc(100vh-4rem)] overflow-y-auto w-full z-40 print:hidden">
          {/* モバイル用 農園コードバナー */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between gap-1 text-xs font-bold text-emerald-900 mb-1.5">
              <span className="flex items-center gap-1 font-black whitespace-nowrap min-w-0">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>農園コード</span>
              </span>
              <button
                onClick={() => { setIsMobileMenuOpen(false); setIsPosterOpen(true); }}
                className="text-[11px] text-emerald-700 underline font-bold shrink-0 whitespace-nowrap cursor-pointer hover:text-emerald-900"
              >
                ポスター印刷
              </button>
            </div>
            <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-emerald-100">
              <span className="font-mono font-black text-sm text-emerald-950 tracking-wider">
                {displayFarmCode}
              </span>
              <button
                onClick={handleCopyFarmCode}
                className="text-xs text-emerald-700 font-bold flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-emerald-100"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'コピー済' : 'コピー'}</span>
              </button>
            </div>
            {planType === 'trial' && (
              <div className="mt-2 pt-2 border-t border-emerald-200/70 flex items-center justify-between text-[11px] font-bold text-amber-800">
                <span>{campaignName || '🎁 無料お試し中'}</span>
                <span>
                  {trialDaysLeft && trialDaysLeft > 0
                    ? `残り${trialDaysLeft}日（${(trialEndsAt || '').replace(/-/g, '/')}迄）`
                    : 'お試し期間終了'}
                </span>
              </div>
            )}
          </div>

          <NavLinks />
          <div className="pt-2 mt-2 border-t border-slate-100">
            {tenantId && (
              <>
                <Link 
                  href={tenantId ? `/portal/${tenantId}` : '/portal'}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-blue-700 font-bold bg-blue-50 hover:bg-blue-100 transition-colors mb-1.5"
                >
                  <Layout className="w-5 h-5 text-blue-600" />
                  現場ポータルへ行く
                </Link>
                <button 
                  onClick={handleCopyUrl}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors shadow-xs border border-emerald-200 mt-1.5"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <Copy className="w-4 h-4 text-emerald-600 shrink-0" />}
                  <span className="whitespace-nowrap">{copied ? 'URLをコピー完了！' : '従業員用URLをコピー'}</span>
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

      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col sticky top-0 h-screen print:hidden">
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

          {/* 現場アプリ用 農園コード常設カード */}
          <div className="mt-3 p-2.5 bg-white border border-emerald-200 rounded-xl shadow-2xs">
            <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-slate-600 mb-1.5">
              <span className="flex items-center gap-1 text-emerald-900 font-black whitespace-nowrap min-w-0">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">農園コード</span>
              </span>
              <button
                onClick={() => setIsPosterOpen(true)}
                className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold underline flex items-center gap-0.5 shrink-0 whitespace-nowrap cursor-pointer hover:bg-emerald-50 px-1 py-0.5 rounded transition-colors"
                title="現場掲示用ポスターを印刷"
              >
                <Printer className="w-3 h-3 shrink-0" />
                <span>ポスター印刷</span>
              </button>
            </div>
            <div className="flex items-center justify-between bg-emerald-50/90 px-2.5 py-1.5 rounded-lg border border-emerald-100">
              <span className="font-mono font-black text-sm text-emerald-950 tracking-wider">
                {displayFarmCode}
              </span>
              <button
                onClick={handleCopyFarmCode}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-emerald-100 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                title="農園コードをコピー"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'コピー済' : 'コピー'}</span>
              </button>
            </div>
            {planType === 'trial' && (
              <div className="mt-2 pt-2 border-t border-emerald-100 text-[11px] font-bold text-amber-800 bg-amber-50/80 px-2 py-1.5 rounded-lg border border-amber-200/70">
                <div className="truncate">{campaignName || '🎁 無料お試し期間中'}</div>
                <div className="text-[10px] text-amber-700 mt-0.5">
                  {trialDaysLeft && trialDaysLeft > 0
                    ? `${(trialEndsAt || '').replace(/-/g, '/')} まで無料（残り${trialDaysLeft}日）`
                    : '無料お試し期間が終了しました'}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <NavLinks />
        </nav>
        
        <div className="p-4 border-t border-slate-100">
          {tenantId && (
            <>
              <Link 
                href={tenantId ? `/portal/${tenantId}` : '/portal'}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-blue-700 font-bold bg-blue-50 hover:bg-blue-100 transition-colors mb-2 shadow-sm"
              >
                <Layout className="w-5 h-5 text-blue-600" />
                現場ポータルへ行く
              </Link>
              <button 
                onClick={handleCopyUrl}
                className="w-full mt-1.5 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors shadow-xs border border-emerald-200"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <Copy className="w-4 h-4 text-emerald-600 shrink-0" />}
                <span className="whitespace-nowrap">{copied ? 'URLをコピー完了！' : '従業員用URLをコピー'}</span>
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

      <main className="flex-1 flex flex-col w-full min-w-0 md:h-screen md:overflow-auto relative overflow-x-hidden">
        <div className="flex-1 p-3.5 sm:p-4 md:p-8 min-w-0">
          {children}
        </div>
      </main>

      {/* A4現場掲示用ポスター印刷モーダル */}
      <FarmPosterModal
        isOpen={isPosterOpen}
        onClose={() => setIsPosterOpen(false)}
        farmCode={displayFarmCode}
        companyName={companyName || '当農園'}
        tenantId={tenantId}
      />

      {/* 画面右下常駐 孔明AI案内コンシェルジュ */}
      <AiAssistant
        tenantId={tenantId}
        companyName={companyName || '当農園'}
        farmCode={displayFarmCode}
      />
    </div>
  );
}
