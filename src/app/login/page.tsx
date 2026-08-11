"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { User, Lock, ArrowRight, Loader2, Mail } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      if (isLoginMode) {
        // ログイン処理
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        
        // ログイン成功時は管理ダッシュボードへ
        router.push('/admin/dashboard');
        router.refresh();
      } else {
        // 新規登録処理
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (error) throw error;
        
        setSuccessMsg('アカウントを作成しました！そのままログインできます。');
        setIsLoginMode(true);
        setPassword('');
      }
    } catch (err: any) {
      console.error(err);
      if (err.message.includes('Invalid login credentials')) {
        setErrorMsg('メールアドレスまたはパスワードが間違っています。');
      } else if (err.message.includes('User already registered')) {
        setErrorMsg('このメールアドレスは既に登録されています。');
      } else {
        setErrorMsg(isLoginMode ? 'ログインに失敗しました。' : 'アカウント作成に失敗しました。');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-emerald-500/30">
            <User className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white">
            {isLoginMode ? 'ログイン' : 'アカウント作成'}
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            {isLoginMode ? 'メールアドレスとパスワードを入力してください' : '新しくシステムを利用する農家さんの登録'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded-lg text-sm text-center font-bold">
            {errorMsg}
          </div>
        )}
        
        {successMsg && (
          <div className="mb-6 p-3 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 rounded-lg text-sm text-center font-bold">
            {successMsg}
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
                {isLoginMode ? 'ログインして作業開始' : 'アカウントを作成'}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="text-sm font-bold text-slate-400 hover:text-emerald-400 transition-colors"
          >
            {isLoginMode ? '新しくアカウントを作成する' : '既にアカウントをお持ちの方はこちら'}
          </button>
        </div>
      </div>
    </main>
  );
}
