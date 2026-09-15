"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AdminSalesHistoryRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/sales-management/sales-history');
  }, [router]);

  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center text-slate-500 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      <p className="text-xs font-bold text-slate-400">出荷履歴一覧（販売管理）へ移動中...</p>
    </div>
  );
}
