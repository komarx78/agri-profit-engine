"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Calendar,
  Clock,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Plus,
  Edit3,
  Trash2,
  Printer,
  Download,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  FileText,
  Check,
  X,
  Phone,
  KeyRound,
  BadgeJapaneseYen,
  Sprout,
  RefreshCw,
} from 'lucide-react';
import { getCurrentTenantId } from '@/lib/tenant';
import { getAttendancePeriod } from '@/lib/dateUtils';
import {
  getHrManagementDataAction,
  saveAttendanceRecordAction,
  deleteAttendanceRecordAction,
  updateLeaveRequestStatusAction,
  updateOvertimeRequestStatusAction,
  saveWorkerFromHrAction,
  deleteWorkerFromHrAction,
  submitLeaveRequest,
} from '@/app/actions/farm';
import { LineLinkModal } from '@/components/LineLinkModal';

type TabType = 'daily' | 'monthly' | 'approvals' | 'workers';

interface WorkerRecord {
  id: string;
  name: string;
  hourly_wage: number;
  pin_code: string;
  role?: string;
  line_user_id?: string | null;
  employment_type: string;
  phone: string;
  paid_leave_balance: number;
  paid_leave_carryover: number;
  notes: string;
}

interface AttendanceRecord {
  id: string;
  worker_id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  total_break_minutes?: number | null;
  break_start_time?: string | null;
  break_end_time?: string | null;
}

interface WorkLogRecord {
  id: string;
  worker_id: string;
  work_date: string;
  work_type?: string | null;
  task_title?: string | null;
  duration_minutes: number;
  harvest_amount?: number | null;
  status?: string | null;
  crops?: { name?: string } | { name?: string }[] | null;
  fields?: { name?: string } | { name?: string }[] | null;
}

interface LeaveRequestRecord {
  id: string;
  worker_id: string;
  leave_date?: string;
  start_date?: string;
  end_date?: string;
  type?: string;
  leave_type?: string;
  reason?: string;
  status: string;
  created_at?: string;
}

interface OvertimeRequestRecord {
  id: string;
  worker_id: string;
  request_date?: string;
  date?: string;
  overtime_minutes: number;
  reason?: string;
  status: string;
  created_at?: string;
}

function toJstDateStr(isoOrDate: string | Date): string {
  if (typeof isoOrDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    return isoOrDate;
  }
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '';
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

function toJstTimeHm(isoStr?: string | null): string {
  if (!isoStr) return '';
  if (/^\d{2}:\d{2}/.test(isoStr)) return isoStr.substring(0, 5);
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().substring(11, 16);
}

function getAttDateStr(att: AttendanceRecord): string {
  if (att.date && /^\d{4}-\d{2}-\d{2}$/.test(att.date)) return att.date;
  return toJstDateStr(att.clock_in);
}

function getCropLabel(log: WorkLogRecord): string {
  if (!log.crops) return '';
  if (Array.isArray(log.crops)) return log.crops[0]?.name || '';
  return log.crops.name || '';
}

function getTaskLabel(log: WorkLogRecord): string {
  return log.task_title || log.work_type || '農作業';
}

function calcNetWorkMinutes(att: AttendanceRecord): {
  grossMinutes: number;
  breakMinutes: number;
  netMinutes: number;
  overtimeMinutes: number;
} {
  const breakMinutes = Math.max(0, Number(att.total_break_minutes) || 0);
  if (!att.clock_in || !att.clock_out) {
    return { grossMinutes: 0, breakMinutes, netMinutes: 0, overtimeMinutes: 0 };
  }
  const s = new Date(att.clock_in).getTime();
  const e = new Date(att.clock_out).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) {
    return { grossMinutes: 0, breakMinutes, netMinutes: 0, overtimeMinutes: 0 };
  }
  const grossMinutes = Math.round((e - s) / 60000);
  const netMinutes = Math.max(0, grossMinutes - breakMinutes);
  const overtimeMinutes = Math.max(0, netMinutes - 8 * 60);
  return { grossMinutes, breakMinutes, netMinutes, overtimeMinutes };
}

function formatMinutesToHoursText(mins: number): string {
  if (mins <= 0) return '0時間';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

export default function HrManagementPage() {
  const [tenantId, setTenantId] = useState<string>('default');
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // 日付・月フィルタ
  const [selectedDate, setSelectedDate] = useState<string>(() => toJstDateStr(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<string>(() => toJstDateStr(new Date()).substring(0, 7));

  // サーバーデータ
  const [closingDay, setClosingDay] = useState<number>(0);
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLogRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRecord[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequestRecord[]>([]);

  // 打刻編集モーダル
  const [editingAttendance, setEditingAttendance] = useState<{
    attendanceId?: string;
    workerId: string;
    workerName: string;
    workDate: string;
    clockInTime: string;
    clockOutTime: string;
    breakMinutes: number;
    isStillWorking: boolean;
  } | null>(null);

  // 個人別月間タイムカード（印刷・詳細）モーダル
  const [timecardWorkerId, setTimecardWorkerId] = useState<string | null>(null);

  // スタッフ登録・編集モーダル
  const [editingWorker, setEditingWorker] = useState<{
    id?: string;
    name: string;
    hourly_wage: number;
    pin_code: string;
    role: string;
    employment_type: string;
    phone: string;
    paid_leave_balance: number;
    paid_leave_carryover: number;
    notes: string;
  } | null>(null);

  // 管理者による有給・お休み代理登録モーダル
  const [proxyLeaveModal, setProxyLeaveModal] = useState<{
    workerId: string;
    leaveDate: string;
    leaveType: string;
    reason: string;
  } | null>(null);

  // LINE連携モーダル
  const [lineModalWorker, setLineModalWorker] = useState<WorkerRecord | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  }, []);

  const loadData = useCallback(async (currentTenantId: string, month: string, date: string) => {
    setIsLoading(true);
    try {
      const res = await getHrManagementDataAction(currentTenantId, month, date);
      if (res.success) {
        setClosingDay(Number(res.closingDay || 0));
        setWorkers((res.workers || []) as WorkerRecord[]);
        setAttendances((res.attendanceLogs || []) as AttendanceRecord[]);
        setWorkLogs((res.workLogs || []) as unknown as WorkLogRecord[]);
        setLeaveRequests((res.leaveRequests || []) as LeaveRequestRecord[]);
        setOvertimeRequests((res.overtimeRequests || []) as OvertimeRequestRecord[]);
      } else {
        showToast(res.error || 'データの読み込みに失敗しました', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('通信エラーが発生しました', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    getCurrentTenantId().then((tid) => {
      if (!active) return;
      const resolved = tid || 'default';
      setTenantId(resolved);
      loadData(resolved, selectedMonth, selectedDate);
    });
    return () => {
      active = false;
    };
  }, [selectedMonth, selectedDate, loadData]);

  // スタッフ辞書（UUID → スタッフ情報）
  const workerMap = useMemo(() => {
    const map = new Map<string, WorkerRecord>();
    for (const w of workers) {
      map.set(w.id, w);
    }
    return map;
  }, [workers]);

  // 未承認件数（タブバッジ用）
  const pendingApprovalCount = useMemo(() => {
    const pendingLeaves = leaveRequests.filter((r) => r.status === '申請中' || r.status === 'pending').length;
    const pendingOvertimes = overtimeRequests.filter((r) => r.status === 'pending' || r.status === '申請中').length;
    return pendingLeaves + pendingOvertimes;
  }, [leaveRequests, overtimeRequests]);

  // 退勤忘れ件数（今日より前の未退勤）
  const forgottenClockOutCount = useMemo(() => {
    const todayStr = toJstDateStr(new Date());
    return attendances.filter((a) => {
      if (a.clock_out) return false;
      const dStr = getAttDateStr(a);
      return dStr < todayStr;
    }).length;
  }, [attendances]);

  // 日付変更ヘルパー
  const shiftDate = (days: number) => {
    const d = new Date(`${selectedDate}T00:00:00+09:00`);
    d.setDate(d.getDate() + days);
    const nextDateStr = toJstDateStr(d);
    setSelectedDate(nextDateStr);
    if (nextDateStr.substring(0, 7) !== selectedMonth) {
      setSelectedMonth(nextDateStr.substring(0, 7));
    }
  };

  // ==========================================
  // ① 日々の出退勤データ集計
  // ==========================================
  const dailyRows = useMemo(() => {
    const dayAttendances = attendances.filter((a) => getAttDateStr(a) === selectedDate);
    const dayWorkLogs = workLogs.filter((l) => l.work_date === selectedDate && l.status !== 'planned');
    const dayLeaves = leaveRequests.filter((l) => {
      const target = l.leave_date || l.start_date || '';
      return target === selectedDate && l.status !== '却下';
    });

    return workers.map((worker) => {
      const workerAtts = dayAttendances.filter((a) => a.worker_id === worker.id);
      const latestAtt = workerAtts[0] || null;
      const workerLogs = dayWorkLogs.filter((l) => l.worker_id === worker.id);
      const leave = dayLeaves.find((l) => l.worker_id === worker.id) || null;

      const calc = latestAtt
        ? calcNetWorkMinutes(latestAtt)
        : { grossMinutes: 0, breakMinutes: 0, netMinutes: 0, overtimeMinutes: 0 };

      const logTotalMinutes = workerLogs.reduce((sum, l) => sum + (Number(l.duration_minutes) || 0), 0);
      const estimatedDailyWage = Math.round((calc.netMinutes / 60) * (Number(worker.hourly_wage) || 0));

      let statusLabel: '退勤済' | '出勤中' | '休憩中' | '退勤忘れ' | 'お休み・有給' | '未出勤' = '未出勤';
      const todayStr = toJstDateStr(new Date());

      if (latestAtt) {
        if (latestAtt.clock_out) {
          statusLabel = '退勤済';
        } else if (selectedDate < todayStr) {
          statusLabel = '退勤忘れ';
        } else if (latestAtt.break_start_time && !latestAtt.break_end_time) {
          statusLabel = '休憩中';
        } else {
          statusLabel = '出勤中';
        }
      } else if (leave) {
        statusLabel = 'お休み・有給';
      }

      return {
        worker,
        attendance: latestAtt,
        calc,
        logs: workerLogs,
        logTotalMinutes,
        leave,
        statusLabel,
        estimatedDailyWage,
      };
    });
  }, [workers, attendances, workLogs, leaveRequests, selectedDate]);

  // ==========================================
  // ② 月別の出勤簿・パート代集計（締め日対応）
  // ==========================================
  const monthlyPeriod = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const { startDate, endDate, label } = getAttendancePeriod(
      y || new Date().getFullYear(),
      m || new Date().getMonth() + 1,
      closingDay
    );
    return {
      startStr: startDate,
      endStr: endDate,
      label,
    };
  }, [selectedMonth, closingDay]);

  const monthlySummaries = useMemo(() => {
    const { startStr, endStr } = monthlyPeriod;

    return workers.map((worker) => {
      const workerAtts = attendances.filter((a) => {
        if (a.worker_id !== worker.id) return false;
        const dStr = getAttDateStr(a);
        return dStr >= startStr && dStr <= endStr;
      });

      const workedDateSet = new Set<string>();
      let totalNetMinutes = 0;
      let totalBreakMinutes = 0;
      let totalOvertimeMinutes = 0;
      let unclosedCount = 0;

      for (const att of workerAtts) {
        const dStr = getAttDateStr(att);
        workedDateSet.add(dStr);
        if (!att.clock_out) {
          unclosedCount += 1;
        }
        const c = calcNetWorkMinutes(att);
        totalNetMinutes += c.netMinutes;
        totalBreakMinutes += c.breakMinutes;
        totalOvertimeMinutes += c.overtimeMinutes;
      }

      const approvedLeaves = leaveRequests.filter((l) => {
        if (l.worker_id !== worker.id) return false;
        if (l.status !== '承認' && l.status !== 'approved') return false;
        const dStr = l.leave_date || l.start_date || '';
        return dStr >= startStr && dStr <= endStr;
      });

      const hourlyWage = Number(worker.hourly_wage) || 0;
      const regularMinutes = Math.max(0, totalNetMinutes - totalOvertimeMinutes);
      const basePay = Math.round((regularMinutes / 60) * hourlyWage);
      const overtimePay = Math.round((totalOvertimeMinutes / 60) * hourlyWage * 1.25);
      const totalEstimatedPay = basePay + overtimePay;

      return {
        worker,
        workDays: workedDateSet.size,
        totalNetMinutes,
        totalBreakMinutes,
        totalOvertimeMinutes,
        unclosedCount,
        paidLeaveDays: approvedLeaves.length,
        basePay,
        overtimePay,
        totalEstimatedPay,
        records: workerAtts,
      };
    });
  }, [workers, attendances, leaveRequests, monthlyPeriod]);

  const monthlyTotals = useMemo(() => {
    return monthlySummaries.reduce(
      (acc, cur) => {
        acc.workDays += cur.workDays;
        acc.totalNetMinutes += cur.totalNetMinutes;
        acc.totalOvertimeMinutes += cur.totalOvertimeMinutes;
        acc.totalEstimatedPay += cur.totalEstimatedPay;
        return acc;
      },
      { workDays: 0, totalNetMinutes: 0, totalOvertimeMinutes: 0, totalEstimatedPay: 0 }
    );
  }, [monthlySummaries]);

  // 個人タイムカード用の日別リスト生成
  const selectedWorkerTimecard = useMemo(() => {
    if (!timecardWorkerId) return null;
    const summary = monthlySummaries.find((s) => s.worker.id === timecardWorkerId);
    if (!summary) return null;

    const days: Array<{
      dateStr: string;
      dayOfWeek: string;
      attendance: AttendanceRecord | null;
      calc: ReturnType<typeof calcNetWorkMinutes>;
      logs: WorkLogRecord[];
      leave: LeaveRequestRecord | null;
      dailyPay: number;
    }> = [];

    const cur = new Date(`${monthlyPeriod.startStr}T00:00:00+09:00`);
    const end = new Date(`${monthlyPeriod.endStr}T00:00:00+09:00`);
    const weekNames = ['日', '月', '火', '水', '木', '金', '土'];

    while (cur <= end) {
      const dStr = toJstDateStr(cur);
      const dow = weekNames[cur.getDay()];
      const att = summary.records.find((a) => getAttDateStr(a) === dStr) || null;
      const calc = att
        ? calcNetWorkMinutes(att)
        : { grossMinutes: 0, breakMinutes: 0, netMinutes: 0, overtimeMinutes: 0 };
      const logs = workLogs.filter(
        (l) => l.worker_id === timecardWorkerId && l.work_date === dStr && l.status !== 'planned'
      );
      const leave =
        leaveRequests.find(
          (l) =>
            l.worker_id === timecardWorkerId &&
            (l.leave_date === dStr || l.start_date === dStr) &&
            l.status !== '却下'
        ) || null;

      const regularM = Math.max(0, calc.netMinutes - calc.overtimeMinutes);
      const wage = Number(summary.worker.hourly_wage) || 0;
      const dailyPay = Math.round((regularM / 60) * wage + (calc.overtimeMinutes / 60) * wage * 1.25);

      days.push({
        dateStr: dStr,
        dayOfWeek: dow,
        attendance: att,
        calc,
        logs,
        leave,
        dailyPay,
      });

      cur.setDate(cur.getDate() + 1);
    }

    return {
      summary,
      days,
    };
  }, [timecardWorkerId, monthlySummaries, monthlyPeriod, workLogs, leaveRequests]);

  // ==========================================
  // ハンドラー群
  // ==========================================
  const openEditAttendanceModal = (
    worker: WorkerRecord,
    dateStr: string,
    att?: AttendanceRecord | null
  ) => {
    const inHm = att ? toJstTimeHm(att.clock_in) : '08:00';
    const outHm = att?.clock_out ? toJstTimeHm(att.clock_out) : '17:00';
    const brk = att ? Math.max(0, Number(att.total_break_minutes) || 0) : 60;

    setEditingAttendance({
      attendanceId: att?.id,
      workerId: worker.id,
      workerName: worker.name,
      workDate: dateStr,
      clockInTime: inHm || '08:00',
      clockOutTime: outHm || '17:00',
      breakMinutes: brk,
      isStillWorking: false,
    });
  };

  const handleSaveAttendance = async () => {
    if (!editingAttendance) return;
    setIsSaving(true);
    try {
      const res = await saveAttendanceRecordAction(tenantId, {
        id: editingAttendance.attendanceId,
        worker_id: editingAttendance.workerId,
        date: editingAttendance.workDate,
        clock_in_time: editingAttendance.clockInTime,
        clock_out_time: editingAttendance.isStillWorking ? undefined : editingAttendance.clockOutTime,
        total_break_minutes: editingAttendance.breakMinutes,
      });
      if (res.success) {
        showToast(`${editingAttendance.workerName}さんの出退勤時刻を保存しました`);
        setEditingAttendance(null);
        await loadData(tenantId, selectedMonth, selectedDate);
      } else {
        showToast(res.error || '保存に失敗しました', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAttendance = async (attendanceId: string, workerName: string) => {
    if (!window.confirm(`${workerName}さんのこの日の打刻データを削除してもよろしいですか？`)) return;
    setIsSaving(true);
    try {
      const res = await deleteAttendanceRecordAction(tenantId, attendanceId);
      if (res.success) {
        showToast('打刻データを削除しました');
        setEditingAttendance(null);
        await loadData(tenantId, selectedMonth, selectedDate);
      } else {
        showToast(res.error || '削除に失敗しました', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLeaveApproval = async (requestId: string, newStatus: '承認' | '却下') => {
    setIsSaving(true);
    try {
      const res = await updateLeaveRequestStatusAction(tenantId, requestId, newStatus);
      if (res.success) {
        showToast(`有給・お休み申請を「${newStatus}」にしました`);
        await loadData(tenantId, selectedMonth, selectedDate);
      } else {
        showToast(res.error || '更新に失敗しました', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleOvertimeApproval = async (requestId: string, newStatus: 'approved' | 'rejected') => {
    setIsSaving(true);
    try {
      const res = await updateOvertimeRequestStatusAction(tenantId, requestId, newStatus);
      if (res.success) {
        showToast(newStatus === 'approved' ? '残業申請を承認しました' : '残業申請を却下しました');
        await loadData(tenantId, selectedMonth, selectedDate);
      } else {
        showToast(res.error || '更新に失敗しました', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProxyLeave = async () => {
    if (!proxyLeaveModal || !proxyLeaveModal.workerId || !proxyLeaveModal.leaveDate) return;
    setIsSaving(true);
    try {
      const res = await submitLeaveRequest(
        tenantId,
        proxyLeaveModal.workerId,
        proxyLeaveModal.leaveType,
        proxyLeaveModal.leaveDate,
        proxyLeaveModal.leaveDate,
        proxyLeaveModal.reason || '管理者による登録',
        true
      );
      if (res.success) {
        showToast('お休み・有給を登録しました');
        setProxyLeaveModal(null);
        await loadData(tenantId, selectedMonth, selectedDate);
      } else {
        showToast(res.error || '登録に失敗しました', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWorker = async () => {
    if (!editingWorker) return;
    if (!editingWorker.name.trim()) {
      showToast('スタッフのお名前を入力してください', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const res = await saveWorkerFromHrAction(tenantId, editingWorker);
      if (res.success) {
        showToast(`スタッフ「${editingWorker.name}」さんを保存しました`);
        setEditingWorker(null);
        await loadData(tenantId, selectedMonth, selectedDate);
      } else {
        showToast(res.error || 'スタッフ保存に失敗しました', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWorker = async (worker: WorkerRecord) => {
    if (!window.confirm(`「${worker.name}」さんをスタッフ名簿から削除しますか？`)) return;
    setIsSaving(true);
    try {
      const res = await deleteWorkerFromHrAction(tenantId, worker.id);
      if (res.success) {
        showToast(`「${worker.name}」さんを削除しました`);
        await loadData(tenantId, selectedMonth, selectedDate);
      } else {
        showToast(res.error || '削除に失敗しました', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // 全員分の月次出勤簿CSVダウンロード
  const handleDownloadMonthlyCsv = () => {
    const headers = [
      '対象期間',
      'スタッフ名',
      '雇用区分',
      '時給(円)',
      '出勤日数(日)',
      '有給・承認済休暇(日)',
      '実労働時間(時間)',
      'うち残業時間(時間)',
      '休憩合計(分)',
      '基本給概算(円)',
      '残業手当概算(円)',
      '支給総額概算(円)',
    ];

    const periodLabel = `${monthlyPeriod.startStr}〜${monthlyPeriod.endStr}`;
    const rows = monthlySummaries.map((s) => [
      periodLabel,
      `"${s.worker.name.replace(/"/g, '""')}"`,
      `"${s.worker.employment_type || 'パート・アルバイト'}"`,
      s.worker.hourly_wage || 0,
      s.workDays,
      s.paidLeaveDays,
      (s.totalNetMinutes / 60).toFixed(2),
      (s.totalOvertimeMinutes / 60).toFixed(2),
      s.totalBreakMinutes,
      s.basePay,
      s.overtimePay,
      s.totalEstimatedPay,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `月次出勤簿・パート代一覧_${selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('月次出勤簿CSVをダウンロードしました');
  };

  return (
    <div className="max-w-6xl mx-auto pb-16">
      {/* トースト通知 */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-5 py-3.5 rounded-2xl shadow-xl font-bold text-sm transition-all print:hidden ${
            toastMessage.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-emerald-700 text-white'
          }`}
        >
          {toastMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ページヘッダー（印刷時は非表示） */}
      <div className="mb-6 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-2 border border-emerald-200">
              <Users size={14} />
              <span>管理画面統合・農家さん向けかんたん労務管理</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-stone-800 tracking-tight">
              👥 スタッフ・出退勤・パート代管理
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              日々の出退勤チェック・退勤忘れの修正から、毎月のパート代自動計算・タイムカード印刷まで1つの画面で行えます。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => loadData(tenantId, selectedMonth, selectedDate)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-bold transition-colors"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              <span>最新に更新</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('workers');
                setEditingWorker({
                  name: '',
                  hourly_wage: 1050,
                  pin_code: '',
                  role: 'worker',
                  employment_type: 'パート・アルバイト',
                  phone: '',
                  paid_leave_balance: 10,
                  paid_leave_carryover: 0,
                  notes: '',
                });
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-colors"
            >
              <UserPlus size={16} />
              <span>＋ スタッフを追加</span>
            </button>
          </div>
        </div>

        {/* 退勤忘れ・未承認アラートバナー */}
        {(forgottenClockOutCount > 0 || pendingApprovalCount > 0) && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {forgottenClockOutCount > 0 && (
              <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 text-amber-900">
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-amber-600 shrink-0" size={20} />
                  <div className="text-xs md:text-sm font-bold">
                    過去の退勤ボタン押し忘れが <span className="text-base font-black underline">{forgottenClockOutCount}件</span> あります
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('monthly')}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                >
                  月別出勤簿で確認
                </button>
              </div>
            )}

            {pendingApprovalCount > 0 && (
              <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-blue-900">
                <div className="flex items-center gap-3">
                  <Clock className="text-blue-600 shrink-0" size={20} />
                  <div className="text-xs md:text-sm font-bold">
                    スタッフからの有給・残業の確認待ちが <span className="text-base font-black underline">{pendingApprovalCount}件</span> あります
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('approvals')}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  今すぐ確認する
                </button>
              </div>
            )}
          </div>
        )}

        {/* 4つのわかりやすい機能タブ */}
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2.5 bg-stone-200/70 p-2 rounded-2xl">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs md:text-sm transition-all ${
              activeTab === 'daily'
                ? 'bg-white text-emerald-800 shadow-sm ring-2 ring-emerald-500/30'
                : 'text-stone-600 hover:bg-white/60'
            }`}
          >
            <Clock size={18} className={activeTab === 'daily' ? 'text-emerald-600' : 'text-stone-400'} />
            <span>① 日々の出退勤・打刻修正</span>
          </button>

          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs md:text-sm transition-all ${
              activeTab === 'monthly'
                ? 'bg-white text-emerald-800 shadow-sm ring-2 ring-emerald-500/30'
                : 'text-stone-600 hover:bg-white/60'
            }`}
          >
            <Wallet size={18} className={activeTab === 'monthly' ? 'text-emerald-600' : 'text-stone-400'} />
            <span>② 月別の出勤簿・パート代</span>
          </button>

          <button
            onClick={() => setActiveTab('approvals')}
            className={`relative flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs md:text-sm transition-all ${
              activeTab === 'approvals'
                ? 'bg-white text-emerald-800 shadow-sm ring-2 ring-emerald-500/30'
                : 'text-stone-600 hover:bg-white/60'
            }`}
          >
            <Calendar size={18} className={activeTab === 'approvals' ? 'text-emerald-600' : 'text-stone-400'} />
            <span>③ 有給・お休み・残業承認</span>
            {pendingApprovalCount > 0 && (
              <span className="ml-1 px-2 py-0.5 text-[11px] font-black rounded-full bg-red-500 text-white">
                {pendingApprovalCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('workers')}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs md:text-sm transition-all ${
              activeTab === 'workers'
                ? 'bg-white text-emerald-800 shadow-sm ring-2 ring-emerald-500/30'
                : 'text-stone-600 hover:bg-white/60'
            }`}
          >
            <Users size={18} className={activeTab === 'workers' ? 'text-emerald-600' : 'text-stone-400'} />
            <span>④ スタッフ名簿・時給設定</span>
          </button>
        </div>
      </div>

      {/* =========================================================
          タブ①：日々の出退勤・打刻修正
      ========================================================= */}
      {activeTab === 'daily' && (
        <div className="space-y-5 print:hidden">
          {/* 日付切り替えバー */}
          <div className="bg-white p-4 md:p-5 rounded-3xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftDate(-1)}
                className="p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                title="前日へ"
              >
                <ChevronLeft size={18} />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setSelectedDate(val);
                    setSelectedMonth(val.substring(0, 7));
                  }
                }}
                className="px-4 py-2 rounded-xl border border-stone-300 font-black text-stone-800 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={() => shiftDate(1)}
                className="p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                title="翌日へ"
              >
                <ChevronRight size={18} />
              </button>
              <button
                onClick={() => {
                  const t = toJstDateStr(new Date());
                  setSelectedDate(t);
                  setSelectedMonth(t.substring(0, 7));
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200"
              >
                今日に戻る
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-stone-600">
              <span className="px-3 py-1.5 rounded-xl bg-stone-100">
                出勤人数:{' '}
                <strong className="text-emerald-700 text-sm">
                  {dailyRows.filter((r) => r.attendance).length}
                </strong>{' '}
                / {workers.length}名
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-stone-100">
                本日の人件費概算:{' '}
                <strong className="text-stone-900 text-sm">
                  ¥{dailyRows.reduce((s, r) => s + r.estimatedDailyWage, 0).toLocaleString()}
                </strong>
              </span>
            </div>
          </div>

          {/* スタッフ別の当日出退勤一覧 */}
          {workers.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-10 text-center">
              <Users size={40} className="mx-auto text-stone-300 mb-3" />
              <p className="font-bold text-stone-700 text-base">まだスタッフが登録されていません</p>
              <p className="text-xs text-stone-500 mt-1 mb-4">
                まずは「④ スタッフ名簿・時給設定」からパートさんやスタッフの名前・時給を登録してください。
              </p>
              <button
                onClick={() => setActiveTab('workers')}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm"
              >
                スタッフ登録へ進む
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {dailyRows.map(({ worker, attendance, calc, logs, leave, statusLabel, estimatedDailyWage }) => {
                const badgeStyle =
                  statusLabel === '出勤中'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : statusLabel === '休憩中'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : statusLabel === '退勤済'
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : statusLabel === '退勤忘れ'
                    ? 'bg-red-100 text-red-800 border-red-300 animate-pulse'
                    : statusLabel === 'お休み・有給'
                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                    : 'bg-stone-100 text-stone-500 border-stone-200';

                return (
                  <div
                    key={worker.id}
                    className="bg-white rounded-2xl border border-stone-200 p-4 md:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    {/* 左：名前・ステータス・時刻 */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-stone-800">{worker.name}</span>
                          <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${badgeStyle}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5">
                          {worker.employment_type || 'パート・アルバイト'} ／ 時給 ¥{(worker.hourly_wage || 0).toLocaleString()}
                        </div>
                      </div>

                      {/* 打刻時刻と労働時間 */}
                      {attendance ? (
                        <div className="flex flex-wrap items-center gap-3 bg-stone-50 px-4 py-2.5 rounded-xl border border-stone-200">
                          <div>
                            <div className="text-[11px] font-bold text-stone-400">出勤 〜 退勤</div>
                            <div className="text-sm font-black text-stone-800">
                              {toJstTimeHm(attendance.clock_in) || '--:--'} 〜{' '}
                              {attendance.clock_out ? (
                                toJstTimeHm(attendance.clock_out)
                              ) : (
                                <span className="text-red-600 font-bold">未退勤</span>
                              )}
                            </div>
                          </div>
                          <div className="h-7 w-px bg-stone-200" />
                          <div>
                            <div className="text-[11px] font-bold text-stone-400">休憩</div>
                            <div className="text-sm font-bold text-stone-700">{calc.breakMinutes}分</div>
                          </div>
                          <div className="h-7 w-px bg-stone-200" />
                          <div>
                            <div className="text-[11px] font-bold text-stone-400">実労働時間</div>
                            <div className="text-sm font-black text-emerald-700">
                              {attendance.clock_out ? formatMinutesToHoursText(calc.netMinutes) : '計算待ち'}
                            </div>
                          </div>
                          {attendance.clock_out && (
                            <>
                              <div className="h-7 w-px bg-stone-200" />
                              <div>
                                <div className="text-[11px] font-bold text-stone-400">本日パート代目安</div>
                                <div className="text-sm font-black text-stone-800">
                                  ¥{estimatedDailyWage.toLocaleString()}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ) : leave ? (
                        <div className="text-xs font-bold text-purple-700 bg-purple-50 px-3.5 py-2 rounded-xl border border-purple-200">
                          🏖️ {leave.type || leave.leave_type || '有給休暇'}（{leave.status}）{' '}
                          {leave.reason ? `：${leave.reason}` : ''}
                        </div>
                      ) : (
                        <div className="text-xs text-stone-400 font-medium">
                          この日の出退勤打刻はありません
                        </div>
                      )}
                    </div>

                    {/* 中央：その日に記録された農作業内容（あれば表示） */}
                    {logs.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {logs.map((log) => {
                          const cName = getCropLabel(log);
                          const tName = getTaskLabel(log);
                          return (
                            <span
                              key={log.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold"
                            >
                              <Sprout size={12} />
                              <span>
                                {cName ? `${cName}：` : ''}
                                {tName}（{log.duration_minutes}分）
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* 右：ワンクリック修正・手動入力ボタン */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEditAttendanceModal(worker, selectedDate, attendance)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                          statusLabel === '退勤忘れ'
                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                            : attendance
                            ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        <Edit3 size={14} />
                        <span>
                          {statusLabel === '退勤忘れ'
                            ? '退勤時刻を入力する'
                            : attendance
                            ? '時刻・休憩を直す'
                            : '＋ 手動で出勤をつける'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          タブ②：月別の出勤簿・パート代計算
      ========================================================= */}
      {activeTab === 'monthly' && (
        <div className="space-y-5 print:hidden">
          {/* 対象月選択 ＆ CSV出力バー */}
          <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-black text-stone-700">集計する月：</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  if (e.target.value) setSelectedMonth(e.target.value);
                }}
                className="px-4 py-2 rounded-xl border border-stone-300 font-black text-stone-800 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-xs font-bold text-stone-500 bg-stone-100 px-3 py-1.5 rounded-xl">
                集計期間：{monthlyPeriod.startStr} 〜 {monthlyPeriod.endStr}
                （{closingDay === 0 || closingDay === 31 ? '月末締め' : `毎月${closingDay}日締め`}）
              </span>
            </div>

            <button
              onClick={handleDownloadMonthlyCsv}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-bold shadow-sm transition-colors"
            >
              <Download size={16} />
              <span>📥 全員分の月次出勤簿CSV出力（Excel・税理士用）</span>
            </button>
          </div>

          {/* 月間サマリーカード */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <div className="text-xs font-bold text-stone-400">対象スタッフ数</div>
              <div className="text-2xl font-black text-stone-800 mt-1">{workers.length}名</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <div className="text-xs font-bold text-stone-400">延べ出勤日数</div>
              <div className="text-2xl font-black text-stone-800 mt-1">{monthlyTotals.workDays}日</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <div className="text-xs font-bold text-stone-400">総労働時間（うち残業）</div>
              <div className="text-xl font-black text-emerald-700 mt-1">
                {formatMinutesToHoursText(monthlyTotals.totalNetMinutes)}
                <span className="text-xs font-bold text-stone-500 ml-1">
                  （残業 {formatMinutesToHoursText(monthlyTotals.totalOvertimeMinutes)}）
                </span>
              </div>
            </div>
            <div className="bg-emerald-900 p-4 rounded-2xl text-white shadow-sm">
              <div className="text-xs font-bold text-emerald-200">当月の概算パート代・給与総額</div>
              <div className="text-2xl font-black mt-1">
                ¥{monthlyTotals.totalEstimatedPay.toLocaleString()}
              </div>
            </div>
          </div>

          {/* スタッフ別の月次集計テーブル */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-xs font-black text-stone-500">
                    <th className="py-3.5 px-4">スタッフ名</th>
                    <th className="py-3.5 px-3">時給</th>
                    <th className="py-3.5 px-3">出勤日数</th>
                    <th className="py-3.5 px-3">実労働時間</th>
                    <th className="py-3.5 px-3">うち残業(8h超)</th>
                    <th className="py-3.5 px-3">有給消化</th>
                    <th className="py-3.5 px-4 text-right">概算パート代・給与</th>
                    <th className="py-3.5 px-4 text-center">タイムカード・印刷</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm">
                  {monthlySummaries.map((s) => (
                    <tr key={s.worker.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-black text-stone-800">{s.worker.name}</div>
                        <div className="text-xs text-stone-400">
                          {s.worker.employment_type || 'パート・アルバイト'}
                        </div>
                        {s.unclosedCount > 0 && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
                            ⚠️ 未退勤 {s.unclosedCount}件あり
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-stone-700">
                        ¥{(s.worker.hourly_wage || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-stone-800">{s.workDays}日</td>
                      <td className="py-3.5 px-3 font-black text-emerald-700">
                        {formatMinutesToHoursText(s.totalNetMinutes)}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-stone-600">
                        {formatMinutesToHoursText(s.totalOvertimeMinutes)}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-purple-700">
                        {s.paidLeaveDays > 0 ? `${s.paidLeaveDays}日` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="text-base font-black text-stone-900">
                          ¥{s.totalEstimatedPay.toLocaleString()}
                        </div>
                        {s.overtimePay > 0 && (
                          <div className="text-[11px] text-stone-400">
                            （残業割増 ¥{s.overtimePay.toLocaleString()} 含）
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setTimecardWorkerId(s.worker.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors"
                        >
                          <FileText size={14} />
                          <span>日別明細・印刷</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          タブ③：有給・お休み・残業の承認
      ========================================================= */}
      {activeTab === 'approvals' && (
        <div className="space-y-6 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-stone-200 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-stone-800">🏖️ 有給休暇・お休み・残業の申請一覧</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                スタッフが現場ポータルから申請したお休みや残業を1クリックで承認できます。口頭で聞いたお休みの代理登録も可能です。
              </p>
            </div>
            <button
              onClick={() =>
                setProxyLeaveModal({
                  workerId: workers[0]?.id || '',
                  leaveDate: selectedDate,
                  leaveType: '有給休暇',
                  reason: '',
                })
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0"
            >
              <Plus size={16} />
              <span>＋ 口頭で聞いた有給・お休みを登録</span>
            </button>
          </div>

          {/* 有給・お休み申請リスト */}
          <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-sm">
            <h3 className="text-sm font-black text-stone-700 mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-emerald-600" />
              <span>有給休暇・お休みの申請（{leaveRequests.length}件）</span>
            </h3>

            {leaveRequests.length === 0 ? (
              <p className="text-xs text-stone-400 py-6 text-center">現在、有給・お休みの申請はありません。</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {leaveRequests.map((req) => {
                  const w = workerMap.get(req.worker_id);
                  const workerName = w ? w.name : '不明なスタッフ';
                  const targetDate = req.leave_date || req.start_date || '';
                  const isPending = req.status === '申請中' || req.status === 'pending';

                  return (
                    <div
                      key={req.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-stone-800 text-sm">{workerName}</span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            {req.type || req.leave_type || '有給休暇'}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              req.status === '承認'
                                ? 'bg-emerald-100 text-emerald-800'
                                : req.status === '却下'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <div className="text-xs text-stone-600 mt-1">
                          希望日：<strong>{targetDate}</strong>
                          {req.reason ? ` ／ 理由：${req.reason}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPending ? (
                          <>
                            <button
                              disabled={isSaving}
                              onClick={() => handleLeaveApproval(req.id, '承認')}
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                            >
                              <Check size={14} />
                              <span>承認する</span>
                            </button>
                            <button
                              disabled={isSaving}
                              onClick={() => handleLeaveApproval(req.id, '却下')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-red-50 text-stone-600 hover:text-red-600 text-xs font-bold"
                            >
                              <X size={14} />
                              <span>却下</span>
                            </button>
                          </>
                        ) : (
                          <button
                            disabled={isSaving}
                            onClick={() =>
                              handleLeaveApproval(req.id, req.status === '承認' ? '却下' : '承認')
                            }
                            className="text-xs text-stone-400 hover:text-stone-600 underline"
                          >
                            ステータスを変更
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 残業申請リスト */}
          <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-sm">
            <h3 className="text-sm font-black text-stone-700 mb-3 flex items-center gap-2">
              <Clock size={16} className="text-amber-600" />
              <span>残業の申請（{overtimeRequests.length}件）</span>
            </h3>

            {overtimeRequests.length === 0 ? (
              <p className="text-xs text-stone-400 py-6 text-center">現在、残業の申請はありません。</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {overtimeRequests.map((req) => {
                  const w = workerMap.get(req.worker_id);
                  const workerName = w ? w.name : '不明なスタッフ';
                  const isPending = req.status === 'pending' || req.status === '申請中';
                  const reqDate = req.request_date || req.date || '';

                  return (
                    <div
                      key={req.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-stone-800 text-sm">{workerName}</span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            残業 {req.overtime_minutes}分
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              req.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : req.status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {req.status === 'approved'
                              ? '承認済'
                              : req.status === 'rejected'
                              ? '却下'
                              : '確認待ち'}
                          </span>
                        </div>
                        <div className="text-xs text-stone-600 mt-1">
                          対象日：<strong>{reqDate}</strong>
                          {req.reason ? ` ／ 理由：${req.reason}` : ''}
                        </div>
                      </div>

                      {isPending && (
                        <div className="flex items-center gap-2">
                          <button
                            disabled={isSaving}
                            onClick={() => handleOvertimeApproval(req.id, 'approved')}
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                          >
                            <Check size={14} />
                            <span>承認する</span>
                          </button>
                          <button
                            disabled={isSaving}
                            onClick={() => handleOvertimeApproval(req.id, 'rejected')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-red-50 text-stone-600 hover:text-red-600 text-xs font-bold"
                          >
                            <X size={14} />
                            <span>却下</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          タブ④：スタッフ名簿・時給・PIN設定
      ========================================================= */}
      {activeTab === 'workers' && (
        <div className="space-y-5 print:hidden">
          <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-stone-800">👤 スタッフ名簿・時給・暗証番号の設定</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                ここで設定した「時給」がパート代計算や畑の原価（人件費）に自動反映されます。
              </p>
            </div>
            <button
              onClick={() =>
                setEditingWorker({
                  name: '',
                  hourly_wage: 1050,
                  pin_code: '',
                  role: 'worker',
                  employment_type: 'パート・アルバイト',
                  phone: '',
                  paid_leave_balance: 10,
                  paid_leave_carryover: 0,
                  notes: '',
                })
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-bold shrink-0"
            >
              <UserPlus size={16} />
              <span>＋ 新しいスタッフを登録</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workers.map((w) => (
              <div
                key={w.id}
                className="bg-white rounded-3xl border border-stone-200 p-5 shadow-sm flex flex-col justify-between gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-stone-800">{w.name}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-700">
                        {w.employment_type || 'パート・アルバイト'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-stone-600">
                      <div className="flex items-center gap-1.5">
                        <BadgeJapaneseYen size={14} className="text-emerald-600" />
                        <span>
                          時給：<strong className="text-stone-900">¥{(w.hourly_wage || 0).toLocaleString()}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <KeyRound size={14} className="text-stone-400" />
                        <span>
                          打刻PIN：<strong className="text-stone-900">{w.pin_code || '未設定'}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-purple-600" />
                        <span>
                          有給残日数：<strong className="text-stone-900">{w.paid_leave_balance ?? 10}日</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone size={14} className="text-stone-400" />
                        <span>{w.phone || '電話番号未登録'}</span>
                      </div>
                    </div>
                    {w.notes && <p className="mt-2 text-xs text-stone-500 bg-stone-50 p-2 rounded-xl">{w.notes}</p>}
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                      w.line_user_id
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {w.line_user_id ? 'LINE連携済' : 'LINE未連携'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-100">
                  <button
                    onClick={() => setLineModalWorker(w)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200"
                  >
                    📱 LINE連携QRを表示
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setEditingWorker({
                          id: w.id,
                          name: w.name,
                          hourly_wage: w.hourly_wage || 1050,
                          pin_code: w.pin_code || '',
                          role: w.role || 'worker',
                          employment_type: w.employment_type || 'パート・アルバイト',
                          phone: w.phone || '',
                          paid_leave_balance: w.paid_leave_balance ?? 10,
                          paid_leave_carryover: w.paid_leave_carryover ?? 0,
                          notes: w.notes || '',
                        })
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold"
                    >
                      <Edit3 size={13} />
                      <span>編集</span>
                    </button>
                    <button
                      onClick={() => handleDeleteWorker(w)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-red-50 text-stone-500 hover:text-red-600 text-xs font-bold"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================
          モーダル①：出退勤時刻・休憩の手動修正モーダル
      ========================================================= */}
      {editingAttendance && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-stone-800">
                ✏️ 出退勤・休憩時間の修正
              </h3>
              <button
                onClick={() => setEditingAttendance(null)}
                className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 text-xs font-bold text-stone-700">
              <div>スタッフ：<span className="text-sm font-black text-stone-900">{editingAttendance.workerName}</span></div>
              <div className="mt-1">対象日：<span className="text-sm font-black text-emerald-700">{editingAttendance.workDate}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">出勤時刻</label>
                <input
                  type="time"
                  value={editingAttendance.clockInTime}
                  onChange={(e) =>
                    setEditingAttendance({ ...editingAttendance, clockInTime: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-300 font-black text-base"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">退勤時刻</label>
                <input
                  type="time"
                  disabled={editingAttendance.isStillWorking}
                  value={editingAttendance.clockOutTime}
                  onChange={(e) =>
                    setEditingAttendance({ ...editingAttendance, clockOutTime: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-300 font-black text-base disabled:opacity-40"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1">
                休憩時間（分）
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={15}
                  value={editingAttendance.breakMinutes}
                  onChange={(e) =>
                    setEditingAttendance({
                      ...editingAttendance,
                      breakMinutes: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-28 px-3 py-2 rounded-xl border border-stone-300 font-black text-base"
                />
                <div className="flex gap-1.5">
                  {[0, 30, 60, 90].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        setEditingAttendance({ ...editingAttendance, breakMinutes: m })
                      }
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                        editingAttendance.breakMinutes === m
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-stone-100 text-stone-600 border-stone-200'
                      }`}
                    >
                      {m}分
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-stone-100">
              {editingAttendance.attendanceId ? (
                <button
                  type="button"
                  onClick={() =>
                    handleDeleteAttendance(
                      editingAttendance.attendanceId!,
                      editingAttendance.workerName
                    )
                  }
                  className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline"
                >
                  <Trash2 size={14} />
                  <span>この打刻を削除</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAttendance(null)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-600 text-xs font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveAttendance}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                >
                  {isSaving ? '保存中...' : '保存する'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          モーダル②：個人別の月間タイムカード（A4印刷対応）
      ========================================================= */}
      {selectedWorkerTimecard && (
        <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto p-4 md:p-8 print:static print:bg-white print:p-0">
          <div className="bg-white rounded-3xl max-w-4xl mx-auto p-6 md:p-8 shadow-2xl border border-stone-200 print:shadow-none print:border-none print:rounded-none">
            {/* モーダル上部アクションバー（印刷時は非表示） */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b border-stone-200 print:hidden">
              <button
                onClick={() => setTimecardWorkerId(null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold"
              >
                <ChevronLeft size={16} />
                <span>月別一覧へ戻る</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-bold shadow-sm"
                >
                  <Printer size={16} />
                  <span>🖨️ この出勤簿・給与明細をA4印刷する</span>
                </button>
              </div>
            </div>

            {/* タイムカード本体（印刷対象） */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-stone-800 pb-3">
                <div>
                  <div className="text-xs font-bold text-stone-500">
                    月間出勤簿・パート代明細書（対象期間：{monthlyPeriod.startStr} 〜 {monthlyPeriod.endStr}）
                  </div>
                  <h2 className="text-2xl font-black text-stone-900 mt-0.5">
                    {selectedWorkerTimecard.summary.worker.name} 様
                    <span className="text-xs font-bold text-stone-500 ml-3">
                      （{selectedWorkerTimecard.summary.worker.employment_type || 'パート・アルバイト'} ／ 時給 ¥
                      {(selectedWorkerTimecard.summary.worker.hourly_wage || 0).toLocaleString()}）
                    </span>
                  </h2>
                </div>

                <div className="mt-2 sm:mt-0 text-right">
                  <div className="text-xs font-bold text-stone-500">当月支給見込額（税込概算）</div>
                  <div className="text-2xl font-black text-emerald-800">
                    ¥{selectedWorkerTimecard.summary.totalEstimatedPay.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* 集計サマリー行 */}
              <div className="grid grid-cols-4 gap-2 bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs">
                <div>
                  <span className="text-stone-500 font-bold">出勤日数：</span>
                  <strong className="text-stone-900 font-black ml-1">
                    {selectedWorkerTimecard.summary.workDays}日
                  </strong>
                </div>
                <div>
                  <span className="text-stone-500 font-bold">実労働合計：</span>
                  <strong className="text-stone-900 font-black ml-1">
                    {formatMinutesToHoursText(selectedWorkerTimecard.summary.totalNetMinutes)}
                  </strong>
                </div>
                <div>
                  <span className="text-stone-500 font-bold">うち残業：</span>
                  <strong className="text-stone-900 font-black ml-1">
                    {formatMinutesToHoursText(selectedWorkerTimecard.summary.totalOvertimeMinutes)}
                  </strong>
                </div>
                <div>
                  <span className="text-stone-500 font-bold">有給取得：</span>
                  <strong className="text-stone-900 font-black ml-1">
                    {selectedWorkerTimecard.summary.paidLeaveDays}日
                  </strong>
                </div>
              </div>

              {/* 日別テーブル */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-300 bg-stone-100 text-stone-600 font-black">
                      <th className="py-2 px-2.5">日付</th>
                      <th className="py-2 px-2.5">出勤</th>
                      <th className="py-2 px-2.5">退勤</th>
                      <th className="py-2 px-2.5">休憩</th>
                      <th className="py-2 px-2.5">実労働</th>
                      <th className="py-2 px-2.5">主な作業・備考</th>
                      <th className="py-2 px-2.5 text-right">日額目安</th>
                      <th className="py-2 px-2 text-center print:hidden">修正</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {selectedWorkerTimecard.days.map((d) => {
                      const isWeekend = d.dayOfWeek === '日' || d.dayOfWeek === '土';
                      return (
                        <tr
                          key={d.dateStr}
                          className={`${isWeekend ? 'bg-stone-50/60' : ''} hover:bg-emerald-50/30`}
                        >
                          <td className="py-1.5 px-2.5 font-bold text-stone-800 whitespace-nowrap">
                            {d.dateStr.substring(5)}（{d.dayOfWeek}）
                          </td>
                          <td className="py-1.5 px-2.5 font-bold text-stone-800">
                            {d.attendance ? toJstTimeHm(d.attendance.clock_in) : '-'}
                          </td>
                          <td className="py-1.5 px-2.5 font-bold text-stone-800">
                            {d.attendance ? (
                              d.attendance.clock_out ? (
                                toJstTimeHm(d.attendance.clock_out)
                              ) : (
                                <span className="text-red-600 font-black">未退勤</span>
                              )
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 text-stone-600">
                            {d.attendance ? `${d.calc.breakMinutes}分` : '-'}
                          </td>
                          <td className="py-1.5 px-2.5 font-bold text-emerald-800">
                            {d.attendance && d.attendance.clock_out
                              ? formatMinutesToHoursText(d.calc.netMinutes)
                              : '-'}
                          </td>
                          <td className="py-1.5 px-2.5 text-stone-600">
                            {d.leave ? (
                              <span className="text-purple-700 font-bold">
                                🏖️ {d.leave.type || d.leave.leave_type || '有給休暇'}（{d.leave.status}）
                              </span>
                            ) : d.logs.length > 0 ? (
                              d.logs
                                .map((l) => {
                                  const c = getCropLabel(l);
                                  const t = getTaskLabel(l);
                                  return `${c ? c + ' ' : ''}${t}`;
                                })
                                .join('、')
                            ) : (
                              ''
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-bold text-stone-800">
                            {d.dailyPay > 0 ? `¥${d.dailyPay.toLocaleString()}` : '-'}
                          </td>
                          <td className="py-1.5 px-2 text-center print:hidden">
                            <button
                              onClick={() =>
                                openEditAttendanceModal(
                                  selectedWorkerTimecard.summary.worker,
                                  d.dateStr,
                                  d.attendance
                                )
                              }
                              className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 text-[11px] font-bold"
                            >
                              {d.attendance ? '修正' : '＋追加'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          モーダル③：スタッフ新規登録・編集モーダル
      ========================================================= */}
      {editingWorker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-stone-800">
                {editingWorker.id ? '👤 スタッフ情報の編集' : '👤 新しいスタッフの登録'}
              </h3>
              <button
                onClick={() => setEditingWorker(null)}
                className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-600 mb-1">
                  スタッフのお名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例：佐藤 花子"
                  value={editingWorker.name}
                  onChange={(e) => setEditingWorker({ ...editingWorker, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">雇用区分</label>
                <select
                  value={editingWorker.employment_type}
                  onChange={(e) =>
                    setEditingWorker({ ...editingWorker, employment_type: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-bold text-sm bg-white"
                >
                  <option value="パート・アルバイト">パート・アルバイト</option>
                  <option value="正社員">正社員</option>
                  <option value="技能実習・特定技能">技能実習・特定技能</option>
                  <option value="家族・役員">家族・役員</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">時給（円）</label>
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={editingWorker.hourly_wage}
                  onChange={(e) =>
                    setEditingWorker({
                      ...editingWorker,
                      hourly_wage: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-black text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">
                  打刻用暗証番号（4桁・任意）
                </label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="例：1234"
                  value={editingWorker.pin_code}
                  onChange={(e) => setEditingWorker({ ...editingWorker, pin_code: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">
                  有給休暇の残日数（日）
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={editingWorker.paid_leave_balance}
                  onChange={(e) =>
                    setEditingWorker({
                      ...editingWorker,
                      paid_leave_balance: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-bold text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-600 mb-1">
                  電話番号・緊急連絡先（任意）
                </label>
                <input
                  type="tel"
                  placeholder="例：090-1234-5678"
                  value={editingWorker.phone}
                  onChange={(e) => setEditingWorker({ ...editingWorker, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-bold text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-600 mb-1">
                  メモ（勤務曜日や特記事項など）
                </label>
                <input
                  type="text"
                  placeholder="例：火・木・金のみ勤務、15時まで"
                  value={editingWorker.notes}
                  onChange={(e) => setEditingWorker({ ...editingWorker, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-bold text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setEditingWorker(null)}
                className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-600 text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveWorker}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
              >
                {isSaving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          モーダル④：管理者が口頭で聞いた有給・お休みを代理登録
      ========================================================= */}
      {proxyLeaveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-stone-800">
                🏖️ 有給・お休みの代理登録
              </h3>
              <button
                onClick={() => setProxyLeaveModal(null)}
                className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">対象スタッフ</label>
                <select
                  value={proxyLeaveModal.workerId}
                  onChange={(e) =>
                    setProxyLeaveModal({ ...proxyLeaveModal, workerId: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-bold text-sm bg-white"
                >
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">お休みの日付</label>
                <input
                  type="date"
                  value={proxyLeaveModal.leaveDate}
                  onChange={(e) =>
                    setProxyLeaveModal({ ...proxyLeaveModal, leaveDate: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">お休みの種類</label>
                <select
                  value={proxyLeaveModal.leaveType}
                  onChange={(e) =>
                    setProxyLeaveModal({ ...proxyLeaveModal, leaveType: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-bold text-sm bg-white"
                >
                  <option value="有給休暇">有給休暇（全休）</option>
                  <option value="半日有給">有給休暇（半休）</option>
                  <option value="欠勤・私用休">希望休・私用休（無給）</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">メモ・理由（任意）</label>
                <input
                  type="text"
                  placeholder="例：通院のため、家庭の用事など"
                  value={proxyLeaveModal.reason}
                  onChange={(e) =>
                    setProxyLeaveModal({ ...proxyLeaveModal, reason: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-bold text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setProxyLeaveModal(null)}
                className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-600 text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveProxyLeave}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
              >
                {isSaving ? '登録中...' : '承認済みとして登録する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LINE連携モーダル */}
      <LineLinkModal
        isOpen={Boolean(lineModalWorker)}
        worker={lineModalWorker}
        onClose={() => setLineModalWorker(null)}
        onLinkedSuccess={() => loadData(tenantId, selectedMonth, selectedDate)}
      />
    </div>
  );
}
