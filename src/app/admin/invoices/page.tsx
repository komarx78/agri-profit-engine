"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Printer, Calculator, AlertCircle, RefreshCw, Mail, Users, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface CompanySettings {
  company_name: string;
  postal_code: string;
  address: string;
  phone: string;
  email?: string;
  invoice_number: string;
  bank_info: string;
}

interface Channel {
  id: number;
  name: string;
  email: string | null;
}

export default function InvoicesPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  
  // フィルター
  const currentMonth = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  
  const [salesLogs, setSalesLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetched, setIsFetched] = useState(false);

  // 請求書のタブ切り替え用
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  
  const [isCreatingLink, setIsCreatingLink] = useState(false);

  // 一括送信アシスト用のState
  const [isBatchAssistOpen, setIsBatchAssistOpen] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchSendList, setBatchSendList] = useState<{
    channelId: number;
    channelName: string;
    email: string | null;
    shareUrl: string;
    mailSubject: string;
    mailBody: string;
  }[]>([]);
  const [sentChannelIds, setSentChannelIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function init() {
      // 販路と自社設定の取得（ここではマスタとして持っておく）
      const [chRes, setRes] = await Promise.all([
        supabase.from('sales_channels').select('id, name, email').order('name'),
        supabase.from('company_settings').select('*').order('created_at', { ascending: false }).limit(1).single()
      ]);
      
      if (chRes.data) setChannels(chRes.data);
      if (setRes.data) setSettings(setRes.data as CompanySettings);
    }
    init();
  }, []);

  const handleGenerate = async () => {
    if (!selectedMonth) return;
    
    setIsLoading(true);
    setIsFetched(false);
    setActiveChannelId(null);
    setIsBatchAssistOpen(false);
    
    try {
      // 指定月（YYYY-MM）の最初の日と最後の日
      const startDate = `${selectedMonth}-01`;
      const date = new Date(selectedMonth + '-01');
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

      // 指定月の「すべて」の売上ログを取得
      const [logsRes, cropsRes] = await Promise.all([
        supabase
          .from('sales_logs')
          .select(`
            id,
            sales_date,
            quantity,
            unit,
            total_sales,
            crop_id,
            channel_id
          `)
          .gte('sales_date', startDate)
          .lte('sales_date', endDate)
          .order('sales_date', { ascending: true }), // 日付順
        supabase.from('crops').select('id, name')
      ]);
      
      if (logsRes.error) throw logsRes.error;
      
      const crops = cropsRes.data || [];

      // JS側でマッピング
      const mappedLogs = (logsRes.data || []).map(log => {
        const ch = channels.find(c => c.id === log.channel_id);
        return {
          ...log,
          crops: { name: crops.find(c => c.id === log.crop_id)?.name || '不明な作目' },
          sales_channels: { 
            id: ch?.id || -1,
            name: ch?.name || '不明な請求先',
            email: ch?.email || null
          }
        };
      });

      setSalesLogs(mappedLogs);
      setIsFetched(true);

      // 初期タブの設定（データが存在する最初の請求先を選択）
      const uniqueChannelIds = Array.from(new Set(mappedLogs.map(l => l.sales_channels.id)));
      if (uniqueChannelIds.length > 0) {
        setActiveChannelId(uniqueChannelIds[0]);
      }
      
    } catch (err) {
      console.error(err);
      alert('データ取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 出荷先（請求先）ごとにログをグループ化
  const invoicesByChannel = useMemo(() => {
    const map = new Map<number, { channelName: string; email: string | null; logs: any[]; subtotal: number }>();
    
    salesLogs.forEach(log => {
      if (!log.total_sales || log.total_sales <= 0) return;
      
      const chId = log.sales_channels.id;
      if (!map.has(chId)) {
        map.set(chId, {
          channelName: log.sales_channels.name,
          email: log.sales_channels.email,
          logs: [],
          subtotal: 0
        });
      }
      
      const group = map.get(chId)!;
      group.logs.push(log);
      group.subtotal += log.total_sales;
    });
    
    return Array.from(map.entries()).sort((a, b) => a[1].channelName.localeCompare(b[1].channelName));
  }, [salesLogs]);

  const activeInvoice = useMemo(() => {
    if (!activeChannelId) return null;
    const item = invoicesByChannel.find(([id]) => id === activeChannelId);
    return item ? { ...item[1], id: item[0] } : null;
  }, [invoicesByChannel, activeChannelId]);

  const handlePrint = () => {
    window.print();
  };

  const handleCreateShareLink = async (mailerType: 'gmail' | 'standard') => {
    if (!activeInvoice) return;
    if (!activeInvoice.email) {
      if (!confirm('この出荷先にはメールアドレスが登録されていません。\n宛先が空の状態でメールを立ち上げますか？')) return;
    }

    setIsCreatingLink(true);
    try {
      // DBにスナップショットを保存
      const invoiceData = {
        logs: activeInvoice.logs,
        settings: settings,
        subtotal: activeInvoice.subtotal
      };

      const { data, error } = await supabase
        .from('issued_invoices')
        .insert([{
          channel_id: activeInvoice.id,
          billing_month: selectedMonth + '-01',
          total_amount: activeInvoice.subtotal,
          invoice_data: invoiceData
        }])
        .select('id')
        .single();

      if (error) throw error;

      // 共有リンクの作成
      const shareUrl = `${window.location.origin}/share/invoice/${data.id}`;
      
      const [year, month] = selectedMonth.split('-');
      const mailSubject = `【ご請求書】${month}月分 - ${settings?.company_name || '農園'}`;
      
      const signature = [
        '=========================================',
        settings?.company_name || '農園名未設定',
        settings?.postal_code ? `〒${settings.postal_code}` : '',
        settings?.address || '',
        settings?.phone ? `TEL: ${settings.phone}` : '',
        settings?.email ? `Email: ${settings.email}` : '',
        settings?.invoice_number ? `適格請求書発行事業者登録番号: ${settings.invoice_number}` : '',
        '========================================='
      ].filter(Boolean).join('\n');

      const totalWithTax = activeInvoice.subtotal + Math.floor(activeInvoice.subtotal * 0.10);

      const mailBody = `${activeInvoice.channelName} 御中\n\nいつもお世話になっております。\n${settings?.company_name || '当農園'}です。\n\n${year}年${month}月分のご請求書をお送りいたします。\n\nご請求金額： ¥${totalWithTax.toLocaleString()} (税込)\n\n※以下のURLをクリックして、請求書をご確認・ダウンロードいただけます。\n\n▼ 請求書の確認・ダウンロードはこちら\n${shareUrl}\n\n何卒よろしくお願い申し上げます。\n\n${signature}`;

      if (mailerType === 'gmail') {
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${activeInvoice.email || ''}&su=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
        window.open(gmailUrl, '_blank');
      } else {
        const mailtoUrl = `mailto:${activeInvoice.email || ''}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
        window.location.href = mailtoUrl;
      }

    } catch (err) {
      console.error(err);
      alert('共有リンクの生成に失敗しました。');
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleBatchCreateLinks = async () => {
    if (!settings) {
      alert('先に「設定」画面から自社情報（農園名など）を登録してください。');
      return;
    }
    
    if (invoicesByChannel.length === 0) return;
    
    setIsBatchProcessing(true);
    const newList: typeof batchSendList = [];

    try {
      const [year, month] = selectedMonth.split('-');
      const invoiceMonthStr = `${selectedMonth}-01`;

      for (const [chId, data] of invoicesByChannel) {
        const invoiceData = {
          logs: data.logs,
          settings: settings,
          subtotal: data.subtotal
        };

        const { data: inserted, error } = await supabase
          .from('issued_invoices')
          .insert([{
            channel_id: chId,
            billing_month: invoiceMonthStr,
            total_amount: data.subtotal,
            invoice_data: invoiceData
          }])
          .select('id')
          .single();

        if (error) {
          console.error(`チャネル ${data.channelName} の発行エラー:`, error);
          continue;
        }

        const shareUrl = `${window.location.origin}/share/invoice/${inserted.id}`;
        const totalWithTax = data.subtotal + Math.floor(data.subtotal * 0.10);
        const mailSubject = `【ご請求書】${year}年${month}月分 (${settings?.company_name || '当農園'})`;
        const mailBody = `${data.channelName} 御中\n\nいつもお世話になっております。\n${settings?.company_name || '当農園'}です。\n\n${year}年${month}月分のご請求書をお送りいたします。\n\nご請求金額： ¥${totalWithTax.toLocaleString()} (税込)\n\n※以下のURLをクリックして、請求書をご確認・ダウンロードいただけます。\n\n▼ 請求書の確認・ダウンロードはこちら\n${shareUrl}\n\n何卒よろしくお願い申し上げます。\n\n${settings?.company_name || '当農園'}`;

        newList.push({
          channelId: chId,
          channelName: data.channelName,
          email: data.email,
          shareUrl,
          mailSubject,
          mailBody
        });
      }

      setBatchSendList(newList);
      setSentChannelIds(new Set());
      setIsBatchAssistOpen(true);
    } catch (err) {
      console.error(err);
      alert('一括発行中にエラーが発生しました。');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleOpenMail = (item: typeof batchSendList[0], type: 'gmail' | 'standard') => {
    if (type === 'gmail') {
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${item.email || ''}&su=${encodeURIComponent(item.mailSubject)}&body=${encodeURIComponent(item.mailBody)}`;
      window.open(gmailUrl, '_blank');
    } else {
      const mailtoUrl = `mailto:${item.email || ''}?subject=${encodeURIComponent(item.mailSubject)}&body=${encodeURIComponent(item.mailBody)}`;
      window.location.href = mailtoUrl;
    }
    setSentChannelIds(prev => {
      const next = new Set(prev);
      next.add(item.channelId);
      return next;
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="print:hidden space-y-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-500" />
            請求書の一括発行
          </h1>
          <p className="text-slate-500 mt-2 font-medium">対象月を選ぶだけで、その月に出荷があったすべての取引先の請求書を一斉に作成します。</p>
        </div>

        {!settings && (
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800 mb-1">自社情報が設定されていません</p>
              <p className="text-xs text-amber-700 mb-2">請求書に印字する農園名や振込先口座情報を設定してください。</p>
              <Link href="/admin/settings" className="text-xs font-bold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors inline-block">
                自社設定へ移動
              </Link>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full max-w-xs">
            <label className="block text-sm font-bold text-slate-500 mb-1">対象月</label>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={isLoading || !selectedMonth}
            className="w-full md:w-auto bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
            一括計算する
          </button>
        </div>
      </div>

      {isBatchAssistOpen && batchSendList.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 shadow-sm mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-black text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              送信アシスト（{sentChannelIds.size} / {batchSendList.length} 件 完了）
            </h2>
            <button onClick={() => setIsBatchAssistOpen(false)} className="text-emerald-700 hover:bg-emerald-100 px-3 py-1 rounded-lg text-sm font-bold transition-colors">
              閉じる
            </button>
          </div>
          <p className="text-sm text-emerald-700 mb-4">全員分の請求書の自動発行が完了しました！以下のボタンを上から順番に押して、メールを送信してください。</p>
          
          <div className="space-y-3">
            {batchSendList.map((item) => {
              const isSent = sentChannelIds.has(item.channelId);
              return (
                <div key={item.channelId} className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${isSent ? 'bg-white border-emerald-200 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center gap-3">
                    {isSent ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <div className="w-6 h-6 rounded-full border-2 border-slate-300" />}
                    <div>
                      <div className="font-bold text-slate-800">{item.channelName}</div>
                      <div className="text-xs text-slate-500">{item.email || 'メールアドレス未登録'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleOpenMail(item, 'gmail')} className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1">
                      <Mail className="w-4 h-4" /> Gmail
                    </button>
                    <button onClick={() => handleOpenMail(item, 'standard')} className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1">
                      <Mail className="w-4 h-4" /> 標準
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isFetched && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
          
          {invoicesByChannel.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center print:hidden">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-700 mb-2">データが見つかりません</h3>
              <p className="text-slate-500">指定した月に売上（出荷）が記録されたデータがありません。</p>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">
              
              <div className="lg:w-64 shrink-0 print:hidden space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sticky top-24">
                  <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-slate-400" /> 請求先一覧 ({invoicesByChannel.length}件)
                  </h3>

                  <button
                    onClick={handleBatchCreateLinks}
                    disabled={isBatchProcessing}
                    className="w-full mb-4 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isBatchProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                    全件発行＆送信アシスト
                  </button>

                  <div className="space-y-2">
                    {invoicesByChannel.map(([chId, inv]) => {
                      const isActive = activeChannelId === chId;
                      
                      return (
                        <button
                          key={chId}
                          onClick={() => setActiveChannelId(chId)}
                          className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                            isActive 
                              ? 'bg-indigo-50 border border-indigo-200 shadow-sm' 
                              : 'bg-white border border-transparent hover:bg-slate-50'
                          }`}
                        >
                          <div className={`font-bold truncate ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                            {inv.channelName}
                          </div>
                          <div className="text-xs font-bold text-slate-400 mt-1">
                            ¥{inv.subtotal.toLocaleString()}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* 右側：請求書プレビュー本体 */}
              <div className="flex-1 min-w-0">
                {activeInvoice && (
                  <div className="space-y-4">
                    {/* アクションバー print:hidden */}
                    <div className="print:hidden flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200 gap-4">
                      <div>
                        <span className="text-sm font-bold text-slate-400 mr-2">現在表示中:</span>
                        <span className="font-black text-slate-800 text-lg">{activeInvoice.channelName} 宛</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handlePrint}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors border border-slate-200"
                        >
                          <Printer className="w-4 h-4" />
                          印刷 / PDF保存
                        </button>
                        
                        {/* メール作成ボタン群 */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCreateShareLink('gmail')}
                            disabled={isCreatingLink}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm text-sm disabled:opacity-50"
                          >
                            {isCreatingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                            リンクを発行してGmail
                          </button>

                          <button
                            onClick={() => handleCreateShareLink('standard')}
                            disabled={isCreatingLink}
                            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm text-sm disabled:opacity-50"
                          >
                            {isCreatingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                            リンクを発行して標準メール
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* A4相当の請求書コンテナ */}
                    <div className="bg-white p-10 md:p-16 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0 min-h-[1050px]">
                      {/* 請求書ヘッダー */}
                      <div className="flex justify-between items-start border-b-2 border-slate-800 pb-8 mb-8">
                        <div>
                          <h2 className="text-4xl font-black text-slate-800 tracking-widest mb-6">請求書</h2>
                          <div className="text-xl font-bold text-slate-800 border-b border-slate-800 pb-2 inline-block min-w-[300px]">
                            {activeInvoice.channelName} <span className="text-base font-normal">御中</span>
                          </div>
                          <div className="mt-4 text-sm text-slate-600 font-medium">
                            下記の通りご請求申し上げます。
                          </div>
                        </div>
                        
                        <div className="text-right text-sm text-slate-700 space-y-1">
                          <div className="mb-4 font-bold text-slate-500">
                            発行日: {new Date(new Date(selectedMonth + '-01').getFullYear(), new Date(selectedMonth + '-01').getMonth() + 1, 0).toLocaleDateString('ja-JP')}
                          </div>
                          {settings ? (
                            <>
                              <div className="text-lg font-black text-slate-800 mb-2">{settings.company_name}</div>
                              {settings.postal_code && <div>〒{settings.postal_code}</div>}
                              {settings.address && <div>{settings.address}</div>}
                              {settings.phone && <div>TEL: {settings.phone}</div>}
                              {settings.invoice_number && <div className="mt-2 text-xs font-bold text-slate-500 border border-slate-300 inline-block px-2 py-1 bg-slate-50">登録番号: T{settings.invoice_number}</div>}
                            </>
                          ) : (
                            <div className="text-slate-400 italic">※自社情報が未設定です</div>
                          )}
                        </div>
                      </div>

                      {/* 請求金額合計 */}
                      <div className="flex justify-center mb-12">
                        <div className="text-center">
                          <div className="text-sm font-bold text-slate-500 mb-1 tracking-widest">ご請求金額 (税込)</div>
                          <div className="text-5xl font-black text-slate-800 border-b-4 border-slate-800 pb-2 px-8 flex items-baseline justify-center gap-2">
                            <span className="text-3xl text-slate-400">¥</span>
                            {activeInvoice.subtotal.toLocaleString()}
                            <span className="text-2xl text-slate-800 ml-2">-</span>
                          </div>
                        </div>
                      </div>

                      {/* 明細テーブル (納品日ベース) */}
                      <table className="w-full text-left border-collapse mb-12 text-sm">
                        <thead>
                          <tr className="bg-slate-100 border-b-2 border-slate-800 text-slate-700 font-bold">
                            <th className="py-3 px-4 w-28">納品日</th>
                            <th className="py-3 px-4">品名</th>
                            <th className="py-3 px-4 text-right">数量</th>
                            <th className="py-3 px-4 text-center">単位</th>
                            <th className="py-3 px-4 text-right">単価</th>
                            <th className="py-3 px-4 text-right">金額</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-800">
                          {activeInvoice.logs.map((log, idx) => {
                            const dateStr = log.sales_date ? log.sales_date.substring(5).replace('-', '/') : '';
                            const price = log.quantity > 0 ? Math.round(log.total_sales / log.quantity) : 0;
                            return (
                              <tr key={idx} className="border-b border-slate-200/60">
                                <td className="py-3 px-4 font-bold text-slate-500">{dateStr}</td>
                                <td className="py-3 px-4 font-bold">{log.crops?.name}</td>
                                <td className="py-3 px-4 text-right">{log.quantity}</td>
                                <td className="py-3 px-4 text-center text-slate-500 text-xs">{log.unit}</td>
                                <td className="py-3 px-4 text-right text-slate-400 text-xs">@¥{price.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right font-black text-base">¥{log.total_sales.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* フッター情報 (振込先など) */}
                      <div className="mt-auto grid grid-cols-2 gap-8 border-t-2 border-slate-800 pt-8 page-break-inside-avoid">
                        <div>
                          <div className="text-sm font-bold text-slate-500 mb-2 tracking-widest">お振込先口座</div>
                          {settings?.bank_info ? (
                            <div className="text-slate-700 font-bold whitespace-pre-wrap leading-relaxed bg-slate-50 p-5 rounded-xl border border-slate-200">
                              {settings.bank_info}
                            </div>
                          ) : (
                            <div className="text-slate-400 italic">振込先情報未設定</div>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-500 mb-2 tracking-widest">備考</div>
                          <div className="text-slate-700 font-medium whitespace-pre-wrap leading-relaxed text-sm p-5 border border-transparent">
                            対象期間: {selectedMonth.split('-')[0]}年{selectedMonth.split('-')[1]}月分<br />
                            誠に恐縮ですが、お振込手数料は貴社にてご負担くださいますようお願い申し上げます。
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
