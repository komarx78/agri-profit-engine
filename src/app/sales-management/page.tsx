"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Truck, Calendar, ArrowRight, AlertCircle, CheckCircle2, 
  Banknote, Store, TrendingUp, Sprout, ShoppingCart, Clock 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { getB2BOrders } from '@/app/actions/b2b';

export default function SalesManagementDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [salesLogs, setSalesLogs] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const tenantId = await getCurrentTenantId();

        const [ordersRes, logsRes, channelsRes, cropsRes] = await Promise.all([
          getB2BOrders(tenantId),
          tenantId
            ? supabase
                .from('sales_logs')
                .select('id, sales_date, quantity, unit, total_sales, channel_id, crop_id, status')
                .eq('user_id', tenantId)
                .or('status.neq.planned,status.is.null')
                .order('sales_date', { ascending: false })
                .order('id', { ascending: false })
            : Promise.resolve({ data: [], error: null }),
          tenantId ? supabase.from('sales_channels').select('id, name').eq('user_id', tenantId) : Promise.resolve({ data: [], error: null }),
          tenantId ? supabase.from('crops').select('id, name').eq('user_id', tenantId) : Promise.resolve({ data: [], error: null })
        ]);

        if (ordersRes.success) {
          setOrders(ordersRes.orders || []);
        }

        const rawLogs = logsRes.data || [];
        const chList = channelsRes.data || [];
        const crList = cropsRes.data || [];

        setChannels(chList);
        setCrops(crList);

        const mappedLogs = rawLogs.map(log => ({
          ...log,
          crops: { name: crList.find(c => c.id === log.crop_id)?.name || '不明' },
          sales_channels: { name: chList.find(c => c.id === log.channel_id)?.name || '不明' }
        }));

        setSalesLogs(mappedLogs);
      } catch (err) {
        console.error('Failed to load sales dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7); // 'YYYY-MM'
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // B2B集計
  const todaysOrders = orders.filter(o => o.delivery_date === todayStr);
  const tomorrowsOrders = orders.filter(o => o.delivery_date === tomorrowStr);
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const thisMonthB2BTotal = orders
    .filter(o => o.delivery_date && o.delivery_date.startsWith(currentMonthStr) && o.status !== 'cancelled')
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  // 都度出荷（JA・直売所）集計
  const thisMonthSalesLogs = salesLogs.filter(s => s.sales_date && s.sales_date.startsWith(currentMonthStr));
  const thisMonthAdHocTotal = thisMonthSalesLogs.reduce((sum, s) => sum + (Number(s.total_sales) || 0), 0);
  const thisMonthAdHocQty = thisMonthSalesLogs.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
  const pendingPriceLogs = salesLogs.filter(s => !s.total_sales || Number(s.total_sales) <= 0);

  // 今月の総売上（B2B + 都度出荷）
  const grandTotalSalesMonth = thisMonthB2BTotal + thisMonthAdHocTotal;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-indigo-600" />
            販売管理ダッシュボード
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            B2B定期受注とJA・市場・直売所への都度出荷を統合管理・可視化します。
          </p>
        </div>
        <div className="text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 self-start sm:self-auto">
          集計対象月: {currentMonthStr.replace('-', '年')}月
        </div>
      </div>

      {/* 4大KPIカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* 1. 今月の販売総額 */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-indigo-200 uppercase tracking-wider">今月の確定売上総額</span>
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-white tracking-tight">
              ¥{grandTotalSalesMonth.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-indigo-200/80 font-bold">
              <span>都度出荷: ¥{thisMonthAdHocTotal.toLocaleString()}</span>
              <span>•</span>
              <span>B2B: ¥{thisMonthB2BTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 2. JA・直売所 都度出荷 */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">JA・直売所 都度出荷 (今月)</span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-800">{thisMonthSalesLogs.length}</span>
              <span className="text-xs font-bold text-slate-400">件</span>
              <span className="text-sm font-bold text-slate-500 ml-auto">
                総量: {thisMonthAdHocQty.toLocaleString()} kg
              </span>
            </div>
            <div className="text-xs font-bold text-emerald-700 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>確定売上: ¥{thisMonthAdHocTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 3. 精算待ち（未確定）出荷 */}
        <Link 
          href="/sales-management/sales-history" 
          className="bg-white hover:bg-amber-50/50 transition-colors rounded-3xl p-5 border border-amber-200/80 shadow-xs flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> 精算待ち (金額未確定)
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-600">{pendingPriceLogs.length}</span>
              <span className="text-xs font-bold text-amber-700">件</span>
            </div>
            <div className="text-[11px] font-bold text-amber-600 mt-2 flex items-center gap-1">
              <span>精算書到着後に入力 ➔</span>
            </div>
          </div>
        </Link>

        {/* 4. B2B受注・納品予定 */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">B2B定期受注・納品</span>
            <div className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-3">
              <div>
                <span className="text-xs font-bold text-slate-400">本日: </span>
                <span className="text-2xl font-black text-slate-800">{todaysOrders.length}</span>
                <span className="text-xs font-bold text-slate-400">件</span>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400">明日: </span>
                <span className="text-2xl font-black text-slate-800">{tomorrowsOrders.length}</span>
                <span className="text-xs font-bold text-slate-400">件</span>
              </div>
            </div>
            <div className="text-xs font-bold text-blue-600 mt-2">
              未納品（保留中）: {pendingOrders.length} 件
            </div>
          </div>
        </div>

      </div>

      {/* 2大チャネルのリアルタイム進行パネル（2カラム構成） */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 左カラム：🚚 直近の都度出荷（JA・市場・直売所） */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[480px]">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="font-black text-slate-900 flex items-center gap-2 text-base">
                <Truck className="w-5 h-5 text-emerald-600" /> JA・直売所 都度出荷ログ
              </h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">現場日報から登録された直近の出荷記録</p>
            </div>
            <Link 
              href="/sales-management/sales-history" 
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-xl transition-colors"
            >
              出荷履歴へ <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-slate-400 font-bold">読み込み中...</div>
            ) : salesLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold">出荷記録がまだありません</div>
            ) : (
              salesLogs.slice(0, 7).map(log => {
                const hasPrice = log.total_sales && log.total_sales > 0;
                const unitPrice = (hasPrice && log.quantity > 0) ? Math.round(log.total_sales / log.quantity) : 0;
                
                return (
                  <div key={log.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-400">{log.sales_date}</span>
                        <span className="font-bold text-slate-600 text-xs px-2 py-0.5 bg-slate-100 rounded-md truncate">
                          {log.sales_channels?.name || '不明'}
                        </span>
                      </div>
                      <div className="font-black text-slate-800 text-sm flex items-center gap-2">
                        <span>{log.crops?.name || '作物'}</span>
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg text-xs font-bold">
                          {log.quantity} {log.unit || 'kg'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      {hasPrice ? (
                        <div>
                          <div className="font-black text-slate-800 text-sm">
                            ¥{Number(log.total_sales).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-emerald-600 font-bold">
                            (¥{unitPrice.toLocaleString()}/{log.unit || 'kg'})
                          </div>
                        </div>
                      ) : (
                        <Link
                          href="/sales-management/sales-history"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold transition-colors"
                        >
                          <AlertCircle className="w-3 h-3 text-amber-500" />
                          <span>精算待ち</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 右カラム：🏢 直近のB2B納品スケジュール */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[480px]">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="font-black text-slate-900 flex items-center gap-2 text-base">
                <Calendar className="w-5 h-5 text-indigo-600" /> B2B直販 納品スケジュール
              </h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">飲食店・スーパー等への受注と配達予定</p>
            </div>
            <Link 
              href="/sales-management/orders" 
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-xl transition-colors"
            >
              受注一覧へ <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-slate-400 font-bold">読み込み中...</div>
            ) : pendingOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold">未納品の受注はありません</div>
            ) : (
              pendingOrders.slice(0, 7).map(order => (
                <div key={order.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                        order.delivery_date === todayStr ? 'bg-rose-100 text-rose-700' :
                        order.delivery_date === tomorrowStr ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {order.delivery_date === todayStr ? '本日配達' : order.delivery_date === tomorrowStr ? '明日配達' : order.delivery_date}
                      </span>
                      <span className="font-black text-slate-800 text-sm truncate">{order.customer?.name}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-500 truncate flex items-center gap-1">
                      {order.items?.map((item: any) => (
                        <span key={item.id} className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          {item.crops?.name || item.crop?.name || '作物'} {item.quantity}{item.unit}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-slate-800">¥{Number(order.total_amount).toLocaleString()}</span>
                    <Link href="/sales-management/orders" className="block text-[11px] font-bold text-indigo-600 hover:text-indigo-800 mt-0.5">
                      詳細 ➔
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
