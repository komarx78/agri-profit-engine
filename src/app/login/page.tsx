"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { User, Lock, ArrowRight, Loader2, Mail, Smartphone } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      // ログイン処理
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      // ログイン成功時は管理者画面（作付け統合司令塔）へ直接遷移
      router.push('/admin/cultivations');
      router.refresh();
    } catch (err: any) {
      console.error(err);
      if (err.message.includes('Invalid login credentials')) {
        setErrorMsg('メールアドレスまたはパスワードが間違っています。');
      } else {
        setErrorMsg('ログインに失敗しました。');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        {/* 🌾 現場スタッフ用（名前・PINログイン）直通バナー */}
        <div className="mb-6 p-4 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/40 rounded-2xl text-center space-y-2 shadow-lg">
          <div className="flex items-center justify-center gap-1.5 text-xs font-black text-emerald-400">
            <Smartphone className="w-4 h-4" />
            <span>現場作業スタッフの方はこちら</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            メールアドレスは不要です。お名前と暗証番号（PINコード）でログインできます。
          </p>
          <Link
            href="/portal"
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 text-sm cursor-pointer"
          >
            <span>🌾 現場PINログイン画面へ</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-slate-700">
            <User className="w-8 h-8 text-slate-300" />
          </div>
          <h1 className="text-2xl font-black text-white">
            管理者ログイン
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            システム管理者から発行されたメールアドレスとパスワードを入力してください
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded-lg text-sm text-center font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">メールアドレス</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="farm@example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">パスワード (6文字以上)</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors font-bold tracking-widest"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!email || password.length < 6 || isSubmitting}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 transition-colors mt-8"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                ログインして作業開始
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800 text-center">
          <Link
            href="/portal"
            className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            <span>現場スタッフ用（PINコード）ログインに戻る</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
