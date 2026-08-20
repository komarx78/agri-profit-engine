import React from 'react';
import Link from 'next/link';

export default function HrMockPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-black text-slate-800 mb-4">勤怠・有給管理システム</h1>
      <p className="text-slate-500 mb-8">こちらの機能は現在開発中でございます。</p>
      <Link href="/" className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
        ポータルへ戻る
      </Link>
    </div>
  );
}
