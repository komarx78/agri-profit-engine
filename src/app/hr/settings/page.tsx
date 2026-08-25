"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { Clock, Save, CheckCircle2, Loader2, Plus, Trash2, ShieldCheck, Sparkles, Check } from 'lucide-react';
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';

interface AttendanceRuleItem {
  id?: string;
  name: string;
  start_time: string;
  end_time: string;
  rest_minutes: number;
  auto_round_out_time: boolean;
  is_default: boolean;
}

export default function HrSettingsPage() {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [lineNotificationTime, setLineNotificationTime] = useState('17:30');
  
  // 複数勤怠ルール
  const [rules, setRules] = useState<AttendanceRuleItem[]>([]);
  const [deletedRuleIds, setDeletedRuleIds] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function fetchSettingsAndRules() {
      try {
        const tenantId = await getCurrentTenantId();
        if (!tenantId) {
          setIsLoading(false);
          return;
        }

        // 1. company_settings の取得
        const { data: compData } = await supabase
          .from('company_settings')
          .select('*')
          .eq('user_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (compData) {
          setSettingsId(compData.id);
          if (compData.line_notification_time) {
            setLineNotificationTime(compData.line_notification_time.substring(0, 5));
          }
        }

        // 2. attendance_rules の取得
        try {
          const { data: rulesData, error: rulesError } = await supabase
            .from('attendance_rules')
            .select('*')
            .eq('user_id', tenantId)
            .order('created_at', { ascending: true });

          if (!rulesError && rulesData && rulesData.length > 0) {
            setRules(rulesData.map(r => ({
              id: r.id,
              name: r.name,
              start_time: r.start_time ? r.start_time.substring(0, 5) : '08:00',
              end_time: r.end_time ? r.end_time.substring(0, 5) : '17:00',
              rest_minutes: r.rest_minutes ?? 60,
              auto_round_out_time: r.auto_round_out_time ?? true,
              is_default: r.is_default ?? false
            })));
          } else {
            // ルールが存在しない場合の初期ルール1
            setRules([{
              name: 'ルール1 (通常勤務)',
              start_time: compData?.default_start_time ? compData.default_start_time.substring(0, 5) : '08:00',
              end_time: compData?.default_end_time ? compData.default_end_time.substring(0, 5) : '17:00',
              rest_minutes: compData?.default_rest_minutes ?? 60,
              auto_round_out_time: compData?.auto_round_out_time ?? true,
              is_default: true
            }]);
          }
        } catch (e) {
          console.warn('attendance_rules fetch error:', e);
          // フォールバック
          setRules([{
            name: 'ルール1 (通常勤務)',
            start_time: compData?.default_start_time ? compData.default_start_time.substring(0, 5) : '08:00',
            end_time: compData?.default_end_time ? compData.default_end_time.substring(0, 5) : '17:00',
            rest_minutes: compData?.default_rest_minutes ?? 60,
            auto_round_out_time: compData?.auto_round_out_time ?? true,
            is_default: true
          }]);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettingsAndRules();
  }, []);

  // ルール項目の変更
  const handleRuleChange = (index: number, field: keyof AttendanceRuleItem, value: any) => {
    setRules(prev => {
      const updated = [...prev];
      if (field === 'is_default' && value === true) {
        // デフォルトは1つだけにする
        return updated.map((r, i) => ({
          ...r,
          is_default: i === index
        }));
      }
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // 新規ルールの追加
  const handleAddRule = () => {
    const newRuleNumber = rules.length + 1;
    const isFirst = rules.length === 0;
    const newRule: AttendanceRuleItem = {
      name: `ルール${newRuleNumber}`,
      start_time: '08:00',
      end_time: '17:00',
      rest_minutes: 60,
      auto_round_out_time: true,
      is_default: isFirst
    };
    setRules(prev => [...prev, newRule]);
  };

  // ルールの削除
  const handleDeleteRule = (index: number) => {
    if (rules.length <= 1) {
      alert('勤怠ルールは最低1つ必要です。');
      return;
    }
    const target = rules[index];
    if (target.id) {
      setDeletedRuleIds(prev => [...prev, target.id!]);
    }
    const filtered = rules.filter((_, i) => i !== index);
    // もしデフォルトのルールを削除した場合は最初のルールをデフォルトにする
    if (target.is_default && filtered.length > 0) {
      filtered[0].is_default = true;
    }
    setRules(filtered);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('テナントIDが特定できません');

      if (rules.length === 0) {
        throw new Error('勤怠ルールを1つ以上登録してください');
      }

      // デフォルトルールの特定
      const defaultRule = rules.find(r => r.is_default) || rules[0];

      // 1. company_settings を更新
      const compPayload = {
        user_id: tenantId,
        default_start_time: defaultRule.start_time.length === 5 ? defaultRule.start_time + ':00' : defaultRule.start_time,
        default_end_time: defaultRule.end_time.length === 5 ? defaultRule.end_time + ':00' : defaultRule.end_time,
        default_rest_minutes: defaultRule.rest_minutes,
        auto_round_out_time: defaultRule.auto_round_out_time,
        line_notification_time: lineNotificationTime.length === 5 ? lineNotificationTime + ':00' : lineNotificationTime,
        updated_at: new Date().toISOString()
      };

      if (settingsId) {
        await supabase.from('company_settings').update(compPayload).eq('id', settingsId);
      } else {
        const { data: newComp } = await supabase.from('company_settings').insert([compPayload]).select().single();
        if (newComp) setSettingsId(newComp.id);
      }

      // 2. attendance_rules テーブルの削除レコード処理
      if (deletedRuleIds.length > 0) {
        await supabase.from('attendance_rules').delete().in('id', deletedRuleIds);
        setDeletedRuleIds([]);
      }

      // 3. attendance_rules テーブルの各ルールをUpsert
      const updatedRules: AttendanceRuleItem[] = [];
      for (const r of rules) {
        const rulePayload: any = {
          user_id: tenantId,
          name: r.name,
          start_time: r.start_time.length === 5 ? r.start_time + ':00' : r.start_time,
          end_time: r.end_time.length === 5 ? r.end_time + ':00' : r.end_time,
          rest_minutes: r.rest_minutes,
          auto_round_out_time: r.auto_round_out_time,
          is_default: r.is_default,
          updated_at: new Date().toISOString()
        };

        if (r.id) {
          const { data: uData, error: uErr } = await supabase
            .from('attendance_rules')
            .update(rulePayload)
            .eq('id', r.id)
            .select()
            .single();
          if (!uErr && uData) {
            updatedRules.push({
              id: uData.id,
              name: uData.name,
              start_time: uData.start_time.substring(0, 5),
              end_time: uData.end_time.substring(0, 5),
              rest_minutes: uData.rest_minutes,
              auto_round_out_time: uData.auto_round_out_time,
              is_default: uData.is_default
            });
          } else {
            updatedRules.push(r);
          }
        } else {
          const { data: iData, error: iErr } = await supabase
            .from('attendance_rules')
            .insert([rulePayload])
            .select()
            .single();
          if (!iErr && iData) {
            updatedRules.push({
              id: iData.id,
              name: iData.name,
              start_time: iData.start_time.substring(0, 5),
              end_time: iData.end_time.substring(0, 5),
              rest_minutes: iData.rest_minutes,
              auto_round_out_time: iData.auto_round_out_time,
              is_default: iData.is_default
            });
          } else {
            updatedRules.push(r);
          }
        }
      }

      setRules(updatedRules);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      alert('保存に失敗しました: ' + (err.message || '通信エラー'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  return (
    <AdminOnlyGuard>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">労務・勤怠マスタ設定</h1>
            <p className="text-sm font-bold text-slate-500 mt-1">
              従業員ごとに適用する勤怠ルール（定時・休憩・丸め）を複数作成・管理します。
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddRule}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>＋ 新規勤怠ルールを追加</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* 勤怠ルール一覧セクション */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span>勤怠ルール一覧 ({rules.length}パターン)</span>
              </h2>
              <span className="text-xs font-bold text-slate-400">
                ※従業員マスタで各スタッフに割り当てることができます
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {rules.map((rule, idx) => (
                <div 
                  key={rule.id || `temp-${idx}`}
                  className={`bg-white rounded-2xl p-6 shadow-sm border transition-all ${
                    rule.is_default ? 'border-blue-300 ring-2 ring-blue-500/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 max-w-md">
                        <input
                          type="text"
                          value={rule.name}
                          onChange={(e) => handleRuleChange(idx, 'name', e.target.value)}
                          placeholder="ルール名 (例: ルール1 / 通常フルタイム / 午前パート)"
                          className="w-full text-base font-black text-slate-800 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        rule.is_default ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}>
                        <input
                          type="radio"
                          name="default_rule_radio"
                          checked={rule.is_default}
                          onChange={() => handleRuleChange(idx, 'is_default', true)}
                          className="hidden"
                        />
                        <Check className="w-3.5 h-3.5" />
                        <span>{rule.is_default ? '★ 新規登録時のデフォルト' : 'デフォルトに設定'}</span>
                      </label>

                      {rules.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(idx)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          title="このルールを削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">出勤予定時刻 (定時)</label>
                      <input
                        type="time"
                        value={rule.start_time}
                        onChange={(e) => handleRuleChange(idx, 'start_time', e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">退勤予定時刻 (定時)</label>
                      <input
                        type="time"
                        value={rule.end_time}
                        onChange={(e) => handleRuleChange(idx, 'end_time', e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">所定休憩時間 (分)</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="480"
                          value={rule.rest_minutes}
                          onChange={(e) => handleRuleChange(idx, 'rest_minutes', parseInt(e.target.value) || 0)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white text-right"
                          required
                        />
                        <span className="text-xs font-bold text-slate-500">分</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">退勤の定時丸め設定</label>
                      <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={rule.auto_round_out_time}
                          onChange={(e) => handleRuleChange(idx, 'auto_round_out_time', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold text-slate-700 select-none">
                          定時以降を自動で残業としない
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* LINE通知設定セクション */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-base font-black text-slate-800 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              <span>LINE通知設定</span>
            </h2>
            <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100 space-y-3">
              <p className="text-xs font-bold text-slate-600">
                出勤したまま退勤を忘れている従業員に対して、自動でLINE通知（アラート）を送る時間を設定します。
              </p>
              <div className="max-w-xs">
                <label className="block text-xs font-bold text-slate-500 mb-1">退勤忘れ通知の送信時間</label>
                <input
                  type="time"
                  value={lineNotificationTime}
                  onChange={(e) => setLineNotificationTime(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* フッター保存ボタン */}
          <div className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm">
            <div>
              {saveSuccess && (
                <span className="flex items-center gap-2 text-emerald-600 font-black text-sm animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5" /> 全勤怠ルールの設定を保存しました！
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-8 py-3 rounded-xl font-black text-sm flex items-center gap-2 transition-all disabled:opacity-50 shadow-md"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>全設定を保存する</span>
            </button>
          </div>

        </form>
      </div>
    </AdminOnlyGuard>
  );
}
