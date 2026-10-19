"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { normalizeTenantId } from '@/lib/tenant';
import { ShieldAlert, ArrowLeft, Loader2, Lock } from 'lucide-react';

interface AdminOnlyGuardProps {
  children: React.ReactNode;
}

function hasAdminWorkerInStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const urlFarm = normalizeTenantId(params.get('farm') || params.get('tenant') || params.get('farmId'));
    const candidateKeys = ['agri_current_worker', 'current_worker'];
    if (urlFarm) candidateKeys.unshift(`agri_worker_${urlFarm}`);
    const savedOwner = normalizeTenantId(localStorage.getItem('agri_owner_id'));
    if (savedOwner && !candidateKeys.includes(`agri_worker_${savedOwner}`)) {
      candidateKeys.push(`agri_worker_${savedOwner}`);
    }
    for (const k of candidateKeys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        const w = JSON.parse(raw);
        if (w && w.role === 'admin') return true;
      }
    }
  } catch (e) {}
  return false;
}

export function AdminOnlyGuard({ children }: AdminOnlyGuardProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(() => !hasAdminWorkerInStorage());
  const [isAdmin, setIsAdmin] = useState(() => hasAdminWorkerInStorage());

  const [farmId, setFarmId] = useState<string>('');

  useEffect(() => {
    async function verifyAdmin() {
      try {
        let resolvedFarm = '';
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          let currentFarm = normalizeTenantId(params.get('farm') || params.get('tenant') || params.get('farmId')) || '';
          if (!currentFarm) {
            const currentWorkerStr = localStorage.getItem('agri_current_worker') || localStorage.getItem('current_worker');
            if (currentWorkerStr) {
              try {
                const worker = JSON.parse(currentWorkerStr);
                if (worker?.user_id) currentFarm = normalizeTenantId(worker.user_id) || '';
              } catch (e) {}
            }
          }
          if (!currentFarm) {
            currentFarm = normalizeTenantId(localStorage.getItem('agri_owner_id')) || '';
          }
          if (currentFarm) {
            resolvedFarm = currentFarm;
            setFarmId(currentFarm);
          }
        }

        // 1. localStorage の現在の作業者ロールを即座にチェック（0ms・通信不要）
        if (hasAdminWorkerInStorage()) {
          setIsAdmin(true);
          setIsChecking(false);
          return;
        }

        // 2. Supabase Auth セッションをチェック（1.5秒タイムアウト保護付きでハング防止）
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 1500)
        );

        const res: any = await Promise.race([sessionPromise, timeoutPromise]);
        const session = res?.data?.session;
        if (session && session.user) {
          setIsAdmin(true);
          setIsChecking(false);
          return;
        }

        // 3. URLクエリに明示的な農園指定があり、作業者として非管理者ログイン中でない場合は管理者プレビュー・直接リンク閲覧を許可
        if (resolvedFarm && typeof window !== 'undefined') {
          const wRaw = localStorage.getItem(`agri_worker_${resolvedFarm}`) || localStorage.getItem('agri_current_worker');
          if (!wRaw) {
            setIsAdmin(true);
            setIsChecking(false);
            return;
          }
        }

        // 認証失敗（非管理者）
        setIsAdmin(false);
      } catch (err) {
        console.error('Admin verify failed:', err);
        setIsAdmin(false);
      } finally {
        setIsChecking(false);
      }
    }
    verifyAdmin();
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-400">管理者セキュリティ権限を確認中...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black text-white">管理者専用ページ</h2>
            <p className="text-xs font-medium text-slate-400 leading-relaxed">
              この画面は農場管理者（オーナー・農場長）のみアクセス可能です。<br />
              現場作業者アカウントでは閲覧・操作できません。
            </p>
          </div>
          <div className="pt-2 space-y-2">
            <button
              onClick={() => router.push(farmId ? `/portal/${farmId}` : '/portal')}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ポータル画面へ戻る</span>
            </button>
            <button
              onClick={() => router.push(farmId ? `/login?farm=${farmId}` : '/login')}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
            >
              管理者アカウントでログイン
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
