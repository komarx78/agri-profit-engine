"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Save, CheckCircle2, Building, MapPin, Phone, FileText, Landmark } from 'lucide-react';

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
            company_name: data.company_name || '',
            postal_code: data.postal_code || '',
            address: data.address || '',
            phone: data.phone || '',
            invoice_number: data.invoice_number || '',
            bank_info: data.bank_info || '',
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const payload = {
        ...formData,
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
      alert('保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>;
  }

  return (
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
  );
}
