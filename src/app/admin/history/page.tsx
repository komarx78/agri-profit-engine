"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { History, Search, Download, CheckCircle2, Clock, Filter, User, MapPin, Sprout, Image as ImageIcon, FileText, X, Video, Play } from 'lucide-react';
import Papa from 'papaparse';

export default function HistoryPage() {
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // フィルター用ステート
  const [filterWorker, setFilterWorker] = useState<string>('all');
  const [filterField, setFilterField] = useState<string>('all');
  const [filterCrop, setFilterCrop] = useState<string>('all');

  // モーダル用ステート
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const { data, error } = await supabase
          .from('work_logs')
          .select(`
            id,
            work_date,
            start_time,
            end_time,
            duration_minutes,
            work_type,
            status,
            memo,
            photo_url,
            video_url,
            crops(name),
            fields(name),
            workers(name),
            materials(name),
            material_quantity
          `)
          .neq('status', 'planned')
          .order('start_time', { ascending: false });

        if (error) throw error;
        if (data) setWorkLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchHistory();
  }, []);

  // フィルターの選択肢を抽出（重複排除）
  const uniqueWorkers = useMemo(() => {
    const names = workLogs.map(log => log.workers?.name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [workLogs]);

  const uniqueFields = useMemo(() => {
    const names = workLogs.map(log => log.fields?.name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [workLogs]);

  const uniqueCrops = useMemo(() => {
    const names = workLogs.map(log => log.crops?.name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [workLogs]);

  // 表示するログをフィルタリング
  const filteredLogs = useMemo(() => {
    return workLogs.filter(log => {
      const matchWorker = filterWorker === 'all' || log.workers?.name === filterWorker;
      const matchField = filterField === 'all' || log.fields?.name === filterField;
      const matchCrop = filterCrop === 'all' || log.crops?.name === filterCrop;
      return matchWorker && matchField && matchCrop;
    });
  }, [workLogs, filterWorker, filterField, filterCrop]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    
    const exportData = filteredLogs.map(log => {
      const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      };

      return {
        '日付': log.work_date || '',
        '作業者': log.workers?.name || '不明',
        '作目': log.crops?.name || '不明',
        '圃場': log.fields?.name || '不明',
        '作業内容': log.work_type || '',
        '開始時間': formatDate(log.start_time),
        '終了時間': formatDate(log.end_time),
        '作業時間(分)': log.duration_minutes || 0,
        '使用資材': log.materials?.name || '',
        '資材使用量': log.material_quantity || '',
        'ステータス': log.status === 'running' ? '作業中' : '完了',
        'メモ': log.memo || ''
      };
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `作業履歴_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <History className="w-8 h-8 text-emerald-600" />
            作業記録一覧
          </h1>
          <p className="text-slate-500 mt-2 font-medium">現場で打刻・入力された作業の生データ一覧です。</p>
        </div>
        
        <button
          onClick={handleExportCSV}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          表示中データをCSV出力
        </button>
      </div>

      {/* フィルターUI */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex items-center gap-2 text-slate-500 font-bold shrink-0">
          <Filter className="w-5 h-5" /> 絞り込み:
        </div>
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
          {/* 人別フィルター */}
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <User className="w-4 h-4 text-slate-400" />
            </div>
            <select 
              value={filterWorker}
              onChange={(e) => setFilterWorker(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-emerald-500 appearance-none"
            >
              <option value="all">すべての人</option>
              {uniqueWorkers.map(w => (
                <option key={w as string} value={w as string}>{w}</option>
              ))}
            </select>
          </div>

          {/* 作業場別フィルター */}
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <MapPin className="w-4 h-4 text-slate-400" />
            </div>
            <select 
              value={filterField}
              onChange={(e) => setFilterField(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-emerald-500 appearance-none"
            >
              <option value="all">すべての作業場(圃場)</option>
              {uniqueFields.map(f => (
                <option key={f as string} value={f as string}>{f}</option>
              ))}
            </select>
          </div>

          {/* 作目別フィルター */}
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Sprout className="w-4 h-4 text-slate-400" />
            </div>
            <select 
              value={filterCrop}
              onChange={(e) => setFilterCrop(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-emerald-500 appearance-none"
            >
              <option value="all">すべての作目</option>
              {uniqueCrops.map(c => (
                <option key={c as string} value={c as string}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 履歴テーブル */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                <th className="p-4 font-bold">日付</th>
                <th className="p-4 font-bold">作業者</th>
                <th className="p-4 font-bold">作業詳細</th>
                <th className="p-4 font-bold">時間</th>
                <th className="p-4 font-bold">資材</th>
                <th className="p-4 font-bold">記録内容 (写真・メモ)</th>
                <th className="p-4 font-bold">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">条件に一致する作業記録がありません</td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-700">{log.work_date}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xs">
                          {(log.workers?.name || '?').slice(0, 1)}
                        </div>
                        <span className="font-bold text-slate-700">{log.workers?.name || '不明'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{log.crops?.name || '-'} / <span className="text-slate-500">{log.work_type}</span></div>
                      <div className="text-xs text-slate-400 mt-1">{log.fields?.name || '-'}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                          {formatTime(log.start_time)} ~ {formatTime(log.end_time)}
                        </div>
                        {log.duration_minutes > 0 && (
                          <div className="text-emerald-600 font-bold text-sm">
                            {log.duration_minutes}分
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {log.materials?.name ? (
                        <div>
                          <div className="text-sm font-bold text-purple-700">{log.materials.name}</div>
                          <div className="text-xs text-purple-400">使用量: {log.material_quantity}</div>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {log.photo_url ? (
                          <button onClick={() => setSelectedLog(log)} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-emerald-500 transition-all cursor-pointer">
                            <img src={log.photo_url} alt="写真" className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
                            <ImageIcon className="w-5 h-5 opacity-50" />
                          </div>
                        )}
                        {log.video_url && (
                          <button onClick={() => setSelectedLog(log)} className="relative w-12 h-12 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center hover:ring-2 hover:ring-emerald-500 transition-all cursor-pointer">
                            <Video className="w-5 h-5 text-white" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <Play className="w-4 h-4 text-white fill-current opacity-80" />
                            </div>
                          </button>
                        )}
                        {log.memo && (
                          <button onClick={() => setSelectedLog(log)} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                            <FileText className="w-4 h-4 text-emerald-600" />
                            メモあり
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {log.status === 'running' ? (
                        <span className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold">
                          <Clock className="w-3 h-3 animate-spin-slow" /> 作業中
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                          <CheckCircle2 className="w-3 h-3" /> 完了
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 詳細確認モーダル */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setSelectedLog(null); setSignedVideoUrl(null); }}>
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/80 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-black text-lg">
                  {(selectedLog.workers?.name || '?').slice(0, 1)}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg">{selectedLog.workers?.name} の作業記録</h3>
                  <p className="text-sm font-bold text-slate-500">{selectedLog.work_date} {formatTime(selectedLog.start_time)} ~ {formatTime(selectedLog.end_time)}</p>
                </div>
              </div>
              <button onClick={() => { setSelectedLog(null); setSignedVideoUrl(null); }} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* 基本情報 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <span className="text-xs font-bold text-slate-400 block mb-1">作目 / 圃場</span>
                  <div className="font-black text-slate-700 text-lg">{selectedLog.crops?.name}</div>
                  <div className="text-sm font-medium text-slate-500">{selectedLog.fields?.name}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <span className="text-xs font-bold text-slate-400 block mb-1">作業内容</span>
                  <div className="font-black text-slate-700 text-lg">{selectedLog.work_type}</div>
                  <div className="text-sm font-bold text-emerald-600">{selectedLog.duration_minutes} 分</div>
                </div>
              </div>

              {/* 写真 */}
              {selectedLog.photo_url && (
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-500" /> 添付写真
                  </h4>
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                    <img src={selectedLog.photo_url} alt="作業写真" className="w-full h-auto object-contain max-h-96" />
                  </div>
                </div>
              )}

              {/* 動画 */}
              {selectedLog.video_url && (
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Video className="w-4 h-4 text-emerald-500" /> 添付動画
                  </h4>
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-black relative">
                    {!signedVideoUrl ? (
                      <div className="w-full h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <button 
                          onClick={async () => {
                            try {
                              let path = selectedLog.video_url;
                              // 過去データ対応: もしURL全体が保存されていたらパス部分だけを抽出する
                              if (path.startsWith('http')) {
                                const urlObj = new URL(path);
                                const parts = urlObj.pathname.split('/work_videos/');
                                if (parts.length > 1) path = parts[1];
                              }
                              const { data, error } = await supabase.storage.from('work_videos').createSignedUrl(path, 3600);
                              if (error) throw error;
                              if (data?.signedUrl) setSignedVideoUrl(data.signedUrl);
                            } catch(err) {
                              alert('動画の読み込みに失敗しました。');
                            }
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors"
                        >
                          <Play className="w-5 h-5 fill-current" />
                          動画を読み込む
                        </button>
                        <p className="text-xs">※セキュリティのため、再生時に読み込みを行います</p>
                      </div>
                    ) : (
                      <video 
                        src={signedVideoUrl} 
                        controls 
                        autoPlay
                        playsInline
                        className="w-full h-auto max-h-96 object-contain" 
                      />
                    )}
                  </div>
                </div>
              )}

              {/* メモ */}
              {selectedLog.memo && (
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-500" /> 作業メモ
                  </h4>
                  <div className="p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {selectedLog.memo}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
