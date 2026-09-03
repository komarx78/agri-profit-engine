"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SalesAccountingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/accounting-management/accounting');
  }, [router]);

  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center text-slate-500 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      <p className="text-xs font-bold text-slate-400">最新の会計連携システムへ移動中...</p>
    </div>
  );
}
