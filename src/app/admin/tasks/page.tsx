
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, CheckCircle2, Clock, MapPin, Sprout, Loader2, Plus, Trash2, Edit2, Users, Briefcase, X, List, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import { autoTranslateMasterData } from '@/app/actions/translate';

import { getCurrentTenantId } from '@/lib/tenant';
import { getJSTDate } from '@/lib/dateUtils';
import { savePlannedTask, deletePlannedTask } from '@/app/actions/farm';

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>({
    work_date: getJSTDate(),
    task_title: '',
    crop_id: '',
    department_id: '',
    memo: '',
    field_assignments: [
      { field_id: '', worker_ids: [] as string[], step_order: 1, time_slot: '', field_memo: '' }
    ]
  });

  // UI State
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [groupMode, setGroupMode] = useState<'worker' | 'field' | 'crop'>('field');
  const [calendarDays, setCalendarDays] = useState<number>(7); // 2 = Today/Tomorrow, 7 = Week
  const [startDate, setStartDate] = useState(new Date());

  const fetchTasksData = async (ownerId: string) => {
    try {
      const { data, error } = await supabase
        .from('work_logs')
        .select('id, work_date, task_title, task_title_en, task_title_vi, task_title_id, task_title_zh, status, approval_status, duration_minutes, crop_id, field_id, worker_id, department_id, memo, step_order, time_slot, crops(name), fields(name), workers(name), departments(name)')
        .eq('user_id', ownerId)
        .eq('status', 'planned')
        .order('work_date', { ascending: true })
        .order('step_order', { ascending: true, nullsFirst: false });
      if (!error && data) {
        setTasks(data);
      }
    } catch (e) {
      console.error('Failed to fetch tasks:', e);
    }
  };

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const ownerId = await getCurrentTenantId();
        if (!ownerId) {
          setIsLoading(false);
          return;
        }
        setTenantId(ownerId);

        const [tasksRes, cropsRes, fieldsRes, workersRes, deptsRes] = await Promise.all([
          supabase.from('work_logs').select('id, work_date, task_title, task_title_en, task_title_vi, task_title_id, task_title_zh, status, approval_status, duration_minutes, crop_id, field_id, worker_id, department_id, memo, step_order, time_slot, crops(name), fields(name), workers(name), departments(name)').eq('user_id', ownerId).eq('status', 'planned').order('work_date', { ascending: true }).order('step_order', { ascending: true, nullsFirst: false }),
          supabase.from('crops').select('*').eq('user_id', ownerId).order('name'),
          supabase.from('fields').select('*').eq('user_id', ownerId).order('name'),
          supabase.from('workers').select('*').eq('user_id', ownerId).order('name'),
          supabase.from('departments').select('*').eq('tenant_id', ownerId).order('name')
        ]);

        if (tasksRes.data) setTasks(tasksRes.data);
        if (cropsRes.data) setCrops(cropsRes.data);
        if (fieldsRes.data) setFields(fieldsRes.data);
        if (workersRes.data) setWorkers(workersRes.data);
        if (deptsRes.data) setDepartments(deptsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!formData.work_date || !formData.task_title) {
      alert('予定日とタスク内容は必須です');
      return;
    }
    setIsSaving(true);
    try {
      const activeTenantId = tenantId || await getCurrentTenantId();
      if (!activeTenantId) throw new Error('農園IDが特定できません');

      // タスクタイトルの多言語AI自動翻訳を生成
      let transPayload: any = {};
      try {
        const trans = await autoTranslateMasterData(formData.task_title);
        transPayload = {
          task_title_en: trans.name_en || formData.task_title,
          task_title_vi: trans.name_vi || formData.task_title,
          task_title_id: trans.name_id || formData.task_title,
          task_title_zh: trans.name_zh || formData.task_title,
          task_title_si: trans.name_si || formData.task_title,
          task_title_km: trans.name_km || formData.task_title,
        };
      } catch (tErr) {
        console.warn('Translation fallback:', tErr);
      }

      // 1. サーバーアクション経由で保存を試行
      let saveSuccess = false;
      try {
        const result = await savePlannedTask(
          activeTenantId,
          {
            work_date: formData.work_date,
            task_title: formData.task_title,
            crop_id: formData.crop_id || null,
            department_id: formData.department_id || null,
            memo: formData.memo || null,
            field_assignments: formData.field_assignments.map((fa: any, i: number) => ({
              field_id: fa.field_id || '',
              worker_ids: fa.worker_ids || [],
              step_order: fa.step_order || (i + 1),
              time_slot: fa.time_slot || '',
              field_memo: fa.field_memo || ''
            })),
            translations: transPayload
          },
          editingTaskId
        );
        if (result && result.success) {
          saveSuccess = true;
        }
      } catch (serverErr) {
        console.warn('Server action failed, trying client direct save:', serverErr);
      }

      // 2. サーバーアクションが通らなかった場合はクライアントSDKで直接保存（2段構え）
      if (!saveSuccess) {
        if (editingTaskId) {
          const assignment = formData.field_assignments[0] || { field_id: '', worker_ids: [] };
          const updatePayload: any = {
            work_date: formData.work_date,
            task_title: formData.task_title,
            work_type: formData.task_title,
            crop_id: formData.crop_id || null,
            field_id: assignment.field_id || null,
            worker_id: (assignment.worker_ids && assignment.worker_ids.length > 0) ? assignment.worker_ids[0] : null,
            department_id: formData.department_id || null,
            memo: formData.memo || null,
            step_order: assignment.step_order || 1,
            time_slot: assignment.time_slot || null,
            ...transPayload
          };
          const { error: cErr } = await supabase.from('work_logs').update(updatePayload).eq('id', editingTaskId).eq('user_id', activeTenantId);
          if (cErr) throw cErr;
        } else {
          const insertData: any[] = [];
          const assignments = formData.field_assignments && formData.field_assignments.length > 0
            ? formData.field_assignments
            : [{ field_id: '', worker_ids: [] }];

          assignments.forEach((assignment: any, idx: number) => {
            const fId = assignment.field_id || null;
            const wIds = assignment.worker_ids || [];
            const stepNum = assignment.step_order || (idx + 1);
            if (wIds.length > 0) {
              wIds.forEach((wId: string) => {
                insertData.push({
                  user_id: activeTenantId,
                  work_date: formData.work_date,
                  task_title: formData.task_title,
                  work_type: formData.task_title,
                  crop_id: formData.crop_id || null,
                  field_id: fId,
                  worker_id: wId,
                  department_id: formData.department_id || null,
                  memo: formData.memo || null,
                  step_order: stepNum,
                  time_slot: assignment.time_slot || null,
                  status: 'planned',
                  duration_minutes: 0,
                  ...transPayload
                });
              });
            } else {
              insertData.push({
                user_id: activeTenantId,
                work_date: formData.work_date,
                task_title: formData.task_title,
                work_type: formData.task_title,
                crop_id: formData.crop_id || null,
                field_id: fId,
                worker_id: null,
                department_id: formData.department_id || null,
                memo: formData.memo || null,
                step_order: stepNum,
                time_slot: assignment.time_slot || null,
                status: 'planned',
                duration_minutes: 0,
                ...transPayload
              });
            }
          });
          const { error: cErr } = await supabase.from('work_logs').insert(insertData);
          if (cErr) throw cErr;
        }
      }

      // 一覧を最新化
      await fetchTasksData(activeTenantId);

      setIsModalOpen(false);
      setEditingTaskId(null);
      setFormData({
        work_date: getJSTDate(),
        task_title: '',
        crop_id: '',
        department_id: '',
        memo: '',
        field_assignments: [{ field_id: '', worker_ids: [], step_order: 1, time_slot: '', field_memo: '' }]
      });
    } catch (err: any) {
      console.error('Task save error:', err);
      alert('保存に失敗しました: ' + (err.message || '通信エラー'));
    } finally {
      setIsSaving(false);
    }
  };

  // タスクの巡回順序を即座に入れ替える（▲ / ▼ クイック並び替え）
  const handleMoveTaskOrder = async (task: any, direction: 'up' | 'down', siblingTasks: any[]) => {
    const currentIndex = siblingTasks.findIndex(t => t.id === task.id);
    if (currentIndex < 0) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= siblingTasks.length) return;

    const targetTask = siblingTasks[targetIndex];
    const newOrderForCurrent = targetIndex + 1;
    const newOrderForTarget = currentIndex + 1;

    // ローカルステートを即時更新してUIを快適に
    setTasks(prev => prev.map(t => {
      if (t.id === task.id) return { ...t, step_order: newOrderForCurrent };
      if (t.id === targetTask.id) return { ...t, step_order: newOrderForTarget };
      return t;
    }));

    try {
      const activeTenantId = tenantId || await getCurrentTenantId();
      await supabase.from('work_logs').update({ step_order: newOrderForCurrent }).eq('id', task.id).eq('user_id', activeTenantId);
      await supabase.from('work_logs').update({ step_order: newOrderForTarget }).eq('id', targetTask.id).eq('user_id', activeTenantId);
      if (activeTenantId) {
        await fetchTasksData(activeTenantId);
      }
    } catch (e) {
      console.error('Order update error:', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('本当に削除しますか？')) return;
    try {
      const activeTenantId = tenantId || await getCurrentTenantId();
      let delSuccess = false;
      try {
        const res = await deletePlannedTask(id, activeTenantId);
        if (res && res.success) delSuccess = true;
      } catch (e) {}

      if (!delSuccess) {
        let q = supabase.from('work_logs').delete().eq('id', id);
        if (activeTenantId) {
          q = q.eq('user_id', activeTenantId);
        }
        await q;
      }

      if (activeTenantId) {
        await fetchTasksData(activeTenantId);
      } else {
        setTasks(tasks.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenModal = (dateStr?: string, workerId?: string, fieldId?: string, cropId?: string) => {
    setEditingTaskId(null);
    setFormData({
      work_date: dateStr || getJSTDate(),
      task_title: '',
      crop_id: cropId || '',
      department_id: '',
      memo: '',
      field_assignments: [
        {
          field_id: fieldId || '',
          worker_ids: workerId ? [workerId] : [],
          step_order: 1,
          time_slot: '',
          field_memo: ''
        }
      ]
    });
    setIsModalOpen(true);
  };

  const handleEditModal = (task: any) => {
    setEditingTaskId(task.id);
    setFormData({
      work_date: task.work_date,
      task_title: task.task_title || '',
      crop_id: task.crop_id || '',
      department_id: task.department_id || '',
      memo: task.memo || '',
      field_assignments: [
        {
          field_id: task.field_id || '',
          worker_ids: task.worker_id ? [task.worker_id] : [],
          step_order: task.step_order || 1,
          time_slot: task.time_slot || '',
          field_memo: ''
        }
      ]
    });
    setIsModalOpen(true);
  };

  // Calendar Logic
  const dates = useMemo(() => {
    const arr = [];
    for (let i = 0; i < calendarDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [startDate, calendarDays]);

  const handlePrev = () => {
    const d = new Date(startDate);
    d.setDate(d.getDate() - calendarDays);
    setStartDate(d);
  };
  
  const handleNext = () => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + calendarDays);
    setStartDate(d);
  };

  const handleToday = () => {
    setStartDate(new Date());
  };

  const getWeekDayStr = (d: Date) => ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];

  // グループ化されたデータ (Worker or Field)
  const groupedItems = useMemo(() => {
    if (groupMode === 'worker') {
      const items = [...workers];
      items.push({ id: 'unassigned', name: '(担当者未定 / 全員)' });
      return items;
    } else if (groupMode === 'crop') {
      const items = [...crops];
      items.push({ id: 'unassigned', name: '(作物指定なし)' });
      return items;
    } else {
      const items = [...fields];
      items.push({ id: 'unassigned', name: '(圃場指定なし)' });
      return items;
    }
  }, [workers, fields, crops, groupMode]);

  return (
    <div className="max-w-[95vw] mx-auto space-y-6 pb-12 relative">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2 md:gap-3">
            <Calendar className="w-6 h-6 md:w-8 md:h-8 text-emerald-600 flex-shrink-0" />
            タスク・スケジュール管理
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-2 font-medium">誰がどこで何の作業をするか、日々のスケジュールを管理します。</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('calendar')} 
              className={`px-3 py-1.5 text-sm font-bold rounded-lg flex items-center gap-2 transition-all ${viewMode === 'calendar' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
            >
              <LayoutGrid className="w-4 h-4" /> カレンダー
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`px-3 py-1.5 text-sm font-bold rounded-lg flex items-center gap-2 transition-all ${viewMode === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
            >
              <List className="w-4 h-4" /> リスト
            </button>
          </div>
          
          <button 
            onClick={() => handleOpenModal()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            新規追加
          </button>
        </div>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
          </div>
        ) : viewMode === 'list' ? (
          // リストビュー (既存)
          <div className="p-0">
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-slate-400">現在予定されているタスクはありません</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 font-bold">
                    <tr>
                      <th className="px-6 py-4">予定日</th>
                      <th className="px-6 py-4">タスク内容</th>
                      <th className="px-6 py-4">割り当て</th>
                      <th className="px-6 py-4">圃場 / 作目</th>
                      <th className="px-6 py-4">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {tasks.map(t => (
                      <tr key={t.id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="px-6 py-4">{t.work_date}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {t.step_order && t.step_order > 0 && (
                              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                                {t.step_order}
                              </span>
                            )}
                            <span className="font-bold text-slate-900">{t.task_title || '-'}</span>
                            {t.time_slot && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                                {t.time_slot}
                              </span>
                            )}
                          </div>
                          {t.memo && (
                            <p className="text-xs text-slate-500 font-normal mt-1 flex items-start gap-1">
                              <span className="text-slate-400 font-bold">📝</span> {t.memo}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 flex items-center gap-2">
                          {t.departments && (
                            <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-md text-xs">
                              <Briefcase className="w-3 h-3" /> {t.departments.name}
                            </span>
                          )}
                          {t.workers && (
                            <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-xs">
                              <Users className="w-3 h-3" /> {t.workers.name}
                            </span>
                          )}
                          {!t.departments && !t.workers && <span className="text-slate-400">全体</span>}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {t.fields && <span className="mr-2">📍{t.fields.name}</span>}
                          {t.crops && <span>🌱{t.crops.name}</span>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleEditModal(t)} 
                              className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors font-bold text-xs flex items-center gap-1"
                              title="編集"
                            >
                              ✏️ 編集
                            </button>
                            <button 
                              onClick={() => handleDelete(t.id)} 
                              className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          // カレンダー（マトリックス）ビュー
          <div className="flex flex-col">
            <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <button onClick={handlePrev} className="p-2 hover:bg-slate-100 transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                <button onClick={handleToday} className="px-4 font-black text-slate-700 hover:bg-slate-50 text-sm">今日</button>
                <button onClick={handleNext} className="p-2 hover:bg-slate-100 transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">表示単位:</span>
                  <select 
                    value={calendarDays} 
                    onChange={e => setCalendarDays(Number(e.target.value))}
                    className="text-sm font-bold bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
                  >
                    <option value={2}>今日・明日 (2日)</option>
                    <option value={7}>週間 (7日)</option>
                    <option value={14}>2週間 (14日)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">グループ:</span>
                  <div className="bg-white border border-slate-200 rounded-lg p-0.5 flex">
                    <button 
                      onClick={() => setGroupMode('field')} 
                      className={`px-3 py-1 text-xs font-bold rounded ${groupMode === 'field' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      圃場別
                    </button>
                    <button 
                      onClick={() => setGroupMode('worker')} 
                      className={`px-3 py-1 text-xs font-bold rounded ${groupMode === 'worker' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      作業者別
                    </button>
                    <button 
                      onClick={() => setGroupMode('crop')} 
                      className={`px-3 py-1 text-xs font-bold rounded ${groupMode === 'crop' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      作目別
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto relative">
              <table className="w-full border-collapse text-left text-xs table-fixed min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="p-3 font-black w-48 border-r sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      {groupMode === 'worker' ? '作業者' : groupMode === 'crop' ? '作目' : '圃場'}
                    </th>
                    {dates.map((d, i) => {
                      const isToday = getJSTDate(d) === getJSTDate();
                      return (
                        <th key={i} className={`p-2.5 font-black text-center border-r border-slate-200 min-w-[150px] ${isToday ? 'bg-emerald-50 text-emerald-800' : ''}`}>
                          <div>{d.getMonth() + 1}/{d.getDate()} ({['日','月','火','水','木','金','土'][d.getDay()]})</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupedItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 group">
                      <td className="px-4 py-3 border-r sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-slate-50">
                        <div className="font-bold text-slate-700 truncate max-w-[160px] flex items-center gap-2">
                          {groupMode === 'worker' ? (
                            <><Users className="w-4 h-4 text-blue-500" /> {item.name}</>
                          ) : groupMode === 'crop' ? (
                            <><Sprout className="w-4 h-4 text-amber-500" /> {item.name}</>
                          ) : (
                            <><MapPin className="w-4 h-4 text-emerald-500" /> {item.name}</>
                          )}
                        </div>
                      </td>
                      {dates.map((d, i) => {
                        const dateStr = getJSTDate(d);
                        const cellTasks = tasks
                          .filter(t => {
                            if (t.work_date !== dateStr) return false;
                            if (groupMode === 'worker') {
                              if (item.id === 'unassigned') return !t.worker_id;
                              return t.worker_id === item.id;
                            } else if (groupMode === 'crop') {
                              if (item.id === 'unassigned') return !t.crop_id;
                              return t.crop_id === item.id;
                            } else {
                              if (item.id === 'unassigned') return !t.field_id;
                              return t.field_id === item.id;
                            }
                          })
                          .sort((a, b) => (a.step_order || 1) - (b.step_order || 1));

                        return (
                          <td key={i} className="p-1.5 border-r border-slate-100 relative min-h-[60px] align-top">
                            <div className="min-h-[50px] relative group/cell">
                              <button 
                                onClick={() => handleOpenModal(
                                  dateStr, 
                                  groupMode === 'worker' ? (item.id !== 'unassigned' ? item.id : '') : '', 
                                  groupMode === 'field' ? (item.id !== 'unassigned' ? item.id : '') : '', 
                                  groupMode === 'crop' ? (item.id !== 'unassigned' ? item.id : '') : ''
                                )}
                                className="absolute inset-0 w-full h-full flex items-center justify-center opacity-0 group-hover/cell:opacity-100 hover:bg-slate-100/50 transition-all rounded z-0"
                              >
                                <Plus className="w-5 h-5 text-emerald-500" />
                              </button>
                              
                              <div className="relative z-10 flex flex-col gap-1.5 w-full">
                                {cellTasks.map((task, taskIdx) => (
                                  <div 
                                    key={task.id} 
                                    onClick={() => handleEditModal(task)} 
                                    className="bg-white border border-emerald-200 shadow-sm p-2 rounded-lg group/task hover:border-emerald-400 hover:shadow-md transition-all relative cursor-pointer"
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                                          {task.step_order || taskIdx + 1}
                                        </span>
                                        <div className="font-bold text-emerald-800 text-xs truncate" title={task.task_title}>
                                          {task.task_title}
                                        </div>
                                      </div>

                                      {/* ▲ / ▼ クイック並び替えボタン & 削除 */}
                                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/task:opacity-100 transition-opacity bg-white/90 rounded px-1">
                                        {cellTasks.length > 1 && (
                                          <>
                                            <button
                                              type="button"
                                              disabled={taskIdx === 0}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleMoveTaskOrder(task, 'up', cellTasks);
                                              }}
                                              className="p-0.5 text-slate-400 hover:text-emerald-700 disabled:opacity-20 text-[10px] font-black"
                                              title="順番を前へ"
                                            >
                                              ▲
                                            </button>
                                            <button
                                              type="button"
                                              disabled={taskIdx === cellTasks.length - 1}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleMoveTaskOrder(task, 'down', cellTasks);
                                              }}
                                              className="p-0.5 text-slate-400 hover:text-emerald-700 disabled:opacity-20 text-[10px] font-black"
                                              title="順番を次へ"
                                            >
                                              ▼
                                            </button>
                                          </>
                                        )}
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                                          className="p-0.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                          title="削除"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                                      {task.time_slot && (
                                        <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-1 py-0.2 rounded w-max">
                                          ⏱️ {task.time_slot}
                                        </span>
                                      )}
                                      {groupMode === 'worker' && task.fields && (
                                        <div className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 text-emerald-500"/> {task.fields.name}</div>
                                      )}
                                      {groupMode === 'worker' && task.crops && (
                                        <div className="flex items-center gap-1 truncate text-slate-500"><Sprout className="w-3 h-3 text-amber-500"/> {task.crops.name}</div>
                                      )}
                                      {groupMode === 'field' && task.workers && (
                                        <div className="flex items-center gap-1 truncate"><Users className="w-3 h-3 text-blue-500"/> {task.workers.name}</div>
                                      )}
                                      {groupMode === 'field' && task.crops && (
                                        <div className="flex items-center gap-1 truncate text-slate-500"><Sprout className="w-3 h-3 text-amber-500"/> {task.crops.name}</div>
                                      )}
                                      {groupMode === 'crop' && task.workers && (
                                        <div className="flex items-center gap-1 truncate"><Users className="w-3 h-3 text-blue-500"/> {task.workers.name}</div>
                                      )}
                                      {groupMode === 'crop' && task.fields && (
                                        <div className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 text-emerald-500"/> {task.fields.name}</div>
                                      )}
                                      {task.memo && (
                                        <div className="text-[9px] text-slate-400 truncate flex items-center gap-0.5 mt-0.5">
                                          <span>📝</span> {task.memo}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden my-8">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <h3 className="font-bold text-emerald-800 flex items-center gap-2">
                {editingTaskId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingTaskId ? 'タスクの編集' : '新規タスクの作成'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">予定日 <span className="text-rose-500">*</span></label>
                <input 
                  type="date" 
                  value={formData.work_date} 
                  onChange={e => setFormData({...formData, work_date: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">タスク内容 <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.task_title} 
                  onChange={e => setFormData({...formData, task_title: e.target.value})}
                  placeholder="例: きゅうりの収穫、A棟の誘引・葉かき"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                  <span>📝 作業指示メモ・注意事項</span>
                  <span className="text-[10px] text-slate-400 font-normal">(現場ポータルに表示されます)</span>
                </label>
                <textarea 
                  rows={2}
                  value={formData.memo || ''} 
                  onChange={e => setFormData({...formData, memo: e.target.value})}
                  placeholder="例: 午前中に収穫完了すること。傷果は別カゴへ分ける。ハウスの温度に注意。"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">対象の作目</label>
                  <select value={formData.crop_id} onChange={e => setFormData({...formData, crop_id: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                    <option value="">(指定なし)</option>
                    {crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">担当部署</label>
                  <select value={formData.department_id} onChange={e => setFormData({...formData, department_id: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                    <option value="">(全社・指定なし)</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      圃場と担当者の巡回割り当て
                    </label>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                      複数の圃場を回る場合、上から順に「巡回ステップ」として現場に案内されます
                    </p>
                  </div>
                  {!editingTaskId && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentList = formData.field_assignments || [];
                        setFormData({
                          ...formData,
                          field_assignments: [
                            ...currentList,
                            { 
                              field_id: '', 
                              worker_ids: [], 
                              step_order: currentList.length + 1,
                              time_slot: '',
                              field_memo: ''
                            }
                          ]
                        });
                      }}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
                    >
                      <Plus className="w-3.5 h-3.5" /> 次の圃場を追加
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {formData.field_assignments?.map((assignment: any, idx: number) => {
                    const stepNum = idx + 1;
                    return (
                      <div key={idx} className="bg-slate-50 p-4 rounded-2xl border-2 border-emerald-100/80 space-y-3 relative group">
                        
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={assignment.step_order || stepNum}
                              onChange={(e) => {
                                const newAssignments = [...formData.field_assignments];
                                newAssignments[idx].step_order = Number(e.target.value);
                                setFormData({ ...formData, field_assignments: newAssignments });
                              }}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded-xl text-xs font-black outline-none cursor-pointer shadow-xs hover:bg-emerald-500 transition-colors"
                              title="巡回順番を選択"
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                <option key={num} value={num} className="bg-white text-slate-800 font-bold">
                                  STEP {num}（{num}番目）
                                </option>
                              ))}
                            </select>
                            <span className="text-xs font-black text-slate-800">
                              {formData.field_assignments.length > 1 ? `第${assignment.step_order || stepNum}の圃場` : '担当圃場'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {formData.field_assignments.length > 1 && (
                              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => {
                                    if (idx === 0) return;
                                    const list = [...formData.field_assignments];
                                    const temp = list[idx - 1];
                                    list[idx - 1] = list[idx];
                                    list[idx] = temp;
                                    setFormData({ ...formData, field_assignments: list });
                                  }}
                                  className="px-1.5 py-0.5 text-xs font-bold text-slate-500 hover:text-emerald-600 disabled:opacity-30"
                                  title="順番を上へ"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === formData.field_assignments.length - 1}
                                  onClick={() => {
                                    if (idx === formData.field_assignments.length - 1) return;
                                    const list = [...formData.field_assignments];
                                    const temp = list[idx + 1];
                                    list[idx + 1] = list[idx];
                                    list[idx] = temp;
                                    setFormData({ ...formData, field_assignments: list });
                                  }}
                                  className="px-1.5 py-0.5 text-xs font-bold text-slate-500 hover:text-emerald-600 disabled:opacity-30"
                                  title="順番を下へ"
                                >
                                  ▼
                                </button>
                              </div>
                            )}

                            {!editingTaskId && formData.field_assignments.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newAssignments = formData.field_assignments.filter((_: any, i: number) => i !== idx);
                                  setFormData({ ...formData, field_assignments: newAssignments });
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="この圃場を削除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">
                              対象の圃場 <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={assignment.field_id}
                              onChange={(e) => {
                                const newAssignments = [...formData.field_assignments];
                                newAssignments[idx].field_id = e.target.value;
                                setFormData({ ...formData, field_assignments: newAssignments });
                              }}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                              <option value="">(圃場を選択 / 指定なし)</option>
                              {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">
                              移動予定の時間帯・目安
                            </label>
                            <select
                              value={assignment.time_slot || ''}
                              onChange={(e) => {
                                const newAssignments = [...formData.field_assignments];
                                newAssignments[idx].time_slot = e.target.value;
                                setFormData({ ...formData, field_assignments: newAssignments });
                              }}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                              <option value="">(指定なし)</option>
                              <option value="午前">☀️ 午前</option>
                              <option value="午後">☕ 午後</option>
                              <option value="夕方">🌙 夕方</option>
                              <option value="終日">終日</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
                            この圃場の担当者（複数選択可）
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {workers.map(w => {
                              const isSelected = assignment.worker_ids?.includes(w.id);
                              return (
                                <button
                                  key={w.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const newAssignments = [...formData.field_assignments];
                                    const currentWorkers = newAssignments[idx].worker_ids || [];
                                    if (isSelected) {
                                      newAssignments[idx].worker_ids = currentWorkers.filter((id: string) => id !== w.id);
                                    } else {
                                      newAssignments[idx].worker_ids = [...currentWorkers, w.id];
                                    }
                                    setFormData({ ...formData, field_assignments: newAssignments });
                                  }}
                                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all border ${
                                    isSelected
                                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {w.name}
                                </button>
                              );
                            })}
                            {(!workers || workers.length === 0) && (
                              <span className="text-[11px] text-slate-400">担当者が登録されていません</span>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 font-bold text-xs bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50">
                キャンセル
              </button>
              <button onClick={handleSave} disabled={isSaving} className="flex-1 py-2.5 font-bold text-xs bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 flex items-center justify-center gap-2 shadow-xs">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'タスクを一括保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
