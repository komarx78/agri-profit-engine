"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ManualsPage() {
  const router = useRouter();

  useEffect(() => {
    // 最新の統合ポータル画面（/portal）のマニュアル・動画ガイドへ自動遷移
    router.replace('/portal?manual=1');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6">
      <Loader2 className="w-10 h-10 text-rose-500 animate-spin mb-4" />
      <p className="font-bold text-sm text-slate-300">マニュアル・動画ガイドへ移動中...</p>
    </div>
  );
}
