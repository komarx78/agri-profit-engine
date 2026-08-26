"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Save, Plus, Trash2, Globe2, Loader2, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import VideoPlayerWithSubtitles, { Narration } from '@/components/VideoPlayerWithSubtitles';

export default function ManualDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [video, setVideo] = useState<any>(null);
  const [narrations, setNarrations] = useState<Narration[]>([]);
  const [language, setLanguage] = useState<'ja' | 'en' | 'vi'>('ja');
  const [isLoading, setIsLoading] = useState(true);
  
  // 編集用ステート
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState<string>('');
  const [editEnd, setEditEnd] = useState<string>('');
  const [editJa, setEditJa] = useState<string>('');
  const [editEn, setEditEn] = useState<string>('');
  const [editVi, setEditVi] = useState<string>('');
  
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (id) fetchVideoData();
  }, [id]);

  const fetchVideoData = async () => {
    setIsLoading(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        throw new Error('テナントIDが特定できません');
      }

      // 1. 動画情報の取得 (自社テナントのみ)
      const { data: videoData, error: videoError } = await supabase
        .from('video_manuals')
        .select('*')
        .eq('id', id)
        .eq('user_id', tenantId)
        .single();
      
      if (videoError) throw videoError;
      setVideo(videoData);

      // 2. ナレーション情報の取得
      const { data: narrationData, error: narrationError } = await supabase
        .from('video_narrations')
        .select('*')
        .eq('video_id', id)
        .order('start_time', { ascending: true });
        
      if (narrationError) throw narrationError;
      setNarrations(narrationData || []);

    } catch (error) {
      console.error('Failed to load video details:', error);
      alert('データの読み込みに失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const startNewEditing = () => {
    setEditingId('new');
    setEditStart(Math.floor(currentPlaybackTime).toString());
    setEditEnd(Math.floor(currentPlaybackTime + 5).toString());
    setEditJa('');
    setEditEn('');
    setEditVi('');
  };

  const startEditing = (n: Narration) => {
    setEditingId(n.id);
    setEditStart(n.start_time.toString());
    setEditEnd(n.end_time.toString());
    setEditJa(n.script_ja);
    setEditEn(n.script_en || '');
    setEditVi(n.script_vi || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleAutoTranslate = async () => {
    if (!editJa) return alert('日本語の台本を入力してください');
    
    setIsSaving(true);
    try {
      // APIルートを呼び出して翻訳を実行 (今回は仮のモック処理を実装、または実際のAPI呼び出し)
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editJa })
      });
      
      if (!res.ok) {
        // APIがない場合のフォールバック（プロトタイプ用モック）
        setTimeout(() => {
          setEditEn(`[EN] ${editJa}`);
          setEditVi(`[VI] ${editJa}`);
          setIsSaving(false);
        }, 1000);
        return;
      }

      const { english, vietnamese } = await res.json();
      setEditEn(english);
      setEditVi(vietnamese);
    } catch (error) {
      console.error(error);
      alert('翻訳に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const saveNarration = async () => {
    if (!editStart || !editEnd || !editJa) {
      return alert('開始時間、終了時間、日本語台本は必須です。');
    }

    setIsSaving(true);
    try {
      const payload = {
        video_id: id,
        start_time: Number(editStart),
        end_time: Number(editEnd),
        script_ja: editJa,
        script_en: editEn || null,
        script_vi: editVi || null
      };

      if (editingId === 'new') {
        const { error } = await supabase.from('video_narrations').insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('video_narrations').update(payload).eq('id', editingId);
        if (error) throw error;
      }

      await fetchVideoData();
      setEditingId(null);
    } catch (error) {
      console.error('Save failed:', error);
      alert('保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteNarration = async (narrationId: string) => {
    if (!window.confirm('このナレーションを削除しますか？')) return;
    try {
      const { error } = await supabase.from('video_narrations').delete().eq('id', narrationId);
      if (error) throw error;
      await fetchVideoData();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('削除に失敗しました。');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-slate-50">
        <p>動画が見つかりません</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800 pb-24">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex justify-between items-end">
          <div>
            <Link href="/manuals" className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-slate-800 mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" />
              一覧に戻る
            </Link>
            <h1 className="text-2xl font-black text-slate-800">{video.title}</h1>
            {video.description && <p className="text-sm text-slate-500 mt-2">{video.description}</p>}
          </div>
          
          {/* 言語切り替えボタン */}
          <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
            {[
              { id: 'ja', label: '日本語' },
              { id: 'en', label: 'English' },
              { id: 'vi', label: 'Tiếng Việt' }
            ].map((lang) => (
              <button
                key={lang.id}
                onClick={() => setLanguage(lang.id as any)}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${
                  language === lang.id 
                    ? 'bg-red-50 text-red-700 shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 左側: 動画プレイヤー */}
          <div className="lg:col-span-2 space-y-4">
            <VideoPlayerWithSubtitles 
              videoUrl={video.video_url} 
              narrations={narrations} 
              language={language}
              onTimeUpdate={(time) => setCurrentPlaybackTime(time)}
            />
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2 text-slate-600 font-mono">
                <Clock className="w-5 h-5 text-slate-400" />
                現在の再生位置: <span className="font-bold text-slate-800">{currentPlaybackTime.toFixed(1)} 秒</span>
              </div>
              <button 
                onClick={startNewEditing}
                disabled={editingId !== null}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                <Plus className="w-4 h-4" /> ここに台本を追加
              </button>
            </div>
          </div>

          {/* 右側: タイムラインと台本編集 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="font-black text-slate-800 flex items-center gap-2">
                台本・ナレーション一覧
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {narrations.length === 0 && editingId === null && (
                <p className="text-center text-slate-400 text-sm py-10">登録されている台本はありません</p>
              )}

              {/* 新規追加用フォーム (リストの先頭に表示) */}
              {editingId === 'new' && (
                <div className="border-2 border-red-200 bg-red-50 rounded-xl p-4 animate-fade-in shadow-inner">
                  <div className="flex items-center gap-2 mb-3">
                    <input type="number" value={editStart} onChange={e=>setEditStart(e.target.value)} className="w-16 p-1 border rounded" /> 秒 〜
                    <input type="number" value={editEnd} onChange={e=>setEditEnd(e.target.value)} className="w-16 p-1 border rounded" /> 秒
                  </div>
                  <textarea value={editJa} onChange={e=>setEditJa(e.target.value)} placeholder="日本語の台本" className="w-full p-2 border rounded mb-2 text-sm" rows={2} />
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-500">翻訳</span>
                    <button onClick={handleAutoTranslate} type="button" disabled={isSaving} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-200">
                      <Globe2 className="w-3 h-3" /> 自動翻訳
                    </button>
                  </div>
                  <textarea value={editEn} onChange={e=>setEditEn(e.target.value)} placeholder="English" className="w-full p-2 border rounded mb-2 text-sm" rows={1} />
                  <textarea value={editVi} onChange={e=>setEditVi(e.target.value)} placeholder="Tiếng Việt" className="w-full p-2 border rounded mb-3 text-sm" rows={1} />
                  
                  <div className="flex gap-2">
                    <button onClick={saveNarration} disabled={isSaving} className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-red-700">保存</button>
                    <button onClick={cancelEditing} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg font-bold text-sm hover:bg-slate-300">取消</button>
                  </div>
                </div>
              )}

              {narrations.map(n => (
                <div key={n.id}>
                  {editingId === n.id ? (
                    <div className="border-2 border-blue-200 bg-blue-50 rounded-xl p-4 shadow-inner">
                      <div className="flex items-center gap-2 mb-3">
                        <input type="number" value={editStart} onChange={e=>setEditStart(e.target.value)} className="w-16 p-1 border rounded" /> 秒 〜
                        <input type="number" value={editEnd} onChange={e=>setEditEnd(e.target.value)} className="w-16 p-1 border rounded" /> 秒
                      </div>
                      <textarea value={editJa} onChange={e=>setEditJa(e.target.value)} className="w-full p-2 border rounded mb-2 text-sm" rows={2} />
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-500">翻訳</span>
                        <button onClick={handleAutoTranslate} type="button" disabled={isSaving} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-200">
                          <Globe2 className="w-3 h-3" /> 自動翻訳
                        </button>
                      </div>
                      <textarea value={editEn} onChange={e=>setEditEn(e.target.value)} className="w-full p-2 border rounded mb-2 text-sm" rows={1} />
                      <textarea value={editVi} onChange={e=>setEditVi(e.target.value)} className="w-full p-2 border rounded mb-3 text-sm" rows={1} />
                      
                      <div className="flex gap-2">
                        <button onClick={saveNarration} disabled={isSaving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-blue-700">更新</button>
                        <button onClick={cancelEditing} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg font-bold text-sm hover:bg-slate-300">取消</button>
                      </div>
                    </div>
                  ) : (
                    <div className={`p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer ${currentPlaybackTime >= n.start_time && currentPlaybackTime <= n.end_time ? 'bg-red-50 border-red-200' : 'bg-white'}`} onClick={() => startEditing(n)}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-black bg-slate-100 text-slate-600 px-2 py-1 rounded">
                          {n.start_time}s - {n.end_time}s
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); deleteNarration(n.id); }} className="text-slate-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm font-bold text-slate-800 mb-1">{n.script_ja}</p>
                      {n.script_en && <p className="text-xs text-slate-500 truncate border-l-2 border-slate-300 pl-2 mb-1">{n.script_en}</p>}
                      {n.script_vi && <p className="text-xs text-slate-500 truncate border-l-2 border-slate-300 pl-2">{n.script_vi}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
