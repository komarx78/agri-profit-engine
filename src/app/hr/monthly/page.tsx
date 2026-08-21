"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, Download, ChevronLeft, ChevronRight, Clock, Users, Loader2, Save, FileText, Settings } from 'lucide-react';

export default function MonthlyTimecardPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [logs, setLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // viewMode: 'summary' (月次集計) or 'details' (日別明細)
  const [viewMode, setViewMode] = useState<'summary' | 'details'>('summary');
  const [editingRestMinutes, setEditingRestMinutes] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      // 会社基本設定を取得
      const { data: cData } = await supabase.from('company_settings').select('*').order('created_at', { ascending: false }).limit(1).single();
      if (cData) setCompanySettings(cData);

      // 従業員マスタを取得
      const { data: wData } = await supabase.from('workers').select('*');
      if (wData) setWorkers(wData);

      // 対象月の打刻ログを取得
      const { data: lData, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;
      setLogs(lData || []);

      // 編集用ステートの初期化
      const editState: Record<string, number> = {};
      lData?.forEach(log => {
        editState[log.id] = log.actual_rest_minutes !== null ? log.actual_rest_minutes : (log.total_break_minutes || 0);
      });
      setEditingRestMinutes(editState);

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(newDate);
  };

  const handleRestMinutesChange = (logId: string, val: number) => {
    setEditingRestMinutes(prev => ({ ...prev, [logId]: val }));
  };

  const saveRestMinutes = async (logId: string) => {
    setIsSaving(true);
    try {
      const val = editingRestMinutes[logId];
      const { error } = await supabase.from('attendance_logs').update({ actual_rest_minutes: val }).eq('id', logId);
      if (error) throw error;
      
      // ローカルステートも更新
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, actual_rest_minutes: val } : l));
      alert('休憩時間を保存しました');
    } catch (err: any) {
      alert('保存エラー: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 勤怠計算エンジン（丸め・定時補正）
  const calculateWorkHours = (log: any) => {
    if (!log.clock_in || !log.clock_out) return { totalMinutes: 0, roundedIn: null, roundedOut: null, restMins: 0 };

    // 該当従業員と会社設定から定時を取得
    const worker = workers.find(w => w.id === log.worker_id) || {};
    
    // YYYY-MM-DD に合わせてパース用文字列作成
    const logDate = log.date; 
    
    // 定時設定の決定（従業員設定優先、なければ会社設定、なければデフォルト）
    const stdStartStr = worker.standard_start_time || companySettings?.default_start_time || '08:00:00';
    const stdEndStr = worker.standard_end_time || companySettings?.default_end_time || '17:00:00';
    const stdRest = worker.standard_rest_minutes ?? companySettings?.default_rest_minutes ?? 60;
    const autoRoundOut = companySettings?.auto_round_out_time ?? true;

    const stdStart = new Date(`${logDate}T${stdStartStr}+09:00`);
    const stdEnd = new Date(`${logDate}T${stdEndStr}+09:00`);

    let actualIn = new Date(log.clock_in);
    let actualOut = new Date(log.clock_out);

    // 出勤補正：定時前に打刻した場合は、定時を出勤時刻とする
    let calcIn = actualIn;
    if (actualIn < stdStart) {
      calcIn = stdStart;
    }

    // 退勤補正：丸め設定がONで、定時以降に打刻した場合は、定時を退勤時刻とする
    let calcOut = actualOut;
    if (autoRoundOut && actualOut > stdEnd) {
      calcOut = stdEnd;
    }

    let diffMins = Math.floor((calcOut.getTime() - calcIn.getTime()) / 60000);
    
    // 休憩時間を引く（手修正されたactual_rest_minutes優先、なければシステム打刻のbreak、なければ定時休憩）
    const restMins = log.actual_rest_minutes !== null 
                     ? log.actual_rest_minutes 
                     : (log.total_break_minutes || stdRest);

    diffMins = Math.max(0, diffMins - restMins);

    return { totalMinutes: diffMins, roundedIn: calcIn, roundedOut: calcOut, restMins };
  };

  // 従業員ごとの集計
  const summaryByWorker = logs.reduce((acc, log) => {
    const worker = workers.find(w => w.id === log.worker_id) || { name: '不明' };
    const workerId = worker.id || log.worker_id;
    
    if (!acc[workerId]) {
      acc[workerId] = { workerId, name: worker.name, days: 0, totalMinutes: 0, breakMinutes: 0 };
    }
    
    if (log.clock_in && log.clock_out) {
      acc[workerId].days += 1;
      const { totalMinutes, restMins } = calculateWorkHours(log);
      acc[workerId].totalMinutes += totalMinutes;
      acc[workerId].breakMinutes += restMins;
    }
    return acc;
  }, {} as Record<string, any>);

  const summaryArray = Object.values(summaryByWorker);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            月次タイムカード集計
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            定時丸め・休憩時間補正が適用された労働時間の集計です。
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* タブ切り替え */}
          <div className="bg-slate-200 p-1 rounded-xl flex items-center mr-4">
            <button 
              onClick={() => setViewMode('summary')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode === 'summary' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              月次集計
            </button>
            <button 
              onClick={() => setViewMode('details')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode === 'details' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              日別明細・休憩編集
            </button>
          </div>

          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" /> CSV出力
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <button 
            onClick={() => changeMonth(-1)}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="font-black text-lg text-slate-700">
            {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
          </div>
          <button 
            onClick={() => changeMonth(1)}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-600"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            {viewMode === 'summary' ? (
              // ▼ 月次集計ビュー
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-500">
                    <th className="p-4">従業員名</th>
                    <th className="p-4 text-center">出勤日数</th>
                    <th className="p-4 text-center">総休憩時間</th>
                    <th className="p-4 text-center">総労働時間（補正後）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryArray.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold">打刻データがありません</td></tr>
                  )}
                  {summaryArray.map((worker: any) => (
                    <tr key={worker.workerId} className="hover:bg-slate-50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-slate-800 text-base">{worker.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center font-bold text-slate-700">{worker.days} 日</td>
                      <td className="p-4 text-center font-bold text-slate-500">
                        {Math.floor(worker.breakMinutes/60)}時間 {worker.breakMinutes%60}分
                      </td>
                      <td className="p-4 text-center font-black text-blue-600 text-xl">
                        {Math.floor(worker.totalMinutes/60)}時間 {worker.totalMinutes%60}分
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              // ▼ 日別明細・休憩編集ビュー
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-500">
                    <th className="p-4 w-32">日付</th>
                    <th className="p-4">従業員名</th>
                    <th className="p-4 text-center">打刻時刻</th>
                    <th className="p-4 text-center">計算上(補正後)</th>
                    <th className="p-4 text-center w-48">休憩時間(分)</th>
                    <th className="p-4 text-center">労働時間</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">打刻データがありません</td></tr>
                  )}
                  {logs.map((log: any) => {
                    const worker = workers.find(w => w.id === log.worker_id) || { name: '不明' };
                    const { totalMinutes, roundedIn, roundedOut } = calculateWorkHours(log);
                    
                    const formatTime = (d: Date | null) => d ? d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                    
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 group">
                        <td className="p-4 font-bold text-slate-700">{log.date}</td>
                        <td className="p-4 font-bold text-slate-800">{worker.name}</td>
                        <td className="p-4 text-center">
                          <div className="text-xs text-slate-400 font-bold">
                            {formatTime(log.clock_in ? new Date(log.clock_in) : null)} 〜 {formatTime(log.clock_out ? new Date(log.clock_out) : null)}
                          </div>
                        </td>
                        <td className="p-4 text-center font-bold text-blue-600">
                          {formatTime(roundedIn)} 〜 {formatTime(roundedOut)}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="number"
                              value={editingRestMinutes[log.id] ?? ''}
                              onChange={(e) => handleRestMinutesChange(log.id, Number(e.target.value))}
                              className="w-16 p-1.5 border border-slate-200 rounded-md text-center font-bold focus:border-blue-500 focus:outline-none"
                            />
                            <button 
                              onClick={() => saveRestMinutes(log.id)}
                              disabled={isSaving}
                              className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded-md transition-colors"
                              title="休憩時間を保存"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-center font-black text-slate-700">
                          {Math.floor(totalMinutes/60)}h {totalMinutes%60}m
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
