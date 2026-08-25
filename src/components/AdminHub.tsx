"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/hooks/useCompany';
import CultivationsHub from '@/components/CultivationsHub';
import ManagementDashboardHub from '@/components/ManagementDashboardHub';

interface AdminHubProps {
  onSwitchToHome: () => void;
  initialNav?: string;
}

export default function AdminHub({ onSwitchToHome, initialNav = 'cultivations' }: AdminHubProps) {
  const router = useRouter();
  const { companyName } = useCompany();
  const [selectedNav, setSelectedNav] = useState<string>(initialNav);
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
    }
    checkAuth();
  }, []);

  const handleCopyUrl = async () => {
    const url = tenantId 
      ? `${window.location.origin}/portal?farm=${tenantId}`
      : `${window.location.origin}/portal`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      alert('【貴農園専用URL】をコピーしました！\n\n' + url + '\n\n現場タブレットや従業員のスマホでこのURLを開くだけで、貴農園のスタッフ選択・打刻画面が即座に表示されます。');
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    if (tenantId) localStorage.removeItem(`agri_worker_${tenantId}`);
    localStorage.removeItem('agri_current_worker');
    localStorage.removeItem('agri_owner_id');
    router.push('/login');
  };

  const navGroups = [
    {
      title: '日々の現場・作業日誌',
      items: [
        { id: 'dashboard', name: 'ダッシュボード', icon: LayoutDashboard, path: '/admin/dashboard' },
        { id: 'cultivations', name: '作付け・作業 統合司令塔', icon: Sprout, path: '/admin/cultivations' },
        { id: 'tasks', name: 'タスク・スケジュール', icon: Calendar, path: '/admin/tasks' },
        { id: 'approvals', name: '作業承認インボックス', icon: Inbox, path: '/admin/approvals' },
      ]
    },
    {
      title: '栽培計画・マップ・分析',
      items: [
        { id: 'map', name: '作付地図 (圃場マップ)', icon: MapPin, path: '/admin/map' },
        { id: 'schedule', name: '栽培・予実管理表', icon: Calendar, path: '/admin/cultivation-schedule' },
        { id: 'crop-analysis', name: '作目別 採算分析', icon: PieChart, path: '/admin/crop-analysis' },
        { id: 'nursery', name: '育苗スケジュール', icon: Table, path: '/admin/nursery-schedule' },
        { id: 'materials', name: '必要資材自動集計', icon: Calculator, path: '/admin/material-requirements' },
      ]
    },
    {
      title: '連携システム・マスタ',
      items: [
        { id: 'sales', name: '📦 販売管理システム', icon: ShoppingCart, path: '/sales-management', external: true },
        { id: 'accounting', name: '💳 経理・購買システム', icon: Receipt, path: '/accounting-management', external: true },
        { id: 'hr', name: '👥 労務・人事システム', icon: Users, path: '/hr', external: true },
        { id: 'pesticide', name: '💊 農薬検索・防除AI', icon: FlaskConical, path: '/farm/pesticide-check', external: true },
        { id: 'masters', name: '⚙️ マスタ管理全般', icon: Database, path: '/admin/masters' },
        { id: 'settings', name: '🏢 自社情報設定', icon: Settings, path: '/admin/settings' },
      ]
    }
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      
      {/* 🌟 左側サイドバー（完全常設） */}
      <aside className="w-full lg:w-72 bg-white rounded-3xl border border-slate-200 shadow-sm p-4 shrink-0 space-y-6">
        
        {/* 農園情報 & ホームボタン */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 text-white rounded-2xl shadow-xs">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 leading-tight truncate max-w-[130px]">
                {companyName || 'Cloud Portal'}
              </h2>
              <p className="text-[10px] font-bold text-emerald-600">農業統合司令塔</p>
            </div>
          </div>

          <button
            onClick={onSwitchToHome}
            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black text-xs rounded-xl border border-emerald-200 transition-colors shadow-2xs"
            title="現場打刻・タスク画面へ"
          >
            現場ホーム
          </button>
        </div>

        {/* ナビゲーションリスト */}
        <nav className="space-y-6">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <h3 className="px-3 text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.items.map((item: any) => {
                  const Icon = item.icon;
                  const isSelected = selectedNav === item.id;
                  
                  if (item.external) {
                    return (
                      <Link
                        key={item.id}
                        href={item.path}
                        target="_blank"
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                          <span className="truncate">{item.name}</span>
                        </div>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedNav(item.id);
                        if (['tasks', 'approvals', 'map', 'schedule', 'crop-analysis', 'nursery', 'materials', 'masters', 'settings'].includes(item.id)) {
                          router.push(item.path);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition-all ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-700 shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* 下部アクションボタン群 */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <button
            onClick={onSwitchToHome}
            className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-black text-xs rounded-xl transition-colors"
          >
            <Layout className="w-4 h-4" />
            <span>📱 現場ポータルへ行く</span>
          </button>

          <Link
            href="/work"
            className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-black text-xs rounded-xl transition-colors"
          >
            <Sprout className="w-4 h-4 text-emerald-600" />
            <span>🌱 現場日報入力へ行く</span>
          </Link>

          <button
            onClick={handleCopyUrl}
            className="w-full flex items-center gap-2 px-3 py-2 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 font-black text-xs rounded-xl transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-emerald-600" />}
            <span className="truncate">{copied ? 'URLをコピーしました！' : '従業員用URLをコピー'}</span>
          </button>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-rose-500 hover:bg-rose-50 font-bold text-xs rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>ログアウト</span>
          </button>
        </div>

      </aside>

      {/* 🌟 右側メイン作業エリア */}
      <main className="flex-1 w-full min-w-0 space-y-6">
        
        {/* 1. 作付け・作業統合司令塔（デフォルト） */}
        {selectedNav === 'cultivations' && (
          <CultivationsHub initialSubTab="cultivations" />
        )}

        {/* 2. 経営ダッシュボード */}
        {selectedNav === 'dashboard' && (
          <ManagementDashboardHub />
        )}

        {/* 3. その他のナビが選択された場合のフォールバック（画面遷移中など） */}
        {selectedNav !== 'cultivations' && selectedNav !== 'dashboard' && (
          <CultivationsHub initialSubTab="cultivations" />
        )}

      </main>

    </div>
  );
}
