"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Youtube, Lock, Calendar, User, Play, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function ManualsPage() {
  const [planType, setPlanType] = useState<'standard' | 'premium' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videos, setVideos] = useState<any[]>([]);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // 1. プランの取得
        const { data: settingsData, error: settingsError } = await supabase
          .from('company_settings')
          .select('plan_type')
          .limit(1)
          .single();

        // エラーがない、または見つからない場合（デフォルトはstandard扱い）
        const currentPlan = settingsData?.plan_type || 'standard';
        setPlanType(currentPlan as 'standard' | 'premium');

        // 2. プレミアムなら動画一覧を取得
        if (currentPlan === 'premium') {
          const { data: logsData, error: logsError } = await supabase
            .from('work_logs')
            .select(`
              id,
              date,
              worker_name,
              work_type,
              notes,
              video_url,
              created_at
            `)
            .not('video_url', 'is', null)
            .order('date', { ascending: false });

          if (logsError) throw logsError;
          setVideos(logsData || []);
        }
      } catch (error) {
        console.error('Error loading manuals:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handlePlayVideo = async (path: string) => {
    try {
      // 署名付きURLを発行 (1時間有効)
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
          <h2 className="text-3xl font-black text-slate-800 mb-4">動画マニュアル集は<br/><span className="text-emerald-600 bg-emerald-50 px-2 rounded">プレミアムプラン限定</span>です</h2>
          <p className="text-slate-600 mb-8 max-w-xl mx-auto leading-relaxed">
            現場のノウハウを動画で残し、新人教育を圧倒的に効率化しませんか？<br/>
            プレミアムプランにアップグレードすると、日々の作業記録に動画（最長50MB）を添付し、この画面でマニュアルとして一覧表示できるようになります。
          </p>
          
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-6 mb-8 text-left max-w-2xl mx-auto">
            <h3 className="font-bold text-emerald-800 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              プレミアムプランの特典
            </h3>
            <ul className="space-y-3 text-emerald-700">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                作業記録ごとに最長50MB（約3〜5分）の動画を添付可能
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                動画付きの記録が自動的にマニュアル集として整理されます
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                スタッフ全員でノウハウを共有し、属人化を解消
              </li>
            </ul>
          </div>

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
          <p className="text-slate-500 mt-2 font-medium">現場のノウハウ・作業手順の記録</p>
        </div>
        <Link 
          href="/admin/plans"
          className="bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-bold py-2.5 px-5 rounded-xl transition-colors shadow-sm flex items-center gap-2"
        >
          新しい作業記録（動画付き）を作成
        </Link>
      </div>

      {/* 動画グリッド */}
      {videos.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-slate-200">
          <Youtube className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">まだ動画がありません</h3>
          <p className="text-slate-500">
            「作業予定と実績」画面から、作業を記録する際に動画を添付すると、<br/>
            自動的にここにマニュアルとして追加されます。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <div key={video.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all group">
              {/* サムネイル（今回は動画の中身がわからないのでプレースホルダーと再生ボタン） */}
              <div 
                className="aspect-video bg-slate-800 relative cursor-pointer flex items-center justify-center group-hover:bg-slate-900 transition-colors"
                onClick={() => handlePlayVideo(video.video_url)}
              >
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform backdrop-blur-sm">
                  <Play className="w-8 h-8 text-white ml-1" />
                </div>
                {/* 擬似的な動画枠デザイン */}
                <div className="absolute inset-0 border-[8px] border-slate-900/50 pointer-events-none rounded-t-2xl"></div>
              </div>
              
              <div className="p-5">
                <h3 className="font-bold text-slate-800 text-lg mb-2 line-clamp-2">
                  {video.notes || `${video.work_type}の記録`}
                </h3>
                <div className="flex flex-col gap-2 text-sm text-slate-500 font-medium">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-500" />
                    <span>{video.worker_name || '作業者未設定'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    <span>{video.date}</span>
                    <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full ml-auto">
                      {video.work_type}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
