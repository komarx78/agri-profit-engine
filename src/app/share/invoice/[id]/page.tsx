"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import { Printer, Loader2, AlertCircle } from 'lucide-react';

export default function SharedInvoicePage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    
    async function fetchInvoice() {
      try {
        const { data: invoice, error: fetchError } = await supabase
          .from('issued_invoices')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        if (!invoice) throw new Error('請求書が見つかりません');

        setData(invoice);
      } catch (err: any) {
        console.error(err);
        setError('請求書データの読み込みに失敗しました。URLが正しいかご確認ください。');
      } finally {
        setIsLoading(false);
      }
    }

    fetchInvoice();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto" />
          <div className="font-bold text-slate-500">請求書を読み込み中...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-200 text-center max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">エラー</h2>
          <p className="text-slate-600">{error || '不明なエラーが発生しました'}</p>
        </div>
      </div>
    );
  }

  const invoiceData = data.invoice_data;
  const settings = invoiceData.settings;
  const logs = invoiceData.logs;
  const [year, month] = data.billing_month.split('-');

  const taxRate = 0.10;
  const taxAmount = Math.floor(data.total_amount * taxRate);
  const totalWithTax = data.total_amount + taxAmount;

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 font-sans print:bg-white print:p-0 print:py-0">
      <div className="max-w-[210mm] mx-auto space-y-6">
        
        {/* ヘッダー/アクションバー */}
        <div className="print:hidden bg-white p-4 rounded-2xl shadow-md border border-slate-200 flex justify-between items-center sticky top-4 z-10">
          <div className="text-slate-600 font-bold">
            {data.billing_month.replace('-', '年')}月分 請求書
          </div>
          <button
            onClick={handlePrint}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Printer className="w-5 h-5" />
            印刷 / PDFとして保存
          </button>
        </div>

        {/* 請求書本体 */}
        <div className="bg-white p-10 md:p-16 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0 min-h-[1050px]">
          <div className="flex justify-between items-start mb-16">
            <div className="space-y-4 flex-1">
              <h2 className="text-4xl font-black tracking-widest text-slate-800 mb-12">
                請求書
              </h2>
              <div className="text-xl font-bold text-slate-800 border-b-2 border-slate-800 pb-2 inline-block min-w-[250px]">
                {data.channel_name} <span className="text-base font-medium ml-2">御中</span>
              </div>
              <p className="text-sm text-slate-500 pt-2">
                下記の通りご請求申し上げます。
              </p>
            </div>

            <div className="text-right text-sm text-slate-700 space-y-1">
              <div className="mb-4 font-bold text-slate-500">
                発行日: {new Date(new Date(data.billing_month + '-01').getFullYear(), new Date(data.billing_month + '-01').getMonth() + 1, 0).toLocaleDateString('ja-JP')}
              </div>
              {settings ? (
                <>
                  <div className="text-lg font-black text-slate-800 mb-2">{settings.company_name}</div>
                  <div>〒{settings.postal_code}</div>
                  <div>{settings.address}</div>
                  <div>TEL: {settings.phone}</div>
                  <div className="inline-block mt-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-500">
                    登録番号: {settings.invoice_number}
                  </div>
                </>
              ) : (
                <div className="text-red-500">自社情報が未設定です</div>
              )}
            </div>
          </div>

          <div className="mb-12 border-b-4 border-slate-800 pb-4 text-center">
            <div className="text-sm font-bold text-slate-500 mb-1">ご請求金額 (税込)</div>
            <div className="text-4xl font-black text-slate-800">
              <span className="text-2xl mr-1">¥</span>
              {totalWithTax.toLocaleString()} <span className="text-xl">-</span>
            </div>
          </div>

          <table className="w-full text-sm mb-12">
            <thead>
              <tr className="border-b-2 border-slate-800 text-slate-500">
                <th className="py-3 text-left font-bold w-24">納品日</th>
                <th className="py-3 text-left font-bold">品名</th>
                <th className="py-3 text-right font-bold w-20">数量</th>
                <th className="py-3 text-left font-bold px-2 w-16">単位</th>
                <th className="py-3 text-right font-bold w-24">単価(推計)</th>
                <th className="py-3 text-right font-bold w-28">金額</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any, idx: number) => (
                <tr key={idx} className="border-b border-slate-200 text-slate-700">
                  <td className="py-3 text-left font-medium">{log.work_date.substring(5).replace('-', '/')}</td>
                  <td className="py-3 text-left font-bold">{log.crops.name}</td>
                  <td className="py-3 text-right">{log.yield_amount}</td>
                  <td className="py-3 text-left px-2 text-slate-500">{log.crops.unit}</td>
                  <td className="py-3 text-right text-slate-500">
                    <span className="text-xs mr-1">@</span>¥{log.unit_price?.toLocaleString() || '0'}
                  </td>
                  <td className="py-3 text-right font-bold text-slate-800">
                    ¥{log.total_sales?.toLocaleString() || '0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-16">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-slate-600 font-medium pb-2 border-b border-slate-200">
                <span>小計 (税抜)</span>
                <span>¥{data.total_amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium pb-2 border-b border-slate-200">
                <span>消費税 (10%)</span>
                <span>¥{taxAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg font-black text-slate-800 pt-2 border-b-2 border-slate-800 pb-2">
                <span>合計</span>
                <span>¥{totalWithTax.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {settings?.bank_info && (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-sm">
              <div className="font-bold text-slate-700 mb-2">【お振込先】</div>
              <div className="whitespace-pre-wrap text-slate-600 leading-relaxed font-medium">
                {settings.bank_info}
              </div>
              <div className="mt-3 text-slate-500 text-xs">
                ※恐れ入りますが、振込手数料は貴社にてご負担賜りますようお願い申し上げます。
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
