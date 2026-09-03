"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Building,
  Users,
  Calendar,
  Coffee,
  Settings,
  ArrowLeft,
  Menu,
  X,
  Lock,
  Crown,
  Cloud,
  Clock
} from 'lucide-react';
import { useCompany } from '@/hooks/useCompany';

export default function HrLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { companyName } = useCompany();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // ペイウォール（課金の壁）のデモ用ステート。
  // 将来的にはSupabaseのテナント情報から取得する。
  const isPremiumUser = true; 

  const navItems = [
    { name: '本日の打刻状況', path: '/hr', icon: Users },
    { name: '月次タイムカード', path: '/hr/monthly', icon: Calendar },
    { name: '有給・休暇管理', path: '/hr/paid-leave', icon: Coffee },
    { name: '残業申請の管理', path: '/hr/overtime', icon: Clock },
    { name: '従業員マスタ', path: '/hr/employees', icon: Settings },
    { name: '勤怠ルール・会社設定', path: '/hr/settings', icon: Building },
  ];

  // スマホ用背景クリックで閉じる
  const closeMenu = () => setIsMobileMenuOpen(false);

  // 未契約テナント向けのペイウォール画面
  if (!isPremiumUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-2">プレミアム機能</h1>
          <p className="text-sm font-bold text-slate-500 mb-8 leading-relaxed">
            人事・労務管理システムのご利用には、<br />
            「スタンダードプラン」以上のオプション契約が必要です。
          </p>
          <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 mb-4">
            <Crown className="w-5 h-5" /> プランをアップグレードする
          </button>
          <Link href="/" className="text-sm font-bold text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1">
            <Cloud className="w-4 h-4" /> Cloud Portalへ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* 独自ヘッダー（青ベース） */}
      <header className="h-16 bg-blue-700 text-white sticky top-0 z-50 shadow-sm flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            className="md:hidden p-2 hover:bg-blue-600 rounded-lg transition-colors -ml-2"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 border border-blue-400 flex items-center justify-center text-white shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-base font-black text-white truncate max-w-[180px] sm:max-w-xs">
                {companyName || 'Agri-Profit'}
              </div>
              <p className="text-[10px] text-blue-200 font-bold">人事・労務管理システム</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <Link 
            href="/" 
            className="flex items-center gap-1.5 text-sm font-bold text-blue-100 hover:text-white bg-blue-800/50 hover:bg-blue-800 px-3 py-1.5 rounded-lg transition-all"
          >
            <Cloud className="w-4 h-4" />
            <span className="hidden sm:block">Cloud Portalへ戻る</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* PC用サイドバー */}
        <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col">
          <div className="p-4 border-b border-slate-100 bg-blue-50/40">
            <div className="text-xs font-black text-slate-800 truncate" title={companyName || '自社名未設定'}>
              🏢 {companyName || '自社名未設定'}
            </div>
            <p className="text-[10px] text-blue-600 font-bold mt-0.5">人事労務ダッシュボード</p>
          </div>
          <div className="flex-1 overflow-y-auto py-4">
            <nav className="space-y-1 px-4">
              {navItems.map(item => {
                const isActive = pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    target={item.isExternal ? "_blank" : undefined}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-bold ${
                      isActive 
                        ? 'bg-blue-50 text-blue-700' 
                        : item.isExternal
                        ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-transparent hover:border-slate-200 mt-4'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="truncate flex-1">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* スマホ用モバイルメニュー（オーバーレイ） */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-[60] flex">
            {/* バックドロップ */}
            <div 
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={closeMenu}
            ></div>
            
            {/* メニュー本体 */}
            <div className="relative w-64 bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-left">
              <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
                <span className="font-black text-slate-800 text-lg">人事労務メニュー</span>
                <button 
                  onClick={closeMenu}
                  className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-4">
                <nav className="space-y-1 px-3">
                  {navItems.map(item => {
                    const isActive = pathname === item.path;
                    const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          href={item.path}
                          target={item.isExternal ? "_blank" : undefined}
                          onClick={closeMenu}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-bold ${
                            isActive 
                              ? 'bg-blue-50 text-blue-700' 
                              : item.isExternal
                              ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-transparent hover:border-slate-200 mt-4'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span className="truncate flex-1">{item.name}</span>
                        </Link>
                      );
                  })}
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* メインコンテンツ領域 */}
        <main className="flex-1 overflow-y-auto w-full bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
}
