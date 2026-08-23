"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Video, PlayCircle, Plus, Loader2, Upload, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ManualsPage() {
  const [manuals, setManuals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);

  useEffect(() => {
    fetchManuals();
  }, []);

  const fetchManuals = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('video_manuals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching manuals:', error);
    } else {
      setManuals(data || []);
    }
    setIsLoading(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !videoFile) return;

    setIsUploading(true);

    try {
      // 1. Supabase Storageに動画をアップロード (bucket名: videos)
      // 注意: 事前にSupabaseダッシュボードで 'videos' というStorage Bucketを作成し、Publicアクセスを許可しておく必要があります
      const fileExt = videoFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, videoFile);

      if (uploadError) throw uploadError;

      // 2. アップロードした動画の公開URLを取得
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      // 3. データベースに登録
      const { error: dbError } = await supabase
        .from('video_manuals')
        .insert([
          {
            title: newTitle,
            description: newDesc,
            video_url: publicUrl
          }
        ]);

      if (dbError) throw dbError;

      // 成功時処理
      setIsModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setVideoFile(null);
      await fetchManuals();
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert('アップロードに失敗しました。Storageに「videos」バケットが作成されているか確認してください。');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('本当にこの動画マニュアルを削除しますか？')) return;
    
    // Note: Storageのファイル削除処理も本来は必要ですがプロトタイプとしてDBレコードのみ削除
    const { error } = await supabase.from('video_manuals').delete().eq('id', id);
    if (!error) fetchManuals();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800 pb-24 max-w-7xl mx-auto">
      <header className="mb-8 pb-4 border-b border-slate-200 mt-4 flex justify-between items-end">
        <div>
          <Link href="/" className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-slate-800 mb-6 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            ホームに戻る
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <Video className="w-8 h-8 text-red-600" />
            </div>
            動画マニュアル管理システム
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-3 ml-2">
            動画と多言語ナレーション（台本）を管理します。
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          新規動画を追加
        </button>
      </header>

      {/* マニュアルリスト */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
        </div>
      ) : manuals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {manuals.map((manual) => (
            <Link href={`/manuals/${manual.id}`} key={manual.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-md hover:border-red-300 transition-all group cursor-pointer flex flex-col relative">
              <div className="w-full h-48 bg-slate-800 relative flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                <PlayCircle className="w-16 h-16 text-white opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              </div>
              <button 
                onClick={(e) => handleDelete(manual.id, e)}
                className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-red-600 text-white rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="p-5 flex flex-col flex-1">
                <h2 className="text-lg font-black text-slate-800 mb-2 group-hover:text-red-600 transition-colors">
                  {manual.title}
                </h2>
                <p className="text-sm font-medium text-slate-600 leading-relaxed flex-1">
                  {manual.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <Video className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-700 mb-2">現在、登録されている動画マニュアルはありません</h2>
          <p className="text-slate-500 text-sm mb-6">右上のボタンから最初の動画をアップロードしてください。</p>
        </div>
      )}

      {/* 新規追加モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-black text-slate-800">新規動画のアップロード</h2>
              <button onClick={() => !isUploading && setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">タイトル <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  placeholder="例: 初期設定と基本操作"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">説明</label>
                <textarea 
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 h-24"
                  placeholder="動画の概要を入力してください"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">動画ファイル (MP4等) <span className="text-red-500">*</span></label>
                <input 
                  type="file" 
                  accept="video/*"
                  onChange={e => setVideoFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  required
                />
                <p className="text-xs text-slate-500 mt-2">※SupabaseのStorage（videosバケット）に保存されます。</p>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isUploading}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  キャンセル
                </button>
                <button 
                  type="submit"
                  disabled={isUploading || !newTitle || !videoFile}
                  className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> アップロード中...</>
                  ) : (
                    <><Upload className="w-5 h-5" /> 登録する</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
