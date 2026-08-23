"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Clock, Save, CheckCircle2, Loader2 } from 'lucide-react';

export default function HrSettingsPage() {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    default_start_time: '08:00',
    default_end_time: '17:00',
    default_rest_minutes: 60,
    auto_round_out_time: true,
    line_notification_time: '18:00'
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('company_settings')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error(error);
        } else if (data) {
          setSettingsId(data.id);
          setFormData({
            default_start_time: data.default_start_time ? data.default_start_time.substring(0, 5) : '08:00',
            default_end_time: data.default_end_time ? data.default_end_time.substring(0, 5) : '17:00',
            default_rest_minutes: data.default_rest_minutes ?? 60,
            auto_round_out_time: data.auto_round_out_time ?? true,
            line_notification_time: data.line_notification_time ? data.line_notification_time.substring(0, 5) : '18:00'
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const payload = {
        default_start_time: formData.default_start_time.length === 5 ? formData.default_start_time + ':00' : formData.default_start_time,
        default_end_time: formData.default_end_time.length === 5 ? formData.default_end_time + ':00' : formData.default_end_time,
        default_rest_minutes: formData.default_rest_minutes,
        auto_round_out_time: formData.auto_round_out_time,
        line_notification_time: formData.line_notification_time.length === 5 ? formData.line_notification_time + ':00' : formData.line_notification_time,
        updated_at: new Date().toISOString()
      };

      if (settingsId) {
        // Update existing
        const { error } = await supabase
          .from('company_settings')
          .update(payload)
          .eq('id', settingsId);
        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('company_settings')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        if (data) setSettingsId(data.id);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-800">労務・勤怠マスタ設定</h1>
        <p className="text-sm font-bold text-slate-500 mt-1">
          全従業員に適用される大元の勤怠ルールを設定します。
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 md:p-8 space-y-8">
          
          <section>
            <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Clock className="w-5 h-5 text-blue-500" /> 勤怠・労務の大元ルール
            </h2>
            <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 space-y-4">
              <p className="text-sm font-bold text-slate-500 mb-2">
                ※新しく従業員を登録する際、ここでの設定が初期値として自動適用されます。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1">デフォルト出勤予定時刻 (定時)</label>
                  <input
                    type="time"
                    name="default_start_time"
                    value={formData.default_start_time}
                    onChange={handleChange}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1">デフォルト退勤予定時刻 (定時)</label>
                  <input
                    type="time"
                    name="default_end_time"
                    value={formData.default_end_time}
                    onChange={handleChange}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1">デフォルト休憩時間 (分)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name="default_rest_minutes"
                      value={formData.default_rest_minutes}
                      onChange={handleChange}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500 text-right"
                    />
                    <span className="font-bold text-slate-500">分</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1">退勤の定時丸め設定</label>
                  <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl mt-1">
                    <input
                      type="checkbox"
                      id="auto_round_out_time"
                      checked={formData.auto_round_out_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, auto_round_out_time: e.target.checked }))}
                      className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <label htmlFor="auto_round_out_time" className="font-bold text-slate-700 cursor-pointer text-sm">
                      定時以降の打刻を自動で残業としない
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Clock className="w-5 h-5 text-emerald-500" /> LINE通知設定
            </h2>
            <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 space-y-4">
              <p className="text-sm font-bold text-slate-500 mb-2">
                出勤したまま退勤を忘れている従業員に対して、自動でLINE通知（アラート）を送る時間を設定します。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1">退勤忘れ通知の送信時間</label>
                  <input
                    type="time"
                    name="line_notification_time"
                    value={formData.line_notification_time}
                    onChange={handleChange}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* フッターアクション */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {saveSuccess && (
              <span className="flex items-center gap-2 text-emerald-600 font-bold animate-in fade-in">
                <CheckCircle2 className="w-5 h-5" /> 保存しました
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {isSaving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Save className="w-5 h-5" />
            )}
            設定を保存する
          </button>
        </div>
      </form>
    </div>
  );
}
