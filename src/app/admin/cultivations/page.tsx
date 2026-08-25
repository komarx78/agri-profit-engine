"use client";

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import CultivationsHub from '@/components/CultivationsHub';

function CultivationsContent() {
  const searchParams = useSearchParams();
  const initialSubTab = (searchParams.get('tab') as 'cultivations' | 'pesticide' | 'history' | 'tasks') || 'cultivations';

  return <CultivationsHub initialSubTab={initialSubTab} />;
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
