"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, FileText } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function CustomerInvoicePrintPage({ params }: { params: Promise<{ customerId: string, invoiceId: string }> }) {
  const router = useRouter();
  const [invoiceId, setInvoiceId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [invoice, setInvoice] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function unwrap() {
      const p = await params;
      setInvoiceId(p.invoiceId);
      setCustomerId(p.customerId);
    }
    unwrap();
  }, [params]);

  useEffect(() => {
    async function loadData() {
      if (!invoiceId || !customerId) return;
      try {
        // customerId は実は order_token なので、実際の顧客UUIDを取得する
        const { data: custData, error: custErr } = await supabase
          .from('b2b_customers')
          .select('id')
          .eq('order_token', customerId)
          .single();
          
        if (custErr || !custData) throw new Error("顧客が見つかりません");

        const { data: inv, error: invErr } = await supabase
          .from('b2b_invoices')
          .select('*, customer:b2b_customers(*)')
          .eq('id', invoiceId)
          .eq('customer_id', custData.id)
          .single();
        if (invErr || !inv) throw new Error("請求書が見つかりません");
        setInvoice(inv);

        const { data: comp } = await supabase.from('company_settings').select('*').single();
        if (comp) setCompany(comp);

        const startDate = `${inv.target_month}-01`;
        const [yearStr, monthStr] = inv.target_month.split('-');
        const nextMonth = new Date(Number(yearStr), Number(monthStr), 1);
        const endDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

        const { data: ords } = await supabase
          .from('b2b_orders')
          .select('*, items:b2b_order_items(*, crops(*))')
          .eq('customer_id', inv.customer_id)
          .gte('delivery_date', startDate)
          .lt('delivery_date', endDate)
          .in('status', ['invoiced', 'delivered', 'paid'])
          .order('delivery_date', { ascending: true });
        
        if (ords) setOrders(ords);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [invoiceId, customerId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-bold">読み込み中...</div>;
  if (!invoice) return <div className="p-8 text-center text-rose-500 font-bold">請求書データの取得に失敗しました</div>;

  const subtotal = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const tax = Math.floor(subtotal * 0.08); 
  const totalAmount = subtotal + tax;

  return (
    <div className="bg-slate-100 min-h-screen py-8 font-sans print:bg-white print:py-0">
      
      {/* 画面上の操作パネル（印刷時は非表示） */}
      <div className="max-w-[210mm] mx-auto mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 px-4 print:hidden">
        <Link href={`/b2b-order/${customerId}`} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors shadow-sm self-start sm:self-auto flex items-center gap-2 font-bold px-4">
          <ArrowLeft className="w-5 h-5" /> 注文画面へ戻る
        </Link>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={handlePrint}
            className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <Printer className="w-5 h-5" /> PDF保存・印刷
          </button>
        </div>
      </div>

      {/* A4 請求書レイアウト */}
      <div className="max-w-[210mm] min-h-[297mm] mx-auto bg-white shadow-xl print:shadow-none p-12 print:p-0">
        
        {/* ヘッダー */}
        <div className="flex justify-between items-start mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-widest text-slate-800 border-b-4 border-slate-800 pb-2 mb-8">
              請求書
            </h1>
            <div className="text-xl font-black text-slate-800 mb-2 border-b border-slate-400 pb-1 inline-block min-w-[250px]">
              {invoice.customer?.name} 御中
            </div>
            <p className="text-sm font-bold text-slate-600 mt-4">
              平素は格別のご高配を賜り、厚く御礼申し上げます。<br/>
              下記の通りご請求申し上げます。
            </p>
          </div>
          <div className="text-right text-sm space-y-1 text-slate-700 font-bold">
            <div>発行日: {invoice.issue_date}</div>
            <div>請求番号: INV-{invoice.id.split('-')[0].toUpperCase()}</div>
            <div className="mt-6 text-base font-black text-slate-800">{company?.company_name || '自社名未設定'}</div>
            <div>〒{company?.postal_code || '000-0000'}</div>
            <div>{company?.address || '住所未設定'}</div>
            <div>TEL: {company?.phone || '未設定'}</div>
            <div>登録番号: {company?.invoice_number || 'T0000000000000'}</div>
          </div>
        </div>

        {/* 請求金額合計 */}
        <div className="flex justify-between items-end border-b-2 border-indigo-600 pb-2 mb-8">
          <div className="text-lg font-black text-slate-700">
            ご請求金額
          </div>
          <div className="text-4xl font-black text-indigo-700">
            ¥{totalAmount.toLocaleString()} <span className="text-base text-slate-500 font-bold">（税込）</span>
          </div>
        </div>

        {/* 支払い条件 */}
        <div className="mb-10 text-sm font-bold text-slate-700 flex gap-8">
          <div><span className="text-slate-500">お支払期限:</span> {invoice.due_date}</div>
          <div><span className="text-slate-500">お振込先:</span> {company?.bank_info || '振込先未設定'}</div>
        </div>

        {/* 明細テーブル */}
        <table className="w-full text-sm font-bold mb-12">
          <thead>
            <tr className="bg-slate-100 border-y border-slate-300 text-slate-700">
              <th className="py-3 px-4 text-left">納品日</th>
              <th className="py-3 px-4 text-left">品目</th>
              <th className="py-3 px-4 text-right">数量</th>
              <th className="py-3 px-4 text-right w-32">単価</th>
              <th className="py-3 px-4 text-right w-32">金額(税抜)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(order => (
              <React.Fragment key={order.id}>
                {order.items?.map((item: any, i: number) => (
                  <tr key={item.id} className="text-slate-700">
                    <td className="py-3 px-4">{i === 0 ? order.delivery_date : ''}</td>
                    <td className="py-3 px-4">{item.crops?.name || item.crop?.name || '不明'}</td>
                    <td className="py-3 px-4 text-right">{item.quantity} {item.unit}</td>
                    <td className="py-2 px-4 text-right">¥{Number(item.unit_price).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-black">¥{Number(item.total_price).toLocaleString()}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {/* 小計・消費税・合計 */}
        <div className="flex justify-end mb-12">
          <table className="w-64 text-sm font-bold text-slate-700">
            <tbody>
              <tr className="border-t border-slate-200">
                <td className="py-2 px-4 bg-slate-50">小計(税抜)</td>
                <td className="py-2 px-4 text-right">¥{subtotal.toLocaleString()}</td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="py-2 px-4 bg-slate-50">消費税(8%)</td>
                <td className="py-2 px-4 text-right">¥{tax.toLocaleString()}</td>
              </tr>
              <tr className="border-t-2 border-slate-800 text-base font-black">
                <td className="py-3 px-4 bg-slate-50">合計</td>
                <td className="py-3 px-4 text-right text-indigo-700">¥{totalAmount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* フッター備考 */}
        <div className="text-xs font-bold text-slate-400 text-center border-t border-slate-200 pt-8 mt-auto">
          振込手数料は貴社にてご負担くださいますようお願い申し上げます。
        </div>
      </div>

    </div>
  );
}