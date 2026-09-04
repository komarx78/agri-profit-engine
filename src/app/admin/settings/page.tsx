"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { Settings, Save, CheckCircle2, Building, MapPin, Phone, FileText, Landmark, Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';
import { getAttendancePeriod } from '@/lib/dateUtils';

export default function SettingsPage() {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    postal_code: '',
    address: '',
    phone: '',
    invoice_number: '',
    bank_info: '',
  });

  const [closingDay, setClosingDay] = useState<number>(0);
  const [paymentDayRule, setPaymentDayRule] = useState<string>('翌月25日払い');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const tenantId = await getCurrentTenantId();
        if (!tenantId) {
          setIsLoading(false);
          return;
        }

        // LocalStorage からキャッシュ読み込み
        if (typeof window !== 'undefined') {
          const localClosing = (tenantId ? localStorage.getItem(`agri_attendance_closing_day_${tenantId}`) : null) || localStorage.getItem('agri_attendance_closing_day');
          if (localClosing !== null && localClosing !== undefined) {
            setClosingDay(Number(localClosing));
          }
          const localPayment = (tenantId ? localStorage.getItem(`agri_payment_day_rule_${tenantId}`) : null) || localStorage.getItem('agri_payment_day_rule');
          if (localPayment) {
            setPaymentDayRule(localPayment);
          }
        }

        const { data, error } = await supabase
          .from('company_settings')
          .select('*')
          .or(`user_id.eq.${tenantId},id.eq.${tenantId}`)
          .maybeSingle();

        if (data) {
          setSettingsId(data.id);
          setFormData({
            company_name: data.company_name || '',
            postal_code: data.postal_code || '',
            address: data.address || '',
            phone: data.phone || '',
            invoice_number: data.invoice_number || '',
            bank_info: data.bank_info || '',
          });
          if (data.attendance_closing_day !== undefined && data.attendance_closing_day !== null) {
            setClosingDay(Number(data.attendance_closing_day));
          }
          if (data.payment_day_rule) {
            setPaymentDayRule(data.payment_day_rule);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('テナントIDが特定できません');

      const dataToSave = {
        company_name: formData.company_name || '',
        postal_code: formData.postal_code || '',
        address: formData.address || '',
        phone: formData.phone || '',
        invoice_number: formData.invoice_number || '',
        bank_info: formData.bank_info || '',
        user_id: tenantId,
        updated_at: new Date().toISOString()
      };

      if (settingsId) {
        const { error } = await supabase
          .from('company_settings')
          .update(dataToSave)
          .eq('id', settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert([dataToSave])
          .select()
          .single();
        if (error) throw error;
        if (data) setSettingsId(data.id);
      }

      if (typeof window !== 'undefined' && formData.company_name) {
        localStorage.setItem(`agri_company_${tenantId}`, formData.company_name);
        localStorage.removeItem('agri_cached_company_name');
      }

      setSaveSuccess(true);
      alert('自社情報を正常に保存しました！');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      alert(`保存に失敗しました: ${err.message || '予期せぬエラー'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>;
  }

  return (
    <AdminOnlyGuard>
      <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <Settings className="w-8 h-8 text-slate-600" />
          自社情報・請求設定
        </h1>
        <p className="text-slate-500 mt-2 font-medium">
          ここで設定した情報は、請求書の自動発行時にヘッダーや振込先として印字されます。
        </p>
      </div>

      {/* 全社勤怠締日 ＆ 給与支払日 連動カード */}
      <div className="bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-slate-50 p-5 rounded-2xl border border-indigo-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-600 text-white rounded-lg">
              <Calendar className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-black text-slate-800">
              全社勤怠締日 ＆ 給与支払日設定
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-bold pl-8">
            月次タイムカード・作業台帳・給与計算の全社集計サイクル
          </p>
          <div className="flex flex-wrap items-center gap-2 pl-8 pt-1">
            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-md font-black text-xs">
              {closingDay === 0 ? '末日締め' : `${closingDay}日締め`}
            </span>
            <span className="text-xs font-bold text-slate-500">
              ({(() => {
                const now = new Date();
                const p = getAttendancePeriod(now.getFullYear(), now.getMonth() + 1, closingDay);
                return p.label;
              })()})
            </span>
            <span className="text-slate-300">|</span>
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-black text-xs">
              {paymentDayRule}
            </span>
          </div>
        </div>

        <Link
          href="/hr/settings"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl font-black text-xs shadow-2xs hover:shadow-xs transition-all shrink-0 self-start sm:self-center"
        >
          <span>締日・労務設定を変更</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 md:p-8 space-y-8">
          
          {/* 基本情報 */}
          <section>
            <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Building className="w-5 h-5 text-emerald-500" /> 基本情報
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">農園名 / 会社名 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  required
                  placeholder="例: ココット農園"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1 flex items-center gap-1"><MapPin className="w-4 h-4"/> 郵便番号</label>
                  <input
                    type="text"
                    name="postal_code"
                    value={formData.postal_code}
                    onChange={handleChange}
                    placeholder="例: 123-4567"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1 flex items-center gap-1"><Phone className="w-4 h-4"/> 電話番号</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="例: 090-1234-5678"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">住所</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="例: 京都府京都市〇〇町1-2-3"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </section>

          {/* 請求関連 */}
          <section>
            <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileText className="w-5 h-5 text-blue-500" /> 請求・インボイス情報
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">適格請求書発行事業者登録番号（インボイス）</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 font-bold">T</div>
                  <input
                    type="text"
                    name="invoice_number"
                    value={formData.invoice_number}
                    onChange={handleChange}
                    placeholder="1234567890123"
                    className="w-full pl-8 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500 tracking-wider"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 口座情報 */}
          <section>
            <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Landmark className="w-5 h-5 text-amber-500" /> 振込先口座情報
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">振込先口座の記載内容</label>
                <textarea
                  name="bank_info"
                  value={formData.bank_info}
                  onChange={handleChange}
                  rows={4}
                  placeholder="例: 〇〇銀行 〇〇支店&#13;&#10;普通 1234567&#13;&#10;カ）ココット"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-amber-500 leading-relaxed"
                />
                <p className="text-xs text-slate-400 mt-2">※請求書の右下にそのまま印字されます。</p>
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
            disabled={isSaving || !formData.company_name}
            className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
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
    </AdminOnlyGuard>
  );
}
