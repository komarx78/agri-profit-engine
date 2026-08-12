"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Youtube, Lock, Play, Loader2, Sparkles, Plus, X, CheckCircle2 } from 'lucide-react';

export default function ManualsPage() {
  const [planType, setPlanType] = useState<'standard' | 'premium' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [manuals, setManuals] = useState<any[]>([]);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  // 新規追加モーダル用
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      // 1. プランの取得
      const { data: settingsData } = await supabase
        .from('company_settings')
        .select('plan_type')
        .limit(1)
        .single();

      const currentPlan = settingsData?.plan_type || 'standard';
      setPlanType(currentPlan as 'standard' | 'premium');

      // 2. プレミアムならマニュアル一覧を取得
      if (currentPlan === 'premium') {
        const { data: manualsData, error: manualsError } = await supabase
          .from('video_manuals')
          .select('*')
          .order('created_at', { ascending: false });

        if (manualsError && manualsError.code !== '42P01') throw manualsError; // テーブル未作成時は無視
        setManuals(manualsData || []);
      }
    } catch (error) {
      console.error('Error loading manuals:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const handlePlayVideo = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('work_videos')
        .createSignedUrl(path, 3600);
      
      if (error) throw error;
      if (data?.signedUrl) {
        setPlayingVideo(data.signedUrl);
      }
    } catch (error) {
      console.error('Error getting video url:', error);
      alert('動画の取得に失敗しました。');
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !videoFile) {
      setMessage({ text: 'タイトルと動画ファイルは必須です。', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("認証エラー");

      // 1. 動画のアップロード
      const fileExt = videoFile.name.split('.').pop();
      const fileName = `${userData.user.id}/manuals/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('work_videos')
        .upload(fileName, videoFile, { cacheControl: '31536000', upsert: false });
        
      if (uploadError) throw new Error('動画のアップロードに失敗しました。');

      // 2. データベースへの登録
      const { error: dbError } = await supabase
        .from('video_manuals')
        .insert([{
          user_id: userData.user.id,
          title: newTitle,
          description: newDescription,
          video_url: fileName
        }]);

      if (dbError) throw dbError;

      setMessage({ text: 'マニュアルを登録しました！', type: 'success' });
      
      // 一覧の再取得とフォームリセット
      loadData();
      setTimeout(() => {
        setIsAddModalOpen(false);
        setNewTitle('');
        setNewDescription('');
        setVideoFile(null);
        setMessage(null);
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setMessage({ text: err.message || '登録に失敗しました。', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // ==========================================
  // 通常プラン（Standard）の場合：ロック画面を表示
  // ==========================================
  if (planType !== 'premium') {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-white rounded-3xl p-8 md:p-12 text-center shadow-sm border border-slate-200">
          <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-4">動画マニュアル機能は<br/><span className="text-emerald-600 bg-emerald-50 px-2 rounded">プレミアムプラン限定</span>です</h2>
          <p className="text-slate-600 mb-8 max-w-xl mx-auto leading-relaxed">
            現場のノウハウを動画で残し、新人教育を圧倒的に効率化しませんか？<br/>
            プレミアムプランにアップグレードすると、管理画面からお手本動画を登録でき、現場の従業員がスマホからいつでも見られるようになります。
          </p>
          
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg shadow-emerald-200 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto">
            <Sparkles className="w-5 h-5" />
            プレミアムプランを検討する (準備中)
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // プレミアムプランの場合：動画一覧を表示
  // ==========================================
  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      
      {/* ヘッダー */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-white text-xs font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> PREMIUM
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Youtube className="w-8 h-8 text-rose-500" />
            動画マニュアル集
          </h1>
          <p className="text-slate-500 mt-2 font-medium">ここで登録したマニュアルは、従業員のスマホアプリからいつでも閲覧できます。</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl transition-colors shadow-sm shadow-emerald-200 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          新規マニュアルを登録
        </button>
      </div>

      {/* 動画グリッド */}
      {manuals.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-slate-200">
          <Youtube className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">まだマニュアルがありません</h3>
          <p className="text-slate-500 mb-6">
            右上のボタンから、新人教育用のお手本動画をアップロードしてください。
          </p>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-5 rounded-xl transition-colors"
          >
            最初の動画を登録する
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {manuals.map((manual) => (
            <div key={manual.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all group">
              <div 
                className="aspect-video bg-slate-800 relative cursor-pointer flex items-center justify-center group-hover:bg-slate-900 transition-colors"
                onClick={() => handlePlayVideo(manual.video_url)}
              >
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform backdrop-blur-sm">
                  <Play className="w-8 h-8 text-white ml-1" />
                </div>
              </div>
              
              <div className="p-5">
                <h3 className="font-bold text-slate-800 text-lg mb-2">{manual.title}</h3>
                {manual.description && (
                  <p className="text-sm text-slate-500 line-clamp-2">{manual.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新規登録モーダル */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSubmitting && setIsAddModalOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800">マニュアルを登録</h2>
              <button onClick={() => setIsAddModalOpen(false)} disabled={isSubmitting} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-5">
              {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 font-bold ${message.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  <CheckCircle2 className="w-5 h-5" />
                  {message.text}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">タイトル <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={newTitle} 
                  onChange={e => setNewTitle(e.target.value)} 
                  required 
                  placeholder="例: トラクターの基本的な操作方法"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-emerald-500 focus:outline-none" 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">説明・ポイント (任意)</label>
                <textarea 
                  value={newDescription} 
                  onChange={e => setNewDescription(e.target.value)} 
                  placeholder="例: エンジンをかける前の安全確認を重点的に説明しています。"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:border-emerald-500 focus:outline-none min-h-[100px]" 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">動画ファイル (最大50MB) <span className="text-rose-500">*</span></label>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 border-dashed">
                  <input 
                    type="file" 
                    accept="video/mp4,video/quicktime,video/webm" 
                    required
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && file.size > 50 * 1024 * 1024) {
                        alert('動画のサイズは50MB以下にしてください。');
                        e.target.value = '';
                        setVideoFile(null);
                      } else {
                        setVideoFile(file || null);
                      }
                    }}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} disabled={isSubmitting} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">
                  キャンセル
                </button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? 'アップロード中...' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 動画再生モーダル */}
      {playingVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl mx-auto">
            <button 
              onClick={() => setPlayingVideo(null)}
              className="absolute -top-12 right-0 text-white hover:text-rose-400 transition-colors font-bold flex items-center gap-2"
            >
              閉じる (✕)
            </button>
            <div className="bg-black rounded-2xl overflow-hidden shadow-2xl aspect-video relative">
              <video 
                src={playingVideo} 
                controls 
                autoPlay 
                className="w-full h-full object-contain"
              >
                お使いのブラウザは動画の再生に対応していません。
              </video>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
