"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { History, Search, Download, FileText, CheckCircle2, Clock } from 'lucide-react';
import Papa from 'papaparse';

export default function HistoryPage() {
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
            crops(name),
            fields(name),
            workers(name),
            materials(name),
            material_quantity
          `)
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

  const handleExportCSV = () => {
    if (workLogs.length === 0) return;
    
    const exportData = workLogs.map(log => {
      const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
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
          CSVでダウンロード
        </button>
      </div>

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
                <th className="p-4 font-bold">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">読み込み中...</td>
                </tr>
              ) : workLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">作業記録がありません</td>
                </tr>
              ) : (
                workLogs.map((log) => (
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
    </div>
  );
}
