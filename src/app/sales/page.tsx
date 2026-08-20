"use client";

import React, { useState, useEffect } from 'react';
import { Truck, Sprout, Store, CheckCircle2, AlertCircle, FileDigit, Calculator, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { t, getTranslatedName, LANGUAGES, LanguageCode } from '@/lib/i18n';
import { getSalesMasters, submitSalesLog } from '@/app/actions/farm';

export default function SalesEntryPage() {
  const [crops, setCrops] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [salesPrices, setSalesPrices] = useState<any[]>([]);
  
  const [selectedCrop, setSelectedCrop] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [manualPrice, setManualPrice] = useState<string>('');
  const [salesDate, setSalesDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [language, setLanguage] = useState<LanguageCode>('ja');
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    async function fetchData() {
      try {
        // tenant_id を localStorage から取得し、言語設定をロード
        let loadedLang = 'ja' as LanguageCode;
        
        // まず共通キーを探す
        const savedGlobalLang = localStorage.getItem('agri_lang_sales') as LanguageCode;
        if (savedGlobalLang && LANGUAGES.some(l => l.code === savedGlobalLang)) {
            loadedLang = savedGlobalLang;
        } else {
            // なければ他のキーを探す
            const tenantIds = Object.keys(localStorage).filter(k => k.startsWith('agri_lang_')).map(k => k.replace('agri_lang_', ''));
            const tenantId = tenantIds.length > 0 ? tenantIds[0] : null;
            if (tenantId) {
              const savedLang = localStorage.getItem(`agri_lang_${tenantId}`) as LanguageCode;
              if (savedLang && LANGUAGES.some(l => l.code === savedLang)) {
                loadedLang = savedLang;
              }
            }
        }
        setLanguage(loadedLang);

        const activeTenantId = localStorage.getItem('agri_current_tenant');
        if (activeTenantId) {
          const res = await getSalesMasters(activeTenantId);
          if (res.success) {
            setCrops(res.crops || []);
            setChannels(res.channels || []);
            setSalesPrices(res.salesPrices || []);
            setIsConnected(true);
          }
        } else {
          // Fallback if no tenant is set (should not happen in normal workflow now)
          const [cRes, chRes, spRes] = await Promise.all([
            supabase.from('crops').select('*'),
            supabase.from('sales_channels').select('*'),
            supabase.from('sales_prices').select('*')
          ]);
          if (cRes.data) setCrops(cRes.data);
          if (chRes.data) setChannels(chRes.data);
          if (spRes.data) setSalesPrices(spRes.data);
          if (!cRes.error) setIsConnected(true);
        }
      } catch (err) {
        console.log('Error fetching data', err);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    const currentPriceObj = salesPrices.find(
      sp => sp.crop_name === selectedCrop && sp.channel_name === selectedChannel
    );
    if (currentPriceObj) {
      setManualPrice(String(currentPriceObj.price_per_unit));
    } else {
      setManualPrice('');
    }
  }, [selectedCrop, selectedChannel, salesPrices]);

  // 手動入力された単価で計算
  const parsedPrice = parseFloat(manualPrice) || 0;
  const calculatedTotal = quantity && parsedPrice ? parseFloat(quantity) * parsedPrice : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isConnected) {
        let cropId = crops.find(c => c.name === selectedCrop)?.id;
        let channelId = channels.find(c => c.name === selectedChannel)?.id;

        const activeTenantId = localStorage.getItem('agri_current_tenant');

        if (activeTenantId) {
          // Use Server Action if tenant is known
          const logData = {
            crop_id: cropId || null,
            channel_id: channelId || null,
            sales_date: salesDate,
            quantity: parseFloat(quantity) || 0,
            unit: 'kg/箱',
            total_sales: calculatedTotal > 0 ? calculatedTotal : null,
            status: 'completed'
          };
          const res = await submitSalesLog(activeTenantId, logData);
          if (!res.success) throw new Error(res.error);
        } else {
          // Fallback
          if (!cropId && selectedCrop) {
            const { data: newCrop, error: cropErr } = await supabase.from('crops').insert([{ name: selectedCrop }]).select('id').single();
            if (!cropErr && newCrop) cropId = newCrop.id;
          }
          if (!channelId && selectedChannel) {
            const { data: newChannel, error: channelErr } = await supabase.from('sales_channels').insert([{ name: selectedChannel }]).select('id').single();
            if (!channelErr && newChannel) channelId = newChannel.id;
          }

          const { error } = await supabase.from('sales_logs').insert([
            {
              crop_id: cropId || null,
              channel_id: channelId || null,
              sales_date: salesDate,
              quantity: parseFloat(quantity) || 0,
              unit: 'kg/箱',
              total_sales: calculatedTotal > 0 ? calculatedTotal : null,
              status: 'completed'
            }
          ]);
          if (error) throw error;
        }
      } else {
        await new Promise(r => setTimeout(r, 800));
      }

      setIsSubmitting(false);
      setIsSuccess(true);
      
      setTimeout(() => {
        setIsSuccess(false);
        setSelectedCrop('');
        setSelectedChannel('');
        setQuantity('');
        setManualPrice('');
        setSalesDate(new Date().toISOString().split('T')[0]);
      }, 2500);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-slate-950/80 border-b border-amber-900/50 px-4 py-4 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-orange-400 rounded-xl shadow-md text-amber-950">
              <Truck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                {t('salesRecord', language)}
              </h1>
              <p className="text-xs font-medium text-amber-300/80">{t('autoCalcDesc', language)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={language}
              onChange={e => {
                const newLang = e.target.value as LanguageCode;
                setLanguage(newLang);
                
                // 確実に保存するため共通キーにセット
                localStorage.setItem('agri_lang_sales', newLang);
                
                // すべての agri_lang_ キーを更新する（どの農園の画面でも反映されるように）
                const langKeys = Object.keys(localStorage).filter(k => k.startsWith('agri_lang_'));
                langKeys.forEach(key => localStorage.setItem(key, newLang));
              }}
              className="bg-amber-900/50 text-white text-xs font-bold rounded-lg px-2 py-1 focus:outline-none"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.flag} {l.code.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-6">
        {isSuccess ? (
          <div className="my-12 p-8 bg-gradient-to-b from-amber-900/90 to-orange-950/90 rounded-3xl border border-amber-500/40 shadow-2xl text-center flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center border border-amber-400/40 shadow-inner">
              <CheckCircle2 className="w-12 h-12 text-amber-400" />
            </div>
            <h2 className="text-2xl font-black text-white">{t('salesCompleted', language)}</h2>
            <p className="text-sm text-amber-200">{t('salesAutoCalculated', language)}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 0. 日付選択 */}
            <section className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/60 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2.5 flex items-center gap-2">
                日付
              </h2>
              <input
                type="date"
                value={salesDate}
                onChange={(e) => setSalesDate(e.target.value)}
                className="w-full bg-slate-950/60 text-slate-300 px-4 py-3 border border-slate-800/60 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-bold"
                required
              />
            </section>

            {/* 1. 作目選択 */}
            <section className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/60 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2.5 flex items-center gap-2">
                <Sprout className="w-4 h-4 text-emerald-400" />{t('crop', language)}
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {crops.length > 0 ? crops.map(crop => (
                  <button
                    key={crop.id}
                    type="button"
                    onClick={() => setSelectedCrop(crop.name)}
                    className={`py-3.5 px-3 rounded-xl font-bold text-base transition-all border text-center ${
                      selectedCrop === crop.name
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-emerald-950 border-emerald-300 shadow-md'
                        : 'bg-slate-950/60 text-slate-300 border-slate-800/80'
                    }`}
                  >
                    {getTranslatedName(crop, language)}
                  </button>
                )) : (
                  <div className="col-span-2 text-sm text-slate-500 p-2 text-center">{t('loadingData', language)}</div>
                )}
              </div>
            </section>

            {/* 2. 出荷先・販路 (選んだ作目に登録されている販路だけを表示) */}
            <section className={`p-4 rounded-2xl border shadow-sm transition-all duration-300 ${
              selectedCrop ? 'bg-slate-900/60 border-slate-800/60' : 'bg-slate-950/30 border-slate-900/30 opacity-50'
            }`}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2.5 flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-400" />{t('salesChannel', language)}
              </h2>
              
              {!selectedCrop ? (
                <div className="text-sm text-slate-500 p-2 text-center font-bold">{t('selectCropFirst', language)}</div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {/* salesPricesの中から、選んだ作目に紐づく販路だけを抽出 */}
                  {salesPrices.filter(sp => sp.crop_name === selectedCrop).map(sp => {
                    const channelObj = channels.find(c => c.name === sp.channel_name) || { name: sp.channel_name };
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => setSelectedChannel(sp.channel_name)}
                        className={`py-3.5 px-3 rounded-xl font-bold text-base transition-all border text-center ${
                          selectedChannel === sp.channel_name
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-slate-950 border-blue-300 shadow-md'
                            : 'bg-slate-950/60 text-slate-300 border-slate-800/80 hover:bg-slate-800/60'
                        }`}
                      >
                        {getTranslatedName(channelObj, language)}
                        <div className="text-[10px] font-medium opacity-80 mt-1">¥{sp.price_per_unit}</div>
                      </button>
                    );
                  })}
                  {salesPrices.filter(sp => sp.crop_name === selectedCrop).length === 0 && (
                    <div className="col-span-2 text-xs text-rose-400 p-2 text-center bg-rose-950/30 rounded-lg">
                      {t('noPriceMaster', language)}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 3. 数量 */}
            <section className="bg-amber-900/20 p-4 rounded-2xl border border-amber-900/40 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2.5 flex items-center gap-2">
                <FileDigit className="w-4 h-4 text-amber-400" />{t('quantityRequired', language)}
              </h2>
              <div className="relative">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full py-4 px-4 pr-16 text-3xl font-black text-right bg-slate-950/80 rounded-xl border-2 border-amber-700/50 text-white placeholder-slate-700 focus:border-amber-400 focus:outline-none transition-all shadow-inner"
                  required
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 font-bold">
                  kg / 箱
                </div>
              </div>
            </section>

            {/* 4. 売上計算 */}
            {selectedCrop && selectedChannel && (
              <section className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 flex flex-col gap-4">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400 flex items-center gap-1"><Calculator className="w-4 h-4" /> {t('appliedPrice', language)} <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded ml-1">{t('editable', language)}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">¥</span>
                    <input
                      type="number"
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value)}
                      placeholder="0"
                      className="w-24 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-right font-bold text-white focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-slate-400">/ {t('unit', language)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-end border-t border-slate-700/50 pt-3 mt-1">
                  <span className="text-emerald-400 font-bold text-sm">{t('actualSales', language)}</span>
                  <span className="text-3xl font-black text-white">
                    ¥{calculatedTotal.toLocaleString()}
                  </span>
                </div>
              </section>
            )}

            {/* 送信ボタン */}
            <button
              type="submit"
              disabled={!selectedCrop || !selectedChannel || !quantity || isSubmitting}
              className={`w-full py-5 rounded-2xl font-black text-xl shadow-xl transition-all duration-200 flex items-center justify-center gap-2 mt-4 ${
                !selectedCrop || !selectedChannel || !quantity || isSubmitting
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-amber-950 hover:brightness-110 active:scale-[0.98] shadow-amber-500/20'
              }`}
            >
              {isSubmitting ? (
                <span>{t('loadingData', language)}</span>
              ) : (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  <span>{t('saveSalesRecord', language)}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
