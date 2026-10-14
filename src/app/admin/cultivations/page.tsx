"use client";

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import CultivationsHub from '@/components/CultivationsHub';

function CultivationsContent() {
  const searchParams = useSearchParams();
  const initialSubTab = (searchParams.get('tab') as 'cultivations' | 'pesticide' | 'history' | 'tasks') || 'cultivations';
  // focus=calendar: 左メニュー「作付けこよみ（計画）」から来た時、年間こよみ表の位置を最初に表示する
  const initialFocus = searchParams.get('focus') || '';

  return <CultivationsHub initialSubTab={initialSubTab} initialFocus={initialFocus} />;
}

export default function CultivationsPage() {
  return (
    <Suspense fallback={
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    }>
      <CultivationsContent />
    </Suspense>
  );
}
