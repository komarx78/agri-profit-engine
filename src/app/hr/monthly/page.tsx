"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { Calendar, Download, ChevronLeft, ChevronRight, Clock, Users, Loader2, Save, FileText, Settings, ArrowLeft, Edit3, Plus, Trash2, X, Check, AlertCircle, Zap } from 'lucide-react';
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';
import Link from 'next/link';
import { getAttendancePeriod, getDateListBetween } from '@/lib/dateUtils';

export default function MonthlyTimecardPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [closingDay, setClosingDay] = useState<number>(0);
  const [periodInfo, setPeriodInfo] = useState<{ startDate: string; endDate: string; label: string }>({ startDate: '', endDate: '', label: '' });
  const [logs, setLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [attendanceRules, setAttendanceRules] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // viewMode: 'summary' (月次集計), 'details' (全員の日別明細), 'worker_details' (個人別タイムカード)
  const [viewMode, setViewMode] = useState<'summary' | 'details' | 'worker_details'>('summary');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  
  const [editingRestMinutes, setEditingRestMinutes] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 管理者打刻修正モーダル用ステート
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    workerId: string;
    workerName: string;
    date: string;
    logId: string | null;
    clockIn: string; // "09:00"
    clockOut: string; // "18:00"
    restMinutes: number; // 60
    workType: string; // 'completed' | 'paid_leave' | 'half_paid_am' | 'half_paid_pm' | 'absence' | 'holiday'
    memo: string;
  }>({
    isOpen: false,
    workerId: '',
    workerName: '',
    date: '',
    logId: null,
    clockIn: '',
    clockOut: '',
    restMinutes: 60,
    workType: 'completed',
    memo: ''
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

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

      // 1. 自社テナントの設定を取得
      const { data: cData } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cData) setCompanySettings(cData);

      // 勤怠締日の解決（DB優先 ➔ LocalStorage ➔ デフォルト末日:0）
      let resolvedClosingDay = 0;
      if (typeof window !== 'undefined') {
        const localClosing = (tenantId ? localStorage.getItem(`agri_attendance_closing_day_${tenantId}`) : null) || localStorage.getItem('agri_attendance_closing_day');
        if (localClosing !== null && localClosing !== undefined && localClosing !== '') {
          resolvedClosingDay = Number(localClosing);
        }
      }

      if (cData && cData.attendance_closing_day !== undefined && cData.attendance_closing_day !== null) {
        resolvedClosingDay = Number(cData.attendance_closing_day);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`agri_attendance_closing_day_${tenantId}`, String(resolvedClosingDay));
          localStorage.setItem('agri_attendance_closing_day', String(resolvedClosingDay));
        }
      }
      setClosingDay(resolvedClosingDay);

      // 締日に基づく正確な集計期間（開始日・終了日）を算出
      const year = currentMonth.getFullYear();
      const monthNum = currentMonth.getMonth() + 1;
      const period = getAttendancePeriod(year, monthNum, resolvedClosingDay);
      setPeriodInfo(period);
      const startDate = period.startDate;
      const endDate = period.endDate;

      // 2. 勤怠ルール一覧を取得 (3重フォールバック)
      let rules: any[] = [];
      try {
        const { data: rData } = await supabase
          .from('attendance_rules')
          .select('*')
          .eq('user_id', tenantId);
        if (rData && rData.length > 0) rules = rData;
      } catch (e) {}

      if (rules.length === 0 && cData?.attendance_rules && Array.isArray(cData.attendance_rules)) {
        rules = cData.attendance_rules;
      }

      if (rules.length === 0 && typeof window !== 'undefined') {
        const saved = localStorage.getItem(`agri_attendance_rules_${tenantId}`);
        if (saved) {
          try {
            const p = JSON.parse(saved);
            if (Array.isArray(p)) rules = p;
          } catch (e) {}
        }
      }

      setAttendanceRules(rules);

      // 3. 自社テナントの従業員のみを取得
      const { data: wData } = await supabase
        .from('workers')
        .select('*')
        .eq('user_id', tenantId)
        .order('name');

      let currentWorkers = wData || [];
      if (typeof window !== 'undefined') {
        const localMapStr = localStorage.getItem(`agri_worker_rule_map_${tenantId}`);
        if (localMapStr) {
          try {
            const localMap = JSON.parse(localMapStr);
            currentWorkers = currentWorkers.map((w: any) => {
              const mapped = localMap[w.id];
              if (mapped) {
                return {
                  ...w,
                  attendance_rule_id: w.attendance_rule_id || mapped.attendance_rule_id,
                  standard_start_time: w.standard_start_time || mapped.standard_start_time,
                  standard_end_time: w.standard_end_time || mapped.standard_end_time,
                  standard_rest_minutes: w.standard_rest_minutes ?? mapped.standard_rest_minutes
                };
              }
              return w;
            });
          } catch (e) {}
        }
      }

      setWorkers(currentWorkers);
      const workerIds = currentWorkers.map(w => w.id);

      // 4. 自社従業員の勤怠ログのみを取得
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
      showToast('休憩時間を保存しました');
    } catch (err: any) {
      alert('保存エラー: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 修正モーダルを開く
  const openEditModal = (dateStr: string, workerId: string, existingLog: any | null) => {
    const worker = workers.find(w => w.id === workerId);
    const matchedRule = attendanceRules.find(r => 
      String(r.id) === String(worker?.attendance_rule_id) || 
      r.name === worker?.attendance_rule_id
    );

    const stdStart = worker?.standard_start_time || matchedRule?.start_time || companySettings?.default_start_time || '09:00';
    const stdEnd = worker?.standard_end_time || matchedRule?.end_time || companySettings?.default_end_time || '18:00';
    const stdRest = worker?.standard_rest_minutes ?? matchedRule?.rest_minutes ?? companySettings?.default_rest_minutes ?? 60;

    let inTime = '';
    let outTime = '';
    let rest = stdRest;
    let wType = 'completed';
    let memo = '';

    if (existingLog) {
      if (existingLog.clock_in) {
        const dIn = new Date(existingLog.clock_in);
        inTime = `${dIn.getHours().toString().padStart(2, '0')}:${dIn.getMinutes().toString().padStart(2, '0')}`;
      }
      if (existingLog.clock_out) {
        const dOut = new Date(existingLog.clock_out);
        outTime = `${dOut.getHours().toString().padStart(2, '0')}:${dOut.getMinutes().toString().padStart(2, '0')}`;
      }
      rest = existingLog.actual_rest_minutes !== null && existingLog.actual_rest_minutes !== undefined 
        ? existingLog.actual_rest_minutes 
        : (existingLog.total_break_minutes || stdRest);
      wType = existingLog.status || 'completed';
      memo = existingLog.memo || '';
    } else {
      inTime = stdStart.substring(0, 5);
      outTime = stdEnd.substring(0, 5);
    }

    setEditModal({
      isOpen: true,
      workerId,
      workerName: worker?.name || 'スタッフ',
      date: dateStr,
      logId: existingLog?.id || null,
      clockIn: inTime,
      clockOut: outTime,
      restMinutes: Number(rest) || 0,
      workType: wType,
      memo
    });
  };

  // 定時セット
  const applyStandardHours = () => {
    const worker = workers.find(w => w.id === editModal.workerId);
    const matchedRule = attendanceRules.find(r => 
      String(r.id) === String(worker?.attendance_rule_id) || 
      r.name === worker?.attendance_rule_id
    );
    const stdStart = worker?.standard_start_time || matchedRule?.start_time || companySettings?.default_start_time || '09:00';
    const stdEnd = worker?.standard_end_time || matchedRule?.end_time || companySettings?.default_end_time || '18:00';
    const stdRest = worker?.standard_rest_minutes ?? matchedRule?.rest_minutes ?? companySettings?.default_rest_minutes ?? 60;

    setEditModal(prev => ({
      ...prev,
      clockIn: stdStart.substring(0, 5),
      clockOut: stdEnd.substring(0, 5),
      restMinutes: Number(stdRest) || 0,
      workType: 'completed'
    }));
  };

  // 打刻保存
  const handleSaveAttendanceLog = async () => {
    setIsSaving(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('テナントIDが取得できませんでした');

      let isoClockIn: string | null = null;
      let isoClockOut: string | null = null;

      if (editModal.clockIn && editModal.clockIn.trim()) {
        isoClockIn = new Date(`${editModal.date}T${editModal.clockIn}:00+09:00`).toISOString();
      }
      if (editModal.clockOut && editModal.clockOut.trim()) {
        isoClockOut = new Date(`${editModal.date}T${editModal.clockOut}:00+09:00`).toISOString();
      }

      let payload: any = {
        date: editModal.date,
        worker_id: editModal.workerId,
        user_id: tenantId,
        clock_in: isoClockIn,
        clock_out: isoClockOut,
        total_break_minutes: editModal.restMinutes,
        actual_rest_minutes: editModal.restMinutes,
        status: editModal.workType,
        memo: editModal.memo || null,
        updated_at: new Date().toISOString()
      };

      if (editModal.logId) {
        // UPDATE
        let updateQuery = supabase
          .from('attendance_logs')
          .update(payload)
          .eq('id', editModal.logId);

        if (tenantId) updateQuery = updateQuery.eq('user_id', tenantId);
        let { error } = await updateQuery;

        // もし memo や status カラムがDBに未追加の場合のフォールバック
        if (error && (error.message?.includes('memo') || error.message?.includes('status') || (error as any).code === 'PGRST204')) {
          delete payload.memo;
          delete payload.status;
          let retryQuery = supabase
            .from('attendance_logs')
            .update(payload)
            .eq('id', editModal.logId);
          if (tenantId) retryQuery = retryQuery.eq('user_id', tenantId);
          const retryRes = await retryQuery;
          error = retryRes.error;
        }

        if (error) throw error;

        setLogs(prev => prev.map(l => l.id === editModal.logId ? { ...l, ...payload } : l));
        setEditingRestMinutes(prev => ({ ...prev, [editModal.logId!]: editModal.restMinutes }));
        showToast(`🎉 ${editModal.date} の打刻データを更新しました！`);
      } else {
        // INSERT
        payload.created_at = new Date().toISOString();
        let insertRes = await supabase
          .from('attendance_logs')
          .insert([payload])
          .select();

        // もし memo や status カラムがDBに未追加の場合のフォールバック
        if (insertRes.error && (insertRes.error.message?.includes('memo') || insertRes.error.message?.includes('status') || (insertRes.error as any).code === 'PGRST204')) {
          delete payload.memo;
          delete payload.status;
          insertRes = await supabase
            .from('attendance_logs')
            .insert([payload])
            .select();
        }

        if (insertRes.error) throw insertRes.error;

        if (insertRes.data && insertRes.data[0]) {
          setLogs(prev => [insertRes.data[0], ...prev]);
          setEditingRestMinutes(prev => ({ ...prev, [insertRes.data[0].id]: editModal.restMinutes }));
        }
        showToast(`🎉 ${editModal.date} の打刻データを登録しました！`);
      }

      setEditModal(prev => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      console.error('Save attendance log error:', err);
      alert('打刻の保存に失敗しました: ' + (err.message || 'エラー'));
    } finally {
      setIsSaving(false);
    }
  };

  // 打刻削除
  const handleDeleteAttendanceLog = async () => {
    if (!editModal.logId) return;
    if (!confirm(`${editModal.date} の打刻データを削除してもよろしいですか？`)) return;

    setIsSaving(true);
    try {
      const tenantId = await getCurrentTenantId();
      let delQuery = supabase
        .from('attendance_logs')
        .delete()
        .eq('id', editModal.logId);

      if (tenantId) delQuery = delQuery.eq('user_id', tenantId);
      const { error } = await delQuery;
      if (error) throw error;

      setLogs(prev => prev.filter(l => l.id !== editModal.logId));
      showToast(`🗑️ ${editModal.date} の打刻データを削除しました`);
      setEditModal(prev => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      alert('削除に失敗しました: ' + (err.message || 'エラー'));
    } finally {
      setIsSaving(false);
    }
  };

  // CSVエクスポート処理
  const handleExportCsv = () => {
    const year = currentMonth.getFullYear();
    const month = (currentMonth.getMonth() + 1).toString().padStart(2, '0');
    let csvRows: string[][] = [];
    let filename = '';

    if (viewMode === 'worker_details' && selectedWorkerId) {
      // 1. 個人別タイムカードCSV
      const worker = workers.find(w => w.id === selectedWorkerId);
      const workerName = worker?.name || 'スタッフ';
      const closingLabel = closingDay === 0 ? '末日締め' : `${closingDay}日締め`;
      filename = `タイムカード_${workerName}_${year}年${month}月度_${closingLabel}.csv`;

      csvRows.push([
        '日付', '曜日', '勤務区分', '打刻出勤', '打刻退勤', '計算上出勤', '計算上退勤', '休憩時間(分)', '労働時間', '実労働分数', '管理者メモ'
      ]);

      const calendar = generateWorkerCalendar(selectedWorkerId);
      calendar.forEach(({ date, day, log }) => {
        const dt = new Date(date);
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()];
        
        if (!log) {
          csvRows.push([
            date, dayOfWeek, '未打刻', '', '', '', '', '0', '0時間0分', '0', ''
          ]);
          return;
        }

        const { totalMinutes, roundedIn, roundedOut, restMins } = calculateWorkHours(log);
        const clockInStr = log.clock_in ? formatTime(new Date(log.clock_in)) : '';
        const clockOutStr = log.clock_out ? formatTime(new Date(log.clock_out)) : '';
        const roundedInStr = roundedIn ? formatTime(roundedIn) : '';
        const roundedOutStr = roundedOut ? formatTime(roundedOut) : '';
        
        let statusLabel = '通常出勤';
        if (log.status === 'paid_leave') statusLabel = '有給休暇';
        else if (log.status === 'half_paid_am') statusLabel = '前半有給';
        else if (log.status === 'half_paid_pm') statusLabel = '後半有給';
        else if (log.status === 'absence') statusLabel = '欠勤';
        else if (log.status === 'holiday') statusLabel = '公休・休日';

        const hoursText = `${Math.floor(totalMinutes / 60)}時間${totalMinutes % 60}分`;

        csvRows.push([
          date,
          dayOfWeek,
          statusLabel,
          clockInStr,
          clockOutStr,
          roundedInStr,
          roundedOutStr,
          String(restMins),
          hoursText,
          String(totalMinutes),
          log.memo || ''
        ]);
      });

    } else if (viewMode === 'summary') {
      // 2. 月次集計CSV
      const closingLabel = closingDay === 0 ? '末日締め' : `${closingDay}日締め`;
      filename = `月次勤怠集計_${year}年${month}月度_${closingLabel}.csv`;
      csvRows.push([
        '従業員ID', '従業員名', '適用勤怠ルール', '出勤日数', '総休憩時間(時間:分)', '総休憩分数', '総労働時間(時間:分)', '総労働分数'
      ]);

      summaryArray.forEach((w: any) => {
        const breakHoursText = `${Math.floor(w.breakMinutes / 60)}時間${w.breakMinutes % 60}分`;
        const workHoursText = `${Math.floor(w.totalMinutes / 60)}時間${w.totalMinutes % 60}分`;

        csvRows.push([
          w.workerId,
          w.name,
          w.ruleName,
          String(w.days),
          breakHoursText,
          String(w.breakMinutes),
          workHoursText,
          String(w.totalMinutes)
        ]);
      });

    } else {
      // 3. 全社明細CSV
      const closingLabel = closingDay === 0 ? '末日締め' : `${closingDay}日締め`;
      filename = `全社勤怠明細_${year}年${month}月度_${closingLabel}.csv`;
      csvRows.push([
        '日付', '従業員名', '適用勤怠ルール', '勤務区分', '打刻出勤', '打刻退勤', '計算上出勤', '計算上退勤', '休憩時間(分)', '労働時間', '実労働分数', '管理者メモ'
      ]);

      logs.forEach((log: any) => {
        const worker = workers.find(w => w.id === log.worker_id) || { name: `不明 (ID: ${log.worker_id.substring(0,8)})` };
        const matchedRule = attendanceRules.find(r => r.id === worker.attendance_rule_id);
        const { totalMinutes, roundedIn, roundedOut, restMins } = calculateWorkHours(log);
        const clockInStr = log.clock_in ? formatTime(new Date(log.clock_in)) : '';
        const clockOutStr = log.clock_out ? formatTime(new Date(log.clock_out)) : '';
        const roundedInStr = roundedIn ? formatTime(roundedIn) : '';
        const roundedOutStr = roundedOut ? formatTime(roundedOut) : '';
        
        let statusLabel = '通常出勤';
        if (log.status === 'paid_leave') statusLabel = '有給休暇';
        else if (log.status === 'half_paid_am') statusLabel = '前半有給';
        else if (log.status === 'half_paid_pm') statusLabel = '後半有給';
        else if (log.status === 'absence') statusLabel = '欠勤';
        else if (log.status === 'holiday') statusLabel = '公休・休日';

        const hoursText = `${Math.floor(totalMinutes / 60)}時間${totalMinutes % 60}分`;
        const ruleName = matchedRule?.name || (worker.standard_start_time ? `${worker.standard_start_time.substring(0,5)}〜${worker.standard_end_time?.substring(0,5)}` : '標準設定');

        csvRows.push([
          log.date,
          worker.name,
          ruleName,
          statusLabel,
          clockInStr,
          clockOutStr,
          roundedInStr,
          roundedOutStr,
          String(restMins),
          hoursText,
          String(totalMinutes),
          log.memo || ''
        ]);
      });
    }

    // CSV文字列化（カンマ・改行・ダブルクォートのエスケープ対応）
    const csvContent = csvRows.map(row => 
      row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\r\n');

    // BOM付きUTF-8でBlob生成＆ダウンロード
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`📄 ${filename} をダウンロードしました！`);
  };

  const calculateWorkHours = (log: any) => {
    if (!log.clock_in || !log.clock_out) return { totalMinutes: 0, roundedIn: null, roundedOut: null, restMins: 0 };

    // workerの特定
    const worker = workers.find(w => w.id === log.worker_id) || {};
    const logDate = log.date; 
    
    // 紐づく勤怠ルールの特定
    const matchedRule = attendanceRules.find(r => 
      String(r.id) === String(worker.attendance_rule_id) || 
      r.name === worker.attendance_rule_id ||
      (r.start_time?.substring(0, 5) === worker.standard_start_time?.substring(0, 5) && r.end_time?.substring(0, 5) === worker.standard_end_time?.substring(0, 5))
    );

    const stdStartStr = worker.standard_start_time || matchedRule?.start_time || companySettings?.default_start_time || '08:00:00';
    const stdEndStr = worker.standard_end_time || matchedRule?.end_time || companySettings?.default_end_time || '17:00:00';
    const stdRest = worker.standard_rest_minutes ?? matchedRule?.rest_minutes ?? companySettings?.default_rest_minutes ?? 60;
    const autoRoundOut = matchedRule?.auto_round_out_time ?? companySettings?.auto_round_out_time ?? true;

    const stdStart = new Date(`${logDate}T${stdStartStr.length === 5 ? stdStartStr + ':00' : stdStartStr}+09:00`);
    const stdEnd = new Date(`${logDate}T${stdEndStr.length === 5 ? stdEndStr + ':00' : stdEndStr}+09:00`);

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
    const worker = workers.find(w => w.id === log.worker_id);
    const workerId = worker ? worker.id : log.worker_id;
    const workerName = worker ? worker.name : `不明 (ID: ${log.worker_id.substring(0,8)}...)`;
    const matchedRule = attendanceRules.find(r => r.id === worker?.attendance_rule_id);
    
    if (!acc[workerId]) {
      acc[workerId] = { 
        workerId, 
        name: workerName, 
        ruleName: matchedRule?.name || (worker?.standard_start_time ? `${worker.standard_start_time.substring(0,5)}〜${worker.standard_end_time?.substring(0,5)}` : '標準設定'),
        days: 0, 
        totalMinutes: 0, 
        breakMinutes: 0 
      };
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
    const calendar = [];
    const workerLogs = logs.filter(l => l.worker_id === workerId);

    // 締日に応じた連続日付リスト（例: 8/21〜9/20 または 9/1〜9/30）を取得
    const dates = (periodInfo.startDate && periodInfo.endDate)
      ? getDateListBetween(periodInfo.startDate, periodInfo.endDate)
      : [];

    if (dates.length === 0) {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const log = workerLogs.find(l => l.date === dateStr);
        calendar.push({ date: dateStr, day: d, log: log || null });
      }
      return calendar;
    }

    for (const dateStr of dates) {
      const parts = dateStr.split('-');
      const d = parseInt(parts[2], 10);
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
            各スタッフの勤怠ルール（定時丸め・休憩時間補正）に基づいた労働時間の集計です。
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-xl text-xs font-black shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>集計期間: {periodInfo.label || '算出中...'}</span>
            </span>
            <Link
              href="/hr/settings"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-indigo-600 hover:underline transition-colors ml-1"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>締日設定を変更</span>
            </Link>
          </div>
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

          <button 
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-300 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-50/50 shadow-2xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-blue-600" /> CSV出力
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
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-black ml-2">
                    {summaryByWorker[selectedWorkerId]?.ruleName}
                  </span>
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
                    <th className="p-4">適用勤怠ルール</th>
                    <th className="p-4 text-center">出勤日数</th>
                    <th className="p-4 text-center">総休憩時間</th>
                    <th className="p-4 text-center">総労働時間（補正後）</th>
                    <th className="p-4 text-center">詳細</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryArray.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">打刻データがありません</td></tr>
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
                      <td className="p-4">
                        <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg text-xs font-black">
                          {worker.ruleName}
                        </span>
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
                    <th className="p-4 text-center">区分</th>
                    <th className="p-4 text-center">打刻時刻</th>
                    <th className="p-4 text-center">計算上(補正後)</th>
                    <th className="p-4 text-center w-40">休憩時間(分)</th>
                    <th className="p-4 text-center">労働時間</th>
                    <th className="p-4 text-center w-28">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {generateWorkerCalendar(selectedWorkerId).map(({ date, day, log }) => {
                    const dt = new Date(date);
                    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                    
                    if (!log) {
                      return (
                        <tr key={date} className={`hover:bg-blue-50/20 ${isWeekend ? 'bg-slate-50/50' : ''}`}>
                          <td className={`p-4 font-bold ${dt.getDay() === 0 ? 'text-rose-500' : dt.getDay() === 6 ? 'text-blue-500' : 'text-slate-700'}`}>
                            {closingDay > 0 ? `${dt.getMonth() + 1}/${day}` : `${day}日`} ({['日','月','火','水','木','金','土'][dt.getDay()]})
                          </td>
                          <td className="p-4 text-center text-slate-300">-</td>
                          <td className="p-4 text-center text-slate-300">-</td>
                          <td className="p-4 text-center text-slate-300">-</td>
                          <td className="p-4 text-center text-slate-300">-</td>
                          <td className="p-4 text-center text-slate-300">-</td>
                          <td className="p-4 text-center">
                            <button
                              type="button"
                              onClick={() => openEditModal(date, selectedWorkerId, null)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 mx-auto"
                            >
                              <Plus className="w-3.5 h-3.5" /> 登録
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    const { totalMinutes, roundedIn, roundedOut } = calculateWorkHours(log);
                    const getWorkTypeBadge = (st: string) => {
                      switch (st) {
                        case 'paid_leave': return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-black">有給</span>;
                        case 'half_paid_am': return <span className="bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded text-[11px] font-black">前半有給</span>;
                        case 'half_paid_pm': return <span className="bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded text-[11px] font-black">後半有給</span>;
                        case 'absence': return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-black">欠勤</span>;
                        case 'holiday': return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-black">公休</span>;
                        default: return <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-black">通常出勤</span>;
                      }
                    };

                    return (
                      <tr key={log.id} className="hover:bg-blue-50/30 group">
                        <td className={`p-4 font-bold ${dt.getDay() === 0 ? 'text-rose-500' : dt.getDay() === 6 ? 'text-blue-500' : 'text-slate-700'}`}>
                          {closingDay > 0 ? `${dt.getMonth() + 1}/${day}` : `${day}日`} ({['日','月','火','水','木','金','土'][dt.getDay()]})
                        </td>
                        <td className="p-4 text-center">
                          {getWorkTypeBadge(log.status)}
                        </td>
                        <td className="p-4 text-center">
                          <div className="text-sm text-slate-500 font-bold">
                            {formatTime(log.clock_in ? new Date(log.clock_in) : null)} 〜 {formatTime(log.clock_out ? new Date(log.clock_out) : null)}
                          </div>
                        </td>
                        <td className="p-4 text-center font-bold text-blue-600">
                          {formatTime(roundedIn)} 〜 {formatTime(roundedOut)}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              value={editingRestMinutes[log.id] ?? ''}
                              onChange={(e) => handleRestMinutesChange(log.id, Number(e.target.value))}
                              className="w-16 p-1 border border-slate-200 rounded-md text-center text-xs font-bold focus:border-blue-500 focus:outline-none"
                            />
                            <button 
                              onClick={() => saveRestMinutes(log.id)}
                              disabled={isSaving}
                              className="p-1 bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded-md transition-colors"
                              title="休憩時間を保存"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-center font-black text-slate-700 text-base">
                          {Math.floor(totalMinutes/60)}h {totalMinutes%60}m
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => openEditModal(date, selectedWorkerId, log)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition-colors flex items-center justify-center gap-1 mx-auto"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> 修正
                          </button>
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
                    <th className="p-4">適用勤怠ルール</th>
                    <th className="p-4 text-center">打刻時刻</th>
                    <th className="p-4 text-center">計算上(補正後)</th>
                    <th className="p-4 text-center w-40">休憩時間(分)</th>
                    <th className="p-4 text-center">労働時間</th>
                    <th className="p-4 text-center w-24">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-slate-400 font-bold">打刻データがありません</td></tr>
                  )}
                  {logs.map((log: any) => {
                    const worker = workers.find(w => w.id === log.worker_id) || { name: `不明 (ID: ${log.worker_id.substring(0,8)})` };
                    const matchedRule = attendanceRules.find(r => r.id === worker.attendance_rule_id);
                    const { totalMinutes, roundedIn, roundedOut } = calculateWorkHours(log);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 group">
                        <td className="p-4 font-bold text-slate-700">{log.date}</td>
                        <td className="p-4 font-bold text-slate-800">{worker.name}</td>
                        <td className="p-4">
                          <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-xs font-black">
                            {matchedRule?.name || (worker.standard_start_time ? `${worker.standard_start_time.substring(0,5)}〜${worker.standard_end_time?.substring(0,5)}` : '標準設定')}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="text-xs text-slate-400 font-bold">
                            {formatTime(log.clock_in ? new Date(log.clock_in) : null)} 〜 {formatTime(log.clock_out ? new Date(log.clock_out) : null)}
                          </div>
                        </td>
                        <td className="p-4 text-center font-bold text-blue-600">
                          {formatTime(roundedIn)} 〜 {formatTime(roundedOut)}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              value={editingRestMinutes[log.id] ?? ''}
                              onChange={(e) => handleRestMinutesChange(log.id, Number(e.target.value))}
                              className="w-16 p-1 border border-slate-200 rounded-md text-center text-xs font-bold focus:border-blue-500 focus:outline-none"
                            />
                            <button 
                              onClick={() => saveRestMinutes(log.id)}
                              disabled={isSaving}
                              className="p-1 bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded-md transition-colors"
                              title="休憩時間を保存"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-center font-black text-slate-700">
                          {Math.floor(totalMinutes/60)}h {totalMinutes%60}m
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => openEditModal(log.date, log.worker_id, log)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition-colors flex items-center justify-center gap-1 mx-auto"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> 修正
                          </button>
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

      {/* 管理者専用 打刻修正・追加モーダル */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* ヘッダー */}
            <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg">打刻・勤怠データの管理者修正</h3>
                  <p className="text-xs text-blue-100 font-bold">
                    {editModal.date} | {editModal.workerName} さん
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* フォームボディ */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* 勤務区分 */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-2">勤務区分</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'completed', label: '💼 通常勤務' },
                    { id: 'paid_leave', label: '🌴 有給休暇' },
                    { id: 'half_paid_am', label: '🌅 前半有給' },
                    { id: 'half_paid_pm', label: '🌆 後半有給' },
                    { id: 'absence', label: '🏥 欠勤' },
                    { id: 'holiday', label: '☕ 公休・休日' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setEditModal(prev => ({ ...prev, workType: item.id }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                        editModal.workType === item.id
                          ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 出退勤時刻入力 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    出退勤・休憩時刻
                  </span>
                  <button
                    type="button"
                    onClick={applyStandardHours}
                    className="flex items-center gap-1 text-[11px] font-black text-blue-600 hover:text-blue-800 bg-blue-100/60 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <Zap className="w-3 h-3" /> 定時をセット
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">出勤時刻</label>
                    <input
                      type="time"
                      value={editModal.clockIn}
                      onChange={e => setEditModal(prev => ({ ...prev, clockIn: e.target.value }))}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">退勤時刻</label>
                    <input
                      type="time"
                      value={editModal.clockOut}
                      onChange={e => setEditModal(prev => ({ ...prev, clockOut: e.target.value }))}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">休憩時間 (分)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={editModal.restMinutes}
                      onChange={e => setEditModal(prev => ({ ...prev, restMinutes: Number(e.target.value) }))}
                      className="w-28 p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    />
                    <span className="text-xs font-bold text-slate-500">分</span>
                    <div className="flex items-center gap-1 ml-auto">
                      {[0, 45, 60, 90].map(mins => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setEditModal(prev => ({ ...prev, restMinutes: mins }))}
                          className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-[11px] font-bold text-slate-600 transition-colors"
                        >
                          {mins}分
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 実労働時間プレビュー */}
                {editModal.clockIn && editModal.clockOut && (
                  <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500">算出実労働時間:</span>
                    <span className="text-blue-600 font-black text-sm">
                      {(() => {
                        const [inH, inM] = editModal.clockIn.split(':').map(Number);
                        const [outH, outM] = editModal.clockOut.split(':').map(Number);
                        let diff = (outH * 60 + outM) - (inH * 60 + inM) - (editModal.restMinutes || 0);
                        if (diff < 0) diff = 0;
                        return `${Math.floor(diff / 60)}時間 ${diff % 60}分`;
                      })()}
                    </span>
                  </div>
                )}
              </div>

              {/* 修正理由・メモ */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">管理者メモ / 修正理由 (任意)</label>
                <input
                  type="text"
                  placeholder="例: 打刻忘れのため代理登録、電車遅延による補正など"
                  value={editModal.memo}
                  onChange={e => setEditModal(prev => ({ ...prev, memo: e.target.value }))}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* フッターアクション */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              {editModal.logId ? (
                <button
                  type="button"
                  onClick={handleDeleteAttendanceLog}
                  disabled={isSaving}
                  className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 px-3 py-2 rounded-xl hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> この打刻を削除
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleSaveAttendanceLog}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-black text-xs transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  保存する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* トースト通知 */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 text-sm font-bold animate-in slide-in-from-bottom-5">
          <Check className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}
    </AdminOnlyGuard>
  );
}
