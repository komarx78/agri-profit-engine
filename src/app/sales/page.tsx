"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SalesEntryHubPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/work');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );
}
