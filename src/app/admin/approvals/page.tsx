"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Sprout,
  Loader2,
  Edit3,
  Users,
  Briefcase,
  Inbox,
  XCircle,
  FileText,
  Package,
  MessageSquare,
  Sun,
  Camera,
  Check,
  X,
  Eye,
  AlertCircle,
  Sparkles,
  RotateCcw,
  Search
} from 'lucide-react';
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';
import { getCurrentTenantId } from '@/lib/tenant';
import { getAdminApprovalsDataAction, updateWorkLogApprovalAction } from '@/app/actions/farm';

export default function ApprovalsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // フィルター・タブ状態
  const [statusTab, setStatusTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 詳細確認・修正承認モーダル用ステート
  const [inspectingLog, setInspectingLog] = useState<any | null>(null);
  const [editWorkDate, setEditWorkDate] = useState('');
  const [editWorkType, setEditWorkType] = useState('');
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editFieldId, setEditFieldId] = useState('');
  const [editCropId, setEditCropId] = useState('');
  const [editWorkerId, setEditWorkerId] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editHarvestAmount, setEditHarvestAmount] = useState('');
  const [editMaterialQty, setEditMaterialQty] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  // 写真拡大プレビュー
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const userTenantId = await getCurrentTenantId();
      if (!userTenantId) {
        setIsLoading(false);
        return;
      }
      setTenantId(userTenantId);

      const srvRes = await getAdminApprovalsDataAction(userTenantId);
      if (srvRes?.success) {
        if (srvRes.ownerId) setTenantId(srvRes.ownerId);
        setLogs(srvRes.logs || []);
        setFields(srvRes.fields || []);
        setCrops(srvRes.crops || []);
        setWorkers(srvRes.workers || []);
      } else {
        // 完了報告（status: completed）の全詳細項目とマスタを並列取得
        const [logsRes, fieldsRes, cropsRes, workersRes] = await Promise.all([
          supabase
            .from('work_logs')
            .select(`
              *,
              crops(id, name),
              fields(id, name, area_size),
              workers(id, name, hourly_wage),
              departments(id, name),
              materials(id, name, unit, default_price, category)
            `)
            .eq('user_id', userTenantId)
            .eq('status', 'completed')
            .order('work_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(300),
          supabase.from('fields').select('id, name, area_size').eq('user_id', userTenantId).order('name'),
          supabase.from('crops').select('id, name').eq('user_id', userTenantId).order('name'),
          supabase.from('workers').select('id, name, hourly_wage').eq('user_id', userTenantId).order('name')
        ]);

        if (logsRes.error) throw logsRes.error;
        setLogs(logsRes.data || []);
        setFields(fieldsRes.data || []);
        setCrops(cropsRes.data || []);
        setWorkers(workersRes.data || []);
      }
    } catch (err) {
      console.error('Approvals fetchData error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 日付曜日フォーマット
  const formatDateWithDay = (dateStr?: string) => {
    if (!dateStr) return '日付未設定';
    const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return dateStr;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${m[1]}年${Number(m[2])}月${Number(m[3])}日 (${days[d.getDay()] || ''})`;
  };

  // 時刻フォーマット
  const formatTimeShort = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // 分数を「〇時間〇分 (〇分)」へ整形
  const formatDurationReadable = (mins?: number) => {
    const m = Math.max(0, Math.round(Number(mins) || 0));
    if (m === 0) return '0分 (時間未入力)';
    const h = Math.floor(m / 60);
    const rem = m % 60;
    if (h === 0) return `${rem}分`;
    if (rem === 0) return `${h}時間 (${m}分)`;
    return `${h}時間${rem}分 (${m}分)`;
  };

  // 構造化メモのパーサー（システムタグを見やすいバッジと本文に分解）
  const parseReportMemo = (memoStr?: string) => {
    if (!memoStr || !memoStr.trim()) {
      return { badges: [] as string[], cleanBody: '' };
    }
    let text = memoStr.trim();
    const badges: string[] = [];

    // 先頭タグの抽出
    const tagMatches = text.match(/^(\[[^\]]+\]\s*)+/);
    if (tagMatches) {
      const rawTags = tagMatches[0].match(/\[([^\]]+)\]/g) || [];
      rawTags.forEach(t => badges.push(t.replace(/[\[\]]/g, '')));
      text = text.replace(tagMatches[0], '').trim();
    }

    // パイプ区切りの構造化情報がある場合
    if (text.includes(' | ')) {
      const parts = text.split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);
      const bodyParts: string[] = [];
      parts.forEach(p => {
        if (
          p.startsWith('使用農薬:') ||
          p.startsWith('品名:') ||
          p.startsWith('RAC:') ||
          p.startsWith('散布水量:') ||
          p.startsWith('合計N:') ||
          p.startsWith('総費用:') ||
          p.startsWith('費用:') ||
          p.startsWith('収穫量:')
        ) {
          badges.push(p);
        } else {
          bodyParts.push(p);
        }
      });
      return { badges, cleanBody: bodyParts.join('\n') };
    }

    return { badges, cleanBody: text };
  };

  // ステータス別の件数集計
  const statusCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    logs.forEach(l => {
      if (l.approval_status === 'pending') pending++;
      else if (l.approval_status === 'approved') approved++;
      else if (l.approval_status === 'rejected') rejected++;
    });
    return {
      pending,
      approved,
      rejected,
      all: logs.length
    };
  }, [logs]);

  // フィルタリング後のリスト
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (statusTab === 'pending' && l.approval_status !== 'pending') return false;
      if (statusTab === 'approved' && l.approval_status !== 'approved') return false;
      if (statusTab === 'rejected' && l.approval_status !== 'rejected') return false;

      if (selectedWorkerFilter !== 'all' && l.worker_id !== selectedWorkerFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const target = `${l.task_title || ''} ${l.work_type || ''} ${l.memo || ''} ${l.fields?.name || ''} ${l.crops?.name || ''} ${l.workers?.name || ''} ${l.materials?.name || ''} ${l.work_date || ''}`.toLowerCase();
        if (!target.includes(q)) return false;
      }
      return true;
    });
  }, [logs, statusTab, selectedWorkerFilter, searchQuery]);

  // 詳細確認・編集モーダルを開く
  const handleOpenInspectModal = (log: any, startInRejectMode: boolean = false) => {
    setInspectingLog(log);
    setEditWorkDate(log.work_date || '');
    setEditWorkType(log.work_type || log.task_title || '');
    setEditTaskTitle(log.task_title || '');
    setEditFieldId(log.field_id || '');
    setEditCropId(log.crop_id || '');
    setEditWorkerId(log.worker_id || '');
    setEditDuration(String(log.duration_minutes ?? 0));

    const rawMemo = String(log.memo || '');
    const harvestMatch = rawMemo.match(/\[?収穫量:\s*([0-9.]+)\s*kg\]?/i);
    if (log.harvest_amount !== null && log.harvest_amount !== undefined) {
      setEditHarvestAmount(String(log.harvest_amount));
    } else if (harvestMatch && harvestMatch[1]) {
      setEditHarvestAmount(harvestMatch[1]);
    } else {
      setEditHarvestAmount('');
    }

    setEditMaterialQty(log.material_quantity !== null && log.material_quantity !== undefined ? String(log.material_quantity) : '');
    setEditMemo(rawMemo.replace(/\[収穫量:\s*[0-9.]+\s*kg\]\s*/gi, '').trim());
    setRejectReasonInput('');
    setIsRejectMode(startInRejectMode);
  };

  // 単件の即時承認・ステータス更新
  const handleQuickUpdateStatus = async (id: string, newStatus: 'approved' | 'rejected' | 'pending') => {
    try {
      const activeTenantId = tenantId || (await getCurrentTenantId());
      const srvRes = await updateWorkLogApprovalAction(activeTenantId || '', [id], { approval_status: newStatus });
      if (!srvRes?.success) {
        let query = supabase
          .from('work_logs')
          .update({
            approval_status: newStatus
          })
          .eq('id', id);

        if (activeTenantId) {
          query = query.eq('user_id', activeTenantId);
        }

        const { error } = await query;
        if (error) throw error;
      }

      setLogs(prev => prev.map(l => (l.id === id ? { ...l, approval_status: newStatus } : l)));
      setSelectedIds(prev => prev.filter(item => item !== id));
      showToast(
        newStatus === 'approved'
          ? '作業報告を承認しました！'
          : newStatus === 'rejected'
          ? '作業報告を差し戻しました。'
          : '承認待ちへ戻しました。'
      );
    } catch (err: any) {
      alert(`エラー: ${err.message}`);
    }
  };

  // 選択した報告の一括承認
  const handleBulkApprove = async () => {
    const targetIds = selectedIds.length > 0 ? selectedIds : filteredLogs.filter(l => l.approval_status === 'pending').map(l => l.id);
    if (targetIds.length === 0) return;
    if (!confirm(`${targetIds.length}件の作業報告を一括で承認しますか？`)) return;

    try {
      const activeTenantId = tenantId || (await getCurrentTenantId());
      const srvRes = await updateWorkLogApprovalAction(activeTenantId || '', targetIds, { approval_status: 'approved' });
      if (!srvRes?.success) {
        let query = supabase
          .from('work_logs')
          .update({
            approval_status: 'approved'
          })
          .in('id', targetIds);

        if (activeTenantId) {
          query = query.eq('user_id', activeTenantId);
        }

        const { error } = await query;
        if (error) throw error;
      }

      setLogs(prev => prev.map(l => (targetIds.includes(l.id) ? { ...l, approval_status: 'approved' } : l)));
      setSelectedIds([]);
      showToast(`${targetIds.length}件の作業報告を一括承認しました！`);
    } catch (err: any) {
      alert(`一括承認エラー: ${err.message}`);
    }
  };

  // モーダルからの「内容を保存して承認」または「理由を添えて差し戻し」
  const handleSaveAndUpdateFromModal = async (targetStatus: 'approved' | 'rejected') => {
    if (!inspectingLog) return;
    setIsSubmittingModal(true);
    try {
      const activeTenantId = tenantId || (await getCurrentTenantId());
      let finalMemo = editMemo.replace(/\[収穫量:\s*[0-9.]+\s*kg\]\s*/gi, '').trim();
      if (editHarvestAmount !== '' && !isNaN(Number(editHarvestAmount)) && Number(editHarvestAmount) > 0) {
        finalMemo = finalMemo
          ? `[収穫量: ${Number(editHarvestAmount)}kg] ${finalMemo}`
          : `[収穫量: ${Number(editHarvestAmount)}kg]`;
      }
      if (targetStatus === 'rejected' && rejectReasonInput.trim()) {
        finalMemo = finalMemo
          ? `${finalMemo}\n【⚠️差し戻し理由: ${rejectReasonInput.trim()}】`
          : `【⚠️差し戻し理由: ${rejectReasonInput.trim()}】`;
      }

      const updatePayload: any = {
        work_date: editWorkDate || inspectingLog.work_date,
        work_type: editWorkType.trim() || inspectingLog.work_type || '一般作業',
        task_title: editTaskTitle.trim() || editWorkType.trim() || inspectingLog.task_title || null,
        field_id: editFieldId || null,
        crop_id: editCropId || null,
        worker_id: editWorkerId || null,
        duration_minutes: Math.max(0, parseInt(editDuration, 10) || 0),
        material_quantity: editMaterialQty !== '' ? Number(editMaterialQty) : null,
        memo: finalMemo || null,
        approval_status: targetStatus
      };

      const srvRes = await updateWorkLogApprovalAction(activeTenantId || '', [inspectingLog.id], updatePayload);
      if (!srvRes?.success) {
        let query = supabase.from('work_logs').update(updatePayload).eq('id', inspectingLog.id);
        if (activeTenantId) {
          query = query.eq('user_id', activeTenantId);
        }

        const { error } = await query;
        if (error) throw error;
      }

      showToast(
        targetStatus === 'approved'
          ? '報告内容を確認・保存し、承認しました！'
          : '差し戻し理由を記録して差し戻しました。'
      );
      setInspectingLog(null);
      await fetchData();
    } catch (err: any) {
      alert(`保存エラー: ${err.message}`);
    } finally {
      setIsSubmittingModal(false);
    }
  };

  return (
    <AdminOnlyGuard>
      <div className="max-w-5xl mx-auto space-y-5 pb-16">
        {/* 1. ヘッダー ＆ ステータス集計・一括承認バー */}
        <header className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2.5">
                <Inbox className="w-7 h-7 text-blue-600" />
                <span>日報・作業承認インボックス</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">
                現場から上がってきた作業完了報告の「作業内容・時間・使用資材・メモ・写真」を確認し、承認または修正・差し戻しを行います。
              </p>
            </div>

            <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
              <div className="bg-amber-50 text-amber-800 px-4 py-2 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 border border-amber-200">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span>承認待ち: {statusCounts.pending}件</span>
              </div>

              {statusCounts.pending > 0 && (
                <button
                  type="button"
                  onClick={handleBulkApprove}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {selectedIds.length > 0
                      ? `選択した ${selectedIds.length}件 を一括承認`
                      : `承認待ち (${statusCounts.pending}件) をすべて承認`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* ステータスタブ ＆ 検索・作業者フィルタ */}
          <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'pending', label: '⏳ 承認待ち', count: statusCounts.pending, activeClass: 'bg-amber-600 text-white' },
                { id: 'approved', label: '✅ 承認済み', count: statusCounts.approved, activeClass: 'bg-emerald-600 text-white' },
                { id: 'rejected', label: '↩️ 差し戻し中', count: statusCounts.rejected, activeClass: 'bg-rose-600 text-white' },
                { id: 'all', label: '📋 すべての完了報告', count: statusCounts.all, activeClass: 'bg-slate-800 text-white' }
              ].map(tab => {
                const isActive = statusTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusTab(tab.id as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                      isActive ? `${tab.activeClass} shadow-xs` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedWorkerFilter}
                onChange={e => setSelectedWorkerFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">👤 すべての報告者</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>

              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="作業内容・圃場・作目・メモで検索..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* 2. 報告カード一覧（中身が100%ひと目でわかる詳細カード） */}
        <div className="space-y-3.5">
          {isLoading ? (
            <div className="bg-white rounded-3xl p-16 shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-xs font-bold text-slate-400">作業報告データを読み込んでいます...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="bg-white rounded-3xl text-center py-20 px-4 shadow-sm border border-slate-200 flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-700">
                {statusTab === 'pending'
                  ? '現在、承認待ちの作業報告はありません'
                  : '条件に一致する作業報告はありません'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
                {statusTab === 'pending'
                  ? '現場からの報告はすべて確認・処理されています。過去の報告を見るには上の「✅ 承認済み」や「📋 すべての完了報告」を押してください。'
                  : '検索条件やタブを切り替えてご確認ください。'}
              </p>
            </div>
          ) : (
            filteredLogs.map(log => {
              const primaryTitle = log.work_type || log.task_title || '一般作業';
              const subTaskTitle = log.task_title && log.work_type && log.task_title !== log.work_type ? log.task_title : '';
              const { badges, cleanBody } = parseReportMemo(log.memo);
              const startClock = formatTimeShort(log.start_time);
              const endClock = formatTimeShort(log.end_time || log.completed_at);
              const hourlyWage = Number(log.workers?.hourly_wage) || 0;
              const estLaborCost = hourlyWage > 0 && log.duration_minutes > 0
                ? Math.round((hourlyWage * Number(log.duration_minutes)) / 60)
                : 0;
              const isShortDurationWarning = Number(log.duration_minutes) > 0 && Number(log.duration_minutes) <= 5;
              const isZeroDurationWarning = !log.duration_minutes || Number(log.duration_minutes) === 0;

              return (
                <div
                  key={log.id}
                  className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 hover:border-blue-300 transition-all space-y-4"
                >
                  {/* 上段: ステータス・日付・報告者・操作ボタン群 */}
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-2.5 flex-1 min-w-0">
                      {/* 1行目: ステータス・作業日・作業者・部署・天候 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {log.approval_status === 'pending' ? (
                          <span className="bg-amber-100 text-amber-800 border border-amber-300 text-xs font-black px-2.5 py-1 rounded-lg">
                            ⏳ 承認待ち
                          </span>
                        ) : log.approval_status === 'approved' ? (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-black px-2.5 py-1 rounded-lg">
                            ✅ 承認済み
                          </span>
                        ) : log.approval_status === 'rejected' ? (
                          <span className="bg-rose-100 text-rose-800 border border-rose-300 text-xs font-black px-2.5 py-1 rounded-lg">
                            ↩️ 差し戻し中
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 text-xs font-black px-2.5 py-1 rounded-lg">
                            📋 完了記録
                          </span>
                        )}

                        <span className="text-xs sm:text-sm font-black text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg font-mono">
                          📅 {formatDateWithDay(log.work_date)}
                        </span>

                        {log.workers ? (
                          <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                            <Users className="w-3.5 h-3.5 text-emerald-600" />
                            <span>報告者: {log.workers.name}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                            <Users className="w-3.5 h-3.5" />
                            <span>報告者未指定（管理者/一括記録）</span>
                          </span>
                        )}

                        {log.departments?.name && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                            <Briefcase className="w-3.5 h-3.5" />
                            <span>{log.departments.name}</span>
                          </span>
                        )}

                        {(log.weather || log.temperature !== null && log.temperature !== undefined) && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                            <Sun className="w-3.5 h-3.5 text-amber-500" />
                            <span>
                              {log.weather || ''}
                              {log.temperature !== null && log.temperature !== undefined ? ` ${log.temperature}℃` : ''}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* 2行目: 作業内容タイトル（大きく明確に！） */}
                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-black">
                          作業内容
                        </span>
                        <h3 className="text-lg sm:text-xl font-black text-slate-900">
                          {primaryTitle}
                        </h3>
                        {subTaskTitle && (
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                            指示タスク名: {subTaskTitle}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 右上: アクションボタン群（内容確認・修正 / 差し戻し / 承認する） */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleOpenInspectModal(log, false)}
                        className="px-3.5 py-2.5 text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="作業時間や圃場・メモを修正してから承認できます"
                      >
                        <Edit3 className="w-4 h-4 text-blue-600" />
                        <span>内容修正・詳細</span>
                      </button>

                      {log.approval_status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => handleOpenInspectModal(log, true)}
                          className="px-3.5 py-2.5 text-xs font-black text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>差し戻し</span>
                        </button>
                      )}

                      {log.approval_status !== 'approved' ? (
                        <button
                          type="button"
                          onClick={() => handleQuickUpdateStatus(log.id, 'approved')}
                          className="px-5 py-2.5 text-xs sm:text-sm text-white font-black bg-blue-600 hover:bg-blue-700 shadow-sm rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>承認する</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuickUpdateStatus(log.id, 'pending')}
                          className="px-3.5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>承認取消</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 中段: 報告の中身グリッド（① 圃場・作目 / ② 作業時間・時刻 / ③ 使用資材・収穫量） */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
                    {/* ① どこで・何を（圃場・作目） */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200/70 space-y-1.5">
                      <span className="text-[10px] font-black text-slate-400 block">📍 対象の圃場（畑） ＆ 作目</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 font-black text-slate-800 text-sm">
                          <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                          {log.fields?.name || '圃場未指定'}
                          {log.fields?.area_size ? <span className="text-xs text-slate-400 font-bold">({log.fields.area_size}a)</span> : null}
                        </span>
                        <span className="text-slate-300">/</span>
                        <span className="inline-flex items-center gap-1 font-black text-emerald-700 text-sm">
                          <Sprout className="w-4 h-4 text-emerald-600 shrink-0" />
                          {log.crops?.name || '作目未指定'}
                        </span>
                      </div>
                    </div>

                    {/* ② どのくらい時間をかけたか（作業時間・開始終了時刻・人件費概算） */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200/70 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400">⏱️ 作業時間・打刻時刻</span>
                        {(isShortDurationWarning || isZeroDurationWarning) && (
                          <button
                            type="button"
                            onClick={() => handleOpenInspectModal(log, false)}
                            className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded hover:bg-amber-100 cursor-pointer"
                          >
                            ⚠️ 時間を修正する
                          </button>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className={`text-sm font-black ${
                          isShortDurationWarning || isZeroDurationWarning ? 'text-amber-700' : 'text-slate-900'
                        }`}>
                          {formatDurationReadable(log.duration_minutes)}
                        </span>
                        {(startClock || endClock) && (
                          <span className="text-[11px] font-mono font-bold text-slate-500">
                            ({startClock || '--:--'} 〜 {endClock || '--:--'})
                          </span>
                        )}
                        {log.time_slot && (
                          <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            時間帯: {log.time_slot}
                          </span>
                        )}
                      </div>
                      {estLaborCost > 0 && (
                        <p className="text-[10px] font-bold text-slate-400">
                          概算人件費: ¥{estLaborCost.toLocaleString()} (時給 ¥{hourlyWage.toLocaleString()})
                        </p>
                      )}
                    </div>

                    {/* ③ 使用した農薬・肥料・資材 または 収穫量 */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200/70 space-y-1">
                      <span className="text-[10px] font-black text-slate-400 block">🧪 使用資材（農薬・肥料） / 🧺 収穫量</span>
                      {log.materials?.name || log.harvest_amount ? (
                        <div className="space-y-1">
                          {log.materials?.name && (
                            <div className="font-black text-rose-800 text-xs flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>{log.materials.name}</span>
                              {log.material_quantity ? (
                                <span className="px-1.5 py-0.5 bg-rose-50 border border-rose-200 rounded text-[11px]">
                                  数量: {log.material_quantity}{log.materials.unit || ''}
                                </span>
                              ) : null}
                            </div>
                          )}
                          {log.harvest_amount !== null && log.harvest_amount !== undefined && Number(log.harvest_amount) > 0 && (
                            <div className="font-black text-emerald-800 text-xs flex items-center gap-1.5">
                              <span>🧺 収穫量: {log.harvest_amount} kg</span>
                            </div>
                          )}
                        </div>
                      ) : badges.length > 0 ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          {badges.map((b, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[11px] font-bold">
                              {b}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-slate-400 block pt-0.5">
                          資材使用・収穫量の記録なし
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 下段: 📝 報告メモ・詳細コメント ＆ 📷 現場写真 */}
                  <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>作業報告メモ・詳細内容:</span>
                      </div>

                      {cleanBody || badges.length > 0 ? (
                        <div className="space-y-1.5 pl-5">
                          {badges.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {badges.map((b, bIdx) => (
                                <span
                                  key={bIdx}
                                  className="px-2 py-0.5 bg-white text-blue-900 border border-blue-200 rounded-md text-xs font-bold"
                                >
                                  {b}
                                </span>
                              ))}
                            </div>
                          )}
                          {cleanBody && (
                            <p className="text-xs sm:text-sm font-bold text-slate-800 whitespace-pre-wrap leading-relaxed">
                              {cleanBody}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-slate-400 pl-5">
                          ※報告者からの特記事項・メモ記入はありません（上の作業内容・圃場・時間の定型報告のみです）
                        </p>
                      )}
                    </div>

                    {/* 添付写真がある場合 */}
                    {log.photo_url && (
                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewPhotoUrl(log.photo_url)}
                          className="group relative rounded-xl overflow-hidden border-2 border-blue-200 hover:border-blue-500 transition-all cursor-pointer"
                        >
                          <img
                            src={log.photo_url}
                            alt="現場報告写真"
                            className="w-24 h-16 object-cover"
                          />
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-[10px] font-black text-white flex items-center gap-1">
                              <Eye className="w-3 h-3" /> 拡大
                            </span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 🔍 3. 内容確認・修正して承認 / 差し戻しモーダル */}
        {inspectingLog && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 my-8 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  {isRejectMode ? (
                    <>
                      <XCircle className="w-5 h-5 text-rose-600" />
                      <span>作業報告の差し戻し（理由の記入）</span>
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-5 h-5 text-blue-600" />
                      <span>報告内容の確認・修正して承認</span>
                    </>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={() => setInspectingLog(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isRejectMode ? (
                <div className="space-y-4">
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-1">
                    <p className="font-black text-rose-900">
                      対象報告: {inspectingLog.work_date} / {inspectingLog.workers?.name || '作業者'} / {inspectingLog.work_type || inspectingLog.task_title || '一般作業'}
                    </p>
                    <p className="text-rose-700 font-medium">
                      差し戻す理由（例: 作業時間が2分になっているため正しい時間を教えてください等）を入力できます。なお、管理者が直接時間を直して承認したい場合は下の「内容を直接修正して承認する」へ切り替えられます。
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1">
                      差し戻し理由・コメント（任意）
                    </label>
                    <textarea
                      value={rejectReasonInput}
                      onChange={e => setRejectReasonInput(e.target.value)}
                      placeholder="例: 作業時間が2分になっています。2時間(120分)の間違いでしょうか？"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none h-24 focus:ring-2 focus:ring-rose-400"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsRejectMode(false)}
                      className="text-xs font-black text-blue-600 hover:underline cursor-pointer"
                    >
                      ✏️ 差し戻さずに管理者側で修正して承認する
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectingLog(null)}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        disabled={isSubmittingModal}
                        onClick={() => handleSaveAndUpdateFromModal('rejected')}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSubmittingModal ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        <span>この内容で差し戻す</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <p className="text-xs font-bold text-slate-500">
                    💡 現場スタッフが入力した作業時間（例: 2分→120分）や圃場・作目・メモに間違いがある場合、ここで直接直してそのまま承認できます。
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">作業日</label>
                      <input
                        type="date"
                        value={editWorkDate}
                        onChange={e => setEditWorkDate(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">報告者（作業員）</label>
                      <select
                        value={editWorkerId}
                        onChange={e => setEditWorkerId(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none"
                      >
                        <option value="">未指定</option>
                        {workers.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">作業内容（区分）</label>
                      <input
                        type="text"
                        value={editWorkType}
                        onChange={e => setEditWorkType(e.target.value)}
                        placeholder="例: 収穫、定植、除草、農薬散布など"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">
                        作業時間 (分) <span className="text-blue-600">※60分=1時間</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={editDuration}
                          onChange={e => setEditDuration(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 outline-none"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          {[30, 60, 120, 180].map(preset => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setEditDuration(String(preset))}
                              className="px-2 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-lg text-[10px] font-black cursor-pointer"
                            >
                              {preset}分
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">対象の圃場（畑）</label>
                      <select
                        value={editFieldId}
                        onChange={e => setEditFieldId(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none"
                      >
                        <option value="">未指定</option>
                        {fields.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">対象の作目</label>
                      <select
                        value={editCropId}
                        onChange={e => setEditCropId(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none"
                      >
                        <option value="">未指定</option>
                        {crops.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">収穫量 (kg・任意)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editHarvestAmount}
                        onChange={e => setEditHarvestAmount(e.target.value)}
                        placeholder="未入力"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">
                        資材使用量 ({inspectingLog.materials?.name || '資材'}・任意)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={editMaterialQty}
                        onChange={e => setEditMaterialQty(e.target.value)}
                        placeholder="未入力"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">作業報告メモ・詳細</label>
                    <textarea
                      value={editMemo}
                      onChange={e => setEditMemo(e.target.value)}
                      placeholder="作業の詳細メモや特記事項..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none h-20"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsRejectMode(true)}
                      className="px-3.5 py-2 text-xs font-black text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                    >
                      差し戻しへ切替
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectingLog(null)}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        disabled={isSubmittingModal}
                        onClick={() => handleSaveAndUpdateFromModal('approved')}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        {isSubmittingModal ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>この内容で保存して承認する</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 📷 写真拡大プレビューモーダル */}
        {previewPhotoUrl && (
          <div
            onClick={() => setPreviewPhotoUrl(null)}
            className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="relative max-w-3xl w-full bg-white p-3 rounded-3xl shadow-2xl">
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="absolute top-5 right-5 p-2 bg-slate-900/70 text-white rounded-full hover:bg-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <img src={previewPhotoUrl} alt="現場報告写真プレビュー" className="w-full max-h-[80vh] object-contain rounded-2xl" />
            </div>
          </div>
        )}

        {/* トースト通知 */}
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-800 flex items-center gap-2.5 text-xs font-black animate-in slide-in-from-top-4 duration-200">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </AdminOnlyGuard>
  );
}
