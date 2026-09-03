"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AdminMonthlyExpensesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/accounting-management/monthly-expenses');
  }, [router]);

  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center text-slate-500 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      <p className="text-xs font-bold text-slate-400">経理・購買管理システムへ移動中...</p>
    </div>
  );
}
