"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { Calendar, Download, ChevronLeft, ChevronRight, Clock, Users, Loader2, Save, FileText, Settings, ArrowLeft } from 'lucide-react';
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';

export default function MonthlyTimecardPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [logs, setLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // viewMode: 'summary' (月次集計), 'details' (全員の日別明細), 'worker_details' (個人別タイムカード)
  const [viewMode, setViewMode] = useState<'summary' | 'details' | 'worker_details'>('summary');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  
  const [editingRestMinutes, setEditingRestMinutes] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setIsLoading(false);
        return;
      }

      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      // 自社テナントの設定を取得
      const { data: cData } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cData) setCompanySettings(cData);

      // 自社テナントの従業員のみを取得
      const { data: wData } = await supabase
        .from('workers')
        .select('*')
        .eq('user_id', tenantId)
        .order('name');

      const currentWorkers = wData || [];
      setWorkers(currentWorkers);
      const workerIds = currentWorkers.map(w => w.id);

      // 自社従業員の勤怠ログのみを取得
      if (workerIds.length > 0) {
        const { data: lData, error } = await supabase
          .from('attendance_logs')
          .select('*')
          .in('worker_id', workerIds)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false });

        if (error) throw error;
        setLogs(lData || []);

        const editState: Record<string, number> = {};
        lData?.forEach(log => {
          editState[log.id] = log.actual_rest_minutes !== null ? log.actual_rest_minutes : (log.total_break_minutes || 0);
        });
        setEditingRestMinutes(editState);
      } else {
        setLogs([]);
        setEditingRestMinutes({});
      }

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
      
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, actual_rest_minutes: val } : l));
      alert('休憩時間を保存しました');
    } catch (err: any) {
      alert('保存エラー: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const calculateWorkHours = (log: any) => {
    if (!log.clock_in || !log.clock_out) return { totalMinutes: 0, roundedIn: null, roundedOut: null, restMins: 0 };

    // workerの特定（UUIDの一致、または worker_id == pin_code などのレガシー互換を考慮）
    // とりあえず id == worker_id で探す。
    const worker = workers.find(w => w.id === log.worker_id) || {};
    const logDate = log.date; 
    
    const stdStartStr = worker.standard_start_time || companySettings?.default_start_time || '08:00:00';
    const stdEndStr = worker.standard_end_time || companySettings?.default_end_time || '17:00:00';
    const stdRest = worker.standard_rest_minutes ?? companySettings?.default_rest_minutes ?? 60;
    const autoRoundOut = companySettings?.auto_round_out_time ?? true;

    const stdStart = new Date(`${logDate}T${stdStartStr}+09:00`);
    const stdEnd = new Date(`${logDate}T${stdEndStr}+09:00`);

    let actualIn = new Date(log.clock_in);
    let actualOut = new Date(log.clock_out);

    let calcIn = actualIn;
    if (actualIn < stdStart) calcIn = stdStart;

    let calcOut = actualOut;
    if (autoRoundOut && actualOut > stdEnd) calcOut = stdEnd;

    let diffMins = Math.floor((calcOut.getTime() - calcIn.getTime()) / 60000);
    const restMins = log.actual_rest_minutes !== null ? log.actual_rest_minutes : (log.total_break_minutes || stdRest);

    diffMins = Math.max(0, diffMins - restMins);

    return { totalMinutes: diffMins, roundedIn: calcIn, roundedOut: calcOut, restMins };
  };

  const formatTime = (d: Date | null) => d ? d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  // サマリー計算（打刻ログベース）
  const summaryByWorker = logs.reduce((acc, log) => {
    // 古いテストデータなどで worker_id が無い・一致しない場合は「不明」になる。
    const worker = workers.find(w => w.id === log.worker_id);
    const workerId = worker ? worker.id : log.worker_id; // idがない場合は生のworker_idを使う
    const workerName = worker ? worker.name : `不明 (ID: ${log.worker_id.substring(0,8)}...)`;
    
    if (!acc[workerId]) {
      acc[workerId] = { workerId, name: workerName, days: 0, totalMinutes: 0, breakMinutes: 0 };
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

  // カレンダー形式の個人別タイムカード生成
  const generateWorkerCalendar = (workerId: string) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendar = [];

    const workerLogs = logs.filter(l => l.worker_id === workerId);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const log = workerLogs.find(l => l.date === dateStr);
      calendar.push({
        date: dateStr,
        day: d,
        log: log || null
      });
    }
    return calendar;
  };

  return (
    <AdminOnlyGuard>
      <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            月次タイムカード
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            定時丸め・休憩時間補正が適用された労働時間の集計です。
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {viewMode === 'worker_details' ? (
            <button 
              onClick={() => { setViewMode('summary'); setSelectedWorkerId(null); }}
              className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> 一覧へ戻る
            </button>
          ) : (
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
                全社明細
              </button>
            </div>
          )}

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
          <div className="font-black text-lg text-slate-700 flex items-center gap-4">
            <span>{currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月</span>
            {viewMode === 'worker_details' && selectedWorkerId && (
              <>
                <span className="text-slate-300">|</span>
                <span className="text-blue-600 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {summaryByWorker[selectedWorkerId]?.name || '退職者・不明'} さんのタイムカード
                </span>
              </>
            )}
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
            {viewMode === 'summary' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-500">
                    <th className="p-4">従業員名</th>
                    <th className="p-4 text-center">出勤日数</th>
                    <th className="p-4 text-center">総休憩時間</th>
                    <th className="p-4 text-center">総労働時間（補正後）</th>
                    <th className="p-4 text-center">詳細</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryArray.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold">打刻データがありません</td></tr>
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
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => { setSelectedWorkerId(worker.workerId); setViewMode('worker_details'); }}
                          className="px-4 py-2 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-600 font-bold text-sm rounded-lg transition-colors"
                        >
                          タイムカードを開く
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {viewMode === 'worker_details' && selectedWorkerId && (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-blue-50 border-b border-blue-100 text-sm font-bold text-blue-800">
                    <th className="p-4 w-32">日付</th>
                    <th className="p-4 text-center">打刻時刻</th>
                    <th className="p-4 text-center">計算上(補正後)</th>
                    <th className="p-4 text-center w-48">休憩時間(分)</th>
                    <th className="p-4 text-center">労働時間</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {generateWorkerCalendar(selectedWorkerId).map(({ date, day, log }) => {
                    const dt = new Date(date);
                    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                    
                    if (!log) {
                      return (
                        <tr key={date} className={`hover:bg-slate-50 ${isWeekend ? 'bg-slate-50/50' : ''}`}>
                          <td className={`p-4 font-bold ${dt.getDay() === 0 ? 'text-rose-500' : dt.getDay() === 6 ? 'text-blue-500' : 'text-slate-700'}`}>
                            {day}日 ({['日','月','火','水','木','金','土'][dt.getDay()]})
                          </td>
                          <td className="p-4 text-center text-slate-300">-</td>
                          <td className="p-4 text-center text-slate-300">-</td>
                          <td className="p-4 text-center text-slate-300">-</td>
                          <td className="p-4 text-center text-slate-300">-</td>
                        </tr>
                      );
                    }

                    const { totalMinutes, roundedIn, roundedOut } = calculateWorkHours(log);
                    return (
                      <tr key={log.id} className="hover:bg-blue-50/30 group">
                        <td className={`p-4 font-bold ${dt.getDay() === 0 ? 'text-rose-500' : dt.getDay() === 6 ? 'text-blue-500' : 'text-slate-700'}`}>
                          {day}日 ({['日','月','火','水','木','金','土'][dt.getDay()]})
                        </td>
                        <td className="p-4 text-center">
                          <div className="text-sm text-slate-400 font-bold">
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
                        <td className="p-4 text-center font-black text-slate-700 text-lg">
                          {Math.floor(totalMinutes/60)}h {totalMinutes%60}m
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {viewMode === 'details' && (
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
                    const worker = workers.find(w => w.id === log.worker_id) || { name: `不明 (ID: ${log.worker_id.substring(0,8)})` };
                    const { totalMinutes, roundedIn, roundedOut } = calculateWorkHours(log);
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
    </AdminOnlyGuard>
  );
}
