"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { Settings, Save, CheckCircle2, Building, MapPin, Phone, FileText, Landmark, Calendar, ArrowRight, QrCode, Copy, Smartphone, Printer } from 'lucide-react';
import Link from 'next/link';
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';
import { getAttendancePeriod } from '@/lib/dateUtils';
import { FarmPosterModal } from '@/components/FarmPosterModal';

export default function SettingsPage() {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [currentTenant, setCurrentTenant] = useState<string>('');
  const [formData, setFormData] = useState({
    company_name: '',
    postal_code: '',
    address: '',
    phone: '',
    invoice_number: '',
    bank_info: '',
    farm_code: '',
  });

  const [closingDay, setClosingDay] = useState<number>(0);
  const [paymentDayRule, setPaymentDayRule] = useState<string>('翌月25日払い');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPosterModalOpen, setIsPosterModalOpen] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const tenantId = await getCurrentTenantId();
        if (!tenantId) {
          setIsLoading(false);
          return;
        }
        setCurrentTenant(tenantId);

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
          let resolvedCode = data.farm_code || '';
          if (!resolvedCode) {
            if (tenantId === '62163024-2c8e-4057-a872-2455dbc58d32') resolvedCode = 'sahara';
            else if (tenantId === '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04') resolvedCode = 'kap';
            else {
              const prefix = (data.company_name || 'farm').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'farm';
              resolvedCode = `${prefix}`;
            }
          }
          setFormData({
            company_name: data.company_name || '',
            postal_code: data.postal_code || '',
            address: data.address || '',
            phone: data.phone || '',
            invoice_number: data.invoice_number || '',
            bank_info: data.bank_info || '',
            farm_code: resolvedCode,
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

      const cleanFarmCode = (formData.farm_code || '').trim().toLowerCase().replace(/\s+/g, '');

      // 🛡️ 司馬懿防壁：全国重複チェック（他社との農園コード衝突を物理遮断）
      if (cleanFarmCode) {
        const { data: duplicate } = await supabase
          .from('company_settings')
          .select('id, user_id, company_name')
          .ilike('farm_code', cleanFarmCode)
          .neq('user_id', tenantId)
          .maybeSingle();

        if (duplicate) {
          throw new Error(`農園コード「${cleanFarmCode.toUpperCase()}」は既に別の農園様（${duplicate.company_name || '他社'}）で使用されています。\n末尾の番号を変更（例: ${cleanFarmCode}-2 または数字を変更）して再度お試しください。`);
        }
      }

      const dataToSave: any = {
        company_name: formData.company_name || '',
        postal_code: formData.postal_code || '',
        address: formData.address || '',
        phone: formData.phone || '',
        invoice_number: formData.invoice_number || '',
        bank_info: formData.bank_info || '',
        farm_code: cleanFarmCode || null,
        attendance_closing_day: closingDay,
        payment_day_rule: paymentDayRule,
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

      if (typeof window !== 'undefined') {
        if (formData.company_name) {
          localStorage.setItem(`agri_company_${tenantId}`, formData.company_name);
          localStorage.removeItem('agri_cached_company_name');
        }
        localStorage.setItem(`agri_attendance_closing_day_${tenantId}`, String(closingDay));
        localStorage.setItem('agri_attendance_closing_day', String(closingDay));
        localStorage.setItem(`agri_payment_day_rule_${tenantId}`, paymentDayRule);
        localStorage.setItem('agri_payment_day_rule', paymentDayRule);
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

  const resolveSafeFarmCode = (code?: string): string => {
    if (code && code.trim()) return code.trim();
    if (currentTenant === '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04') return 'kap';
    if (currentTenant === '62163024-2c8e-4057-a872-2455dbc58d32') return 'sahara';
    return currentTenant ? currentTenant.substring(0, 8) : '';
  };

  return (
    <AdminOnlyGuard>
      {isLoading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <Settings className="w-8 h-8 text-slate-600" />
          自社情報・請求設定
        </h1>
        <p className="text-slate-500 mt-2 font-medium">
          ここで設定した情報は、請求書の自動発行時にヘッダーや振込先として印字されます。
        </p>
      </div>

      {/* 🌟 最上部ハイライト：貴社の農園コード ＆ A4ポスター即時印刷 */}
      <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 text-white p-5 md:p-6 rounded-3xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-emerald-500/30">
        <div>
          <div className="flex items-center gap-2 text-emerald-200 text-xs font-bold uppercase tracking-wider mb-1">
            <Smartphone className="w-4 h-4 text-emerald-300" />
            現場スマホアプリ・ポータル接続用
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm md:text-base font-bold text-emerald-100">貴社の農園コード:</span>
            <span className="text-2xl md:text-3xl font-mono font-black tracking-widest bg-white/20 px-3.5 py-1 rounded-xl border border-white/30 text-white select-all">
              {resolveSafeFarmCode(formData.farm_code).toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-emerald-200 mt-1 font-medium">
            ※現場スタッフがスマホアプリを起動した際、このコードを入力すると貴社専用画面に接続されます。
          </p>
        </div>
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={() => {
              const code = resolveSafeFarmCode(formData.farm_code).toUpperCase();
              navigator.clipboard.writeText(code);
              alert(`農園コード「${code}」をコピーしました！`);
            }}
            className="flex-1 md:flex-initial px-4 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <Copy className="w-4 h-4 text-emerald-600" />
            コードをコピー
          </button>
          <button
            type="button"
            onClick={() => setIsPosterModalOpen(true)}
            className="flex-1 md:flex-initial px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-400/40 rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-300" />
            A4ポスター印刷
          </button>
        </div>
      </div>

      {/* 📱 現場スタッフ案内・QRコード発行（SaaSハイブリッド対応） */}
      {currentTenant && (
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-slate-700">
          <div className="flex items-center justify-between gap-4 mb-2">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-400" />
              現場スタッフ用 打刻ポータル・案内QRコード
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
              SaaSハイブリッド対応
            </span>
          </div>
          <p className="text-xs text-slate-300 mb-6 leading-relaxed">
            貴社の現場スタッフが他社と混ざらず安全に打刻できるよう、3つの案内方法（現場QR掲示・公式LINE連携・専用アプリ）をご用意しております。現場の運用形態に合わせてお選びいただけます。
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* 方式①: 現場掲示用QRコード (LINE不要) */}
            <div className="bg-slate-800/90 p-5 rounded-2xl border border-slate-700 flex flex-col justify-between shadow-sm">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-black mb-3">
                  <QrCode className="w-3.5 h-3.5 shrink-0" />
                  <span>方式①：現場掲示用QR（LINE不要）</span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">タイムカード置き場・現場の壁に掲示</h3>
                <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                  スタッフはスマホのカメラでQRコードを読み取るだけで、貴社専用の打刻画面へ直行します。他社の名前や変更ボタンは一切出ません。
                </p>
                <div className="flex justify-center mb-3">
                  <div className="bg-white p-3 rounded-2xl shadow-md text-center">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://agri-profit-engine.vercel.app/portal/${currentTenant}?openExternalBrowser=1`)}`}
                      alt="専用ポータルQRコード"
                      className="w-32 h-32 mx-auto"
                    />
                    <span className="text-[10px] font-black text-slate-600 block mt-1.5 whitespace-nowrap">印刷して現場に掲示</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-slate-700/60">
                <div className="text-[11px] text-slate-400 font-mono truncate bg-slate-950/60 px-3 py-2 rounded-lg">
                  {`https://agri-profit-engine.vercel.app/portal/${currentTenant}`}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://agri-profit-engine.vercel.app/portal/${currentTenant}?openExternalBrowser=1`);
                    alert('貴社専用ポータルのURLをコピーしました！');
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 shadow-sm whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  <span>専用URLをコピー</span>
                </button>
              </div>
            </div>

            {/* 方式②: LINE公式アカウント連携 (退勤忘れ通知・個人連携) */}
            <div className="bg-slate-800/90 p-5 rounded-2xl border border-slate-700 flex flex-col justify-between shadow-sm">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-xs font-black mb-3">
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span>方式②：公式LINE連携（通知・打刻）</span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">スタッフ個人のLINEと連携</h3>
                <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                  公式LINEを友だち追加し、スタッフ名簿で発行される【4桁の連携コード】を送信すると、退勤忘れ通知や業務連絡がLINEに届きます。
                </p>
                <div className="flex justify-center mb-3">
                  <div className="bg-white p-3 rounded-2xl shadow-md text-center">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent('https://lin.ee/RD1vp8c')}`}
                      alt="公式LINE友だち追加QRコード"
                      className="w-32 h-32 mx-auto"
                    />
                    <span className="text-[10px] font-black text-slate-600 block mt-1.5 whitespace-nowrap">公式LINEを友だち追加</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-slate-700/60">
                <div className="text-[11px] text-slate-400 font-mono bg-slate-950/60 px-3 py-2 rounded-lg flex items-center justify-between gap-2">
                  <span className="truncate">公式ID: @543tdbfc</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('https://lin.ee/RD1vp8c');
                      alert('公式LINE（@543tdbfc）の友だち追加URLをコピーしました！');
                    }}
                    className="text-blue-400 hover:text-blue-300 font-sans font-bold text-[10px] underline cursor-pointer shrink-0"
                  >
                    URLコピー
                  </button>
                </div>
                <Link
                  href="/hr"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 shadow-sm whitespace-nowrap"
                >
                  <span>スタッフ別の連携コード確認</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </Link>
              </div>
            </div>

            {/* 方式③: 現場スマホアプリ（Android / iOS）初期接続コード */}
            <div className="bg-slate-800/90 p-5 rounded-2xl border border-slate-700 flex flex-col justify-between shadow-sm">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-xs font-black mb-3">
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span>方式③：現場専用アプリ（iOS/Android）</span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">スマホアプリの初回起動時に入力</h3>
                <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                  スタッフがアプリを初めて起動した際、下記の【農園コード】を入力すると、一瞬で貴社専用の打刻画面に接続・永続保存されます。
                </p>
                <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-1.5 mb-3 text-center">
                  <span className="text-[11px] text-slate-400 font-bold block">貴社の農園コード</span>
                  <div className="text-3xl font-mono font-black text-amber-300 tracking-widest uppercase py-1">
                    {resolveSafeFarmCode(formData.farm_code)}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium block">※大文字・小文字どちらでも可</span>
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => {
                    const code = resolveSafeFarmCode(formData.farm_code);
                    navigator.clipboard.writeText(code);
                    alert(`農園コード「${code}」をコピーしました！現場スタッフにご案内ください。`);
                  }}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 shadow-sm whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  <span>農園コードをコピー</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPosterModalOpen(true)}
                  className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-amber-200 border border-amber-400/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 shadow-sm whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>A4現場掲示用ポスター印刷</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 全社勤怠締日 ＆ 給与支払日 連動カード */}
      <div className="bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-slate-50 p-5 rounded-2xl border border-indigo-100 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-600 text-white rounded-lg">
              <Calendar className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-black text-slate-800">
              全社勤怠締日 ＆ 給与支払日設定
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-bold pl-8">
            月次タイムカード・作業台帳・パート代計算の全社集計サイクル（変更後は画面下の「設定を保存する」を押してください）
          </p>
          <div className="flex flex-wrap items-center gap-3 pl-8 pt-1">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-slate-600">締日：</label>
              <select
                value={closingDay}
                onChange={(e) => setClosingDay(Number(e.target.value))}
                className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-900 rounded-lg font-black text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={0}>末日締め</option>
                <option value={25}>毎月25日締め</option>
                <option value={20}>毎月20日締め</option>
                <option value={15}>毎月15日締め</option>
                <option value={10}>毎月10日締め</option>
              </select>
            </div>
            <span className="text-xs font-bold text-slate-500">
              ({(() => {
                const now = new Date();
                const p = getAttendancePeriod(now.getFullYear(), now.getMonth() + 1, closingDay);
                return p.label;
              })()})
            </span>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-slate-600">支払日：</label>
              <select
                value={paymentDayRule}
                onChange={(e) => setPaymentDayRule(e.target.value)}
                className="px-2.5 py-1 bg-white border border-emerald-200 text-emerald-900 rounded-lg font-black text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="翌月25日払い">翌月25日払い</option>
                <option value="翌月末払い">翌月末払い</option>
                <option value="翌月15日払い">翌月15日払い</option>
                <option value="翌月10日払い">翌月10日払い</option>
                <option value="当月末払い">当月末払い</option>
              </select>
            </div>
          </div>
        </div>

        <Link
          href="/hr"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl font-black text-xs shadow-2xs hover:shadow-xs transition-all shrink-0 self-start lg:self-center"
        >
          <span>出勤簿・パート代画面へ</span>
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
              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-amber-900">
                    <Smartphone className="w-4 h-4 text-amber-600" />
                    現場スマホアプリ用 農園コード
                  </span>
                  <span className="text-[11px] text-amber-700 font-bold">半角英数字・ハイフン</span>
                </label>
                <input
                  type="text"
                  name="farm_code"
                  value={formData.farm_code}
                  onChange={handleChange}
                  placeholder="例: sahara"
                  className="w-full p-3 bg-white border-2 border-amber-300 rounded-xl font-mono font-black text-amber-900 tracking-wider uppercase focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  ※現場スタッフがスマホアプリ（Android / iOS）を初めて開いた際、このコードを入力すると貴社の現場に接続されます。お好きなコードに変更可能です。
                </p>
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

      {/* A4現場掲示用ポスター印刷モーダル */}
      <FarmPosterModal
        isOpen={isPosterModalOpen}
        onClose={() => setIsPosterModalOpen(false)}
        farmCode={resolveSafeFarmCode(formData.farm_code)}
        companyName={formData.company_name || '当農園'}
        tenantId={currentTenant}
      />
      </div>
      )}
    </AdminOnlyGuard>
  );
}
