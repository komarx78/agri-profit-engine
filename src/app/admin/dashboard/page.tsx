"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid,
  ComposedChart, Line, Area, AreaChart
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';
import { getAdminDashboardDataAction } from '@/app/actions/farm';
import { HelpTooltip } from '@/components/HelpTooltip';
import { classifyWorkProcess } from '@/lib/workProcessUtils';
import { 
  Activity, Clock, Sprout, TrendingUp, Banknote, UserCheck, 
  CalendarDays, MapPin, Calculator, Settings2, AlertCircle, 
  CheckCircle2, ArrowRight, Share2, Copy, Check, ExternalLink 
} from 'lucide-react';

// --- 直感的なグラフ用の色設定 ---
const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'];

// --- 金額フォーマッター（端数四捨五入・マイナス時は上品な▲表記） ---
const formatCurrency = (val: number) => {
  const rounded = Math.round(val || 0);
  if (rounded < 0) {
    return `▲¥${Math.abs(rounded).toLocaleString()}`;
  }
  return `¥${rounded.toLocaleString()}`;
};

const formatYAxisTenThousand = (val: number) => {
  const rounded = Math.round((val || 0) / 10000);
  if (rounded === 0) return '¥0';
  if (rounded < 0) return `▲¥${Math.abs(rounded)}万`;
  return `¥${rounded}万`;
};

export default function DashboardPage() {
  // 表示モード (実績のみ or 予定込み)
  const [dataViewMode, setDataViewMode] = useState<'actualOnly' | 'includePlanned'>('actualOnly');

  const [cropData, setCropData] = useState<any[]>([]);
  const [profitabilityData, setProfitabilityData] = useState<any[]>([]);
  const [fieldData, setFieldData] = useState<any[]>([]);
  const [workerProductivityData, setWorkerProductivityData] = useState<any[]>([]);
  const [monthlyTrendData, setMonthlyTrendData] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    sales: 0,
    laborCost: 0,
    profit: 0,
    margin: 0,
    totalMinutes: 0,
    directMinutes: 0,
    careMinutes: 0,
    prepMinutes: 0,
    hourlyProfit: 0
  });
  const [tenantId, setTenantId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // 現場クイックアラート用ステート
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [todayWorkCount, setTodayWorkCount] = useState<number>(0);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const currentOwnerId = await getCurrentTenantId();

        if (!currentOwnerId) {
          setIsLoading(false);
          return;
        }

        setTenantId(currentOwnerId);

        // サーバーアクション経由でRLSに影響されず確実に取得（フォールバック付き）
        let rawWorkLogs: any[] = [];
        let rawSalesLogs: any[] = [];
        let rawB2bOrders: any[] = [];

        const srvRes = await getAdminDashboardDataAction(currentOwnerId);
        if (srvRes?.success) {
          rawWorkLogs = srvRes.workLogs || [];
          rawSalesLogs = srvRes.salesLogs || [];
          rawB2bOrders = srvRes.b2bOrders || [];
          if (srvRes.ownerId) setTenantId(srvRes.ownerId);
        } else {
          const [workRes, salesRes] = await Promise.all([
            supabase.from('work_logs').select(`
              work_date,
              work_type,
              task_title,
              duration_minutes,
              status,
              approval_status,
              crops(name),
              workers(name, hourly_wage),
              fields(name)
            `).eq('user_id', currentOwnerId),
            supabase.from('sales_logs').select(`
              sales_date,
              total_sales,
              status,
              crops(name),
              sales_channels(name)
            `).eq('user_id', currentOwnerId)
          ]);
          rawWorkLogs = workRes.data || [];
          rawSalesLogs = salesRes.data || [];
        }

        // --- 未承認日報件数（status==='completed' かつ approval_status==='pending'）＆ 本日作業件数の集計 ---
        const pendingCount = rawWorkLogs.filter((log: any) => log.status === 'completed' && log.approval_status === 'pending').length;
        const todayStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
        const todayCount = rawWorkLogs.filter((log: any) => log.work_date === todayStr).length;
        setPendingApprovalsCount(pendingCount);
        setTodayWorkCount(todayCount);

        // --- フィルタリング (予実分離) ---
        const workLogs = rawWorkLogs.filter((log: any) => 
          dataViewMode === 'includePlanned' ? true : log.status === 'completed'
        );
        const salesLogs = rawSalesLogs.filter((log: any) => 
          dataViewMode === 'includePlanned' ? true : log.status === 'completed'
        );
        const b2bOrders = rawB2bOrders.filter((ord: any) =>
          dataViewMode === 'includePlanned'
            ? ord.status !== 'cancelled'
            : (ord.status === 'delivered' || ord.status === 'invoiced' || ord.status === 'paid')
        );

        // --- 集計用マップの準備 ---
        const cropHours: Record<string, number> = {}; 
        const workerHours: Record<string, number> = {}; 
        const fieldHours: Record<string, number> = {};
        
        const cropWageMap: Record<string, number> = {}; 
        const fieldWageMap: Record<string, number> = {};
        
        const workerCropHours: Record<string, Record<string, number>> = {}; 
        const workerWages: Record<string, number> = {}; 
        const workerTotalCost: Record<string, number> = {}; 

        const monthlyMap: Record<string, { 売上: number, 人件費: number }> = {};
        const cropToFieldHours: Record<string, Record<string, number>> = {}; 

        // 1. 売上の基本集計（sales_logs + b2b_orders）
        const cropSalesMap: Record<string, number> = {};
        let totalSales = 0;

        salesLogs.forEach((log: any) => {
          const cName = log.crops?.name || '未設定';
          const sales = Number(log.total_sales) || 0;
          const dateStr = log.sales_date;

          totalSales += sales;
          cropSalesMap[cName] = (cropSalesMap[cName] || 0) + sales;

          if (dateStr) {
            const monthStr = dateStr.substring(0, 7); 
            if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { 売上: 0, 人件費: 0 };
            monthlyMap[monthStr].売上 += sales;
          }
        });

        b2bOrders.forEach((ord: any) => {
          const dateStr = ord.delivery_date;
          const items = Array.isArray(ord.items) ? ord.items : [];
          if (items.length > 0) {
            items.forEach((item: any) => {
              const cName = item.crop_name || '未設定';
              const sales = Number(item.amount) || (Number(item.quantity || 0) * Number(item.unit_price || 0)) || 0;
              totalSales += sales;
              cropSalesMap[cName] = (cropSalesMap[cName] || 0) + sales;
              if (dateStr) {
                const monthStr = dateStr.substring(0, 7);
                if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { 売上: 0, 人件費: 0 };
                monthlyMap[monthStr].売上 += sales;
              }
            });
          } else if (ord.total_amount) {
            const sales = Number(ord.total_amount) || 0;
            totalSales += sales;
            cropSalesMap['B2B注文'] = (cropSalesMap['B2B注文'] || 0) + sales;
            if (dateStr) {
              const monthStr = dateStr.substring(0, 7);
              if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { 売上: 0, 人件費: 0 };
              monthlyMap[monthStr].売上 += sales;
            }
          }
        });

        // 2. 作業時間（3分類）＆ 人件費の基本集計
        let totalLaborCost = 0;
        let totalMinutes = 0;
        let directMinutes = 0;
        let careMinutes = 0;
        let prepMinutes = 0;

        workLogs.forEach((log: any) => {
          const cName = log.crops?.name || '共通・未指定';
          const wName = log.workers?.name || '不明';
          const fName = log.fields?.name || '共通・未指定';
          const dur = Number(log.duration_minutes) || 0;
          const wage = Number(log.workers?.hourly_wage) || 1000;
          const dateStr = log.work_date;

          const laborCost = (dur / 60) * wage;
          totalLaborCost += laborCost;
          totalMinutes += dur;

          const cat = classifyWorkProcess(log.work_type || log.task_title || '');
          if (cat === 'direct') directMinutes += dur;
          else if (cat === 'prep_cleanup') prepMinutes += dur;
          else careMinutes += dur;

          cropHours[cName] = (cropHours[cName] || 0) + dur;
          cropWageMap[cName] = (cropWageMap[cName] || 0) + laborCost;

          fieldHours[fName] = (fieldHours[fName] || 0) + dur;
          fieldWageMap[fName] = (fieldWageMap[fName] || 0) + laborCost;

          if (!cropToFieldHours[cName]) cropToFieldHours[cName] = {};
          cropToFieldHours[cName][fName] = (cropToFieldHours[cName][fName] || 0) + dur;

          workerHours[wName] = (workerHours[wName] || 0) + dur;
          if (!workerCropHours[wName]) workerCropHours[wName] = {};
          workerCropHours[wName][cName] = (workerCropHours[wName][cName] || 0) + dur;
          workerWages[wName] = wage;
          workerTotalCost[wName] = (workerTotalCost[wName] || 0) + laborCost;

          if (dateStr) {
            const monthStr = dateStr.substring(0, 7); 
            if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { 売上: 0, 人件費: 0 };
            monthlyMap[monthStr].人件費 += laborCost;
          }
        });

        // 3. 圃場への売上按分（作業時間比）
        const fieldSalesMap: Record<string, number> = {};
        Object.keys(cropSalesMap).forEach(cName => {
          const cSales = cropSalesMap[cName];
          const fHours = cropToFieldHours[cName];
          if (fHours) {
            const totalHours = Object.values(fHours).reduce((sum, h) => sum + h, 0);
            Object.keys(fHours).forEach(fName => {
              const ratio = totalHours > 0 ? fHours[fName] / totalHours : 0;
              fieldSalesMap[fName] = (fieldSalesMap[fName] || 0) + (cSales * ratio);
            });
          }
        });

        // サマリー設定（売上 − 投入人件費 ＝ 現場労働粗利）
        const roundedSales = Math.round(totalSales);
        const roundedLabor = Math.round(totalLaborCost);
        const totalProfit = roundedSales - roundedLabor;
        const profitMargin = roundedSales > 0 ? (totalProfit / roundedSales) * 100 : 0;
        const totalHours = totalMinutes / 60;
        const hourlyProfit = totalHours > 0 ? Math.round(totalProfit / totalHours) : 0;

        setSummary({ 
          sales: roundedSales, 
          laborCost: roundedLabor, 
          profit: totalProfit, 
          margin: profitMargin,
          totalMinutes,
          directMinutes,
          careMinutes,
          prepMinutes,
          hourlyProfit
        });

        // --- 品目別 労働粗利 ---
        const cropNetProfits: Record<string, number> = {}; 
        const allCropsSet = new Set([...Object.keys(cropHours), ...Object.keys(cropSalesMap)]);
        const pData = Array.from(allCropsSet).filter(k => k !== '共通・未指定' || (cropSalesMap[k] || 0) > 0).map(k => {
          const hours = (cropHours[k] || 0) / 60;
          const sales = cropSalesMap[k] || 0;
          const laborCost = cropWageMap[k] || 0;
          const netProfit = sales - laborCost;
          cropNetProfits[k] = netProfit; 
          
          return {
            name: k,
            時給換算: hours > 0 ? Math.round(netProfit / hours) : 0,
            売上: sales,
            コスト: Math.round(laborCost),
            利益: Math.round(netProfit),
            利益率: sales > 0 ? Math.round((netProfit / sales) * 100) : 0
          };
        }).sort((a, b) => b.利益 - a.利益);

        // --- 圃場別 労働粗利 ---
        const fData = Object.keys(fieldHours).map(k => {
          const sales = fieldSalesMap[k] || 0;
          const laborCost = fieldWageMap[k] || 0;
          const netProfit = sales - laborCost;
          return {
            name: k,
            売上: Math.round(sales),
            コスト: Math.round(laborCost),
            利益: Math.round(netProfit),
            利益率: sales > 0 ? Math.round((netProfit / sales) * 100) : 0
          };
        }).sort((a, b) => b.利益 - a.利益);

        // --- 個人別 生産性 ---
        const wpData = Object.keys(workerHours).map(wName => {
          let createdValue = 0;
          const wCrops = workerCropHours[wName];
          
          Object.keys(wCrops).forEach(cName => {
            const myHours = wCrops[cName];
            const totalCropHrs = cropHours[cName];
            if (totalCropHrs > 0) {
              const myContributionRatio = myHours / totalCropHrs;
              createdValue += (cropNetProfits[cName] || 0) * myContributionRatio;
            }
          });
          
          const totalMyHours = workerHours[wName] / 60;
          const productivity = totalMyHours > 0 ? Math.round((createdValue - workerTotalCost[wName]) / totalMyHours) : 0;
          
          return {
            name: wName,
            生産性: productivity,
            時給: workerWages[wName] || 1000,
            貢献利益: Math.round(createdValue)
          };
        }).sort((a, b) => b.生産性 - a.生産性);

        // --- 月別推移データ ---
        let cumulativeProfit = 0;
        const mTrendData = Object.keys(monthlyMap).sort().map(monthStr => {
          const sales = monthlyMap[monthStr].売上;
          const labor = monthlyMap[monthStr].人件費;
          const profit = sales - labor;
          
          cumulativeProfit += profit;
          return {
            month: monthStr, 
            売上: sales,
            コスト: Math.round(labor),
            単月利益: Math.round(profit),
            累計利益: Math.round(cumulativeProfit)
          };
        });

        const cData = Object.keys(cropHours).map(k => ({ name: k, value: cropHours[k] }));
        
        setCropData(cData);
        setProfitabilityData(pData);
        setFieldData(fData);
        setWorkerProductivityData(wpData);
        setMonthlyTrendData(mTrendData);

      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [dataViewMode]);

  const CustomProfitTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-slate-100 p-4 rounded-xl shadow-2xl border border-slate-700 font-bold text-sm min-w-[200px]">
          <p className="text-base text-emerald-400 mb-2 border-b border-slate-700 pb-1">{label}</p>
          <div className="space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">出荷売上:</span><span className="text-white">¥{Math.round(data.売上 || 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">投入人件費:</span><span className="text-rose-400">¥{Math.round(data.コスト || 0).toLocaleString()}</span></div>
            <div className="border-t border-slate-700 my-1.5"></div>
            <div className="flex justify-between items-center"><span className="text-slate-400">現場労働粗利:</span><span className={`text-lg font-black ${data.利益 >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(data.利益)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">粗利率:</span><span className="text-blue-300">{Math.round(data.利益率 || 0)}%</span></div>
            {data.時給換算 !== undefined && (
              <div className="flex justify-between mt-2 pt-2 border-t border-slate-700/50"><span className="text-slate-400">1時間あたり利益:</span><span className="text-emerald-300">¥{Math.round(data.時給換算 || 0).toLocaleString()}/h</span></div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const directRate = summary.totalMinutes > 0 ? Math.round((summary.directMinutes / summary.totalMinutes) * 100) : 0;
  const careRate = summary.totalMinutes > 0 ? Math.round((summary.careMinutes / summary.totalMinutes) * 100) : 0;
  const prepRate = summary.totalMinutes > 0 ? Math.max(0, 100 - directRate - careRate) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6 pb-16 pt-3 sm:pt-6">
      
      {/* ページヘッダー＆クイックコントロール */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                業務管理・作業工程PDCA
              </span>
              <span className="text-xs text-slate-400 font-bold">直接利益作業の最大化 ＆ 時間按分ダッシュボード</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              業務管理・生産効率ダッシュボード
            </h1>
          </div>
          
          {/* 右上アクションエリア：現場URLクイック配布 ＆ 分析画面ショートカット */}
          <div className="flex flex-wrap items-center gap-2">
            {tenantId && (
              <button
                onClick={async () => {
                  const farmUrl = `${window.location.origin}/portal/${tenantId}`;
                  try {
                    await navigator.clipboard.writeText(farmUrl);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2500);
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                title="現場タブレットや従業員用ポータルのURLをコピー"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-emerald-700 font-black">現場URLをコピーしました！</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>📱 現場ポータルURLをコピー</span>
                  </>
                )}
              </button>
            )}

            <Link
              href={tenantId ? `/admin/cultivation-schedule?farm=${tenantId}` : '/admin/cultivation-schedule'}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-2xs transition-all"
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>作付け別の時間按分・収支</span>
            </Link>
            <Link
              href={tenantId ? `/admin/crop-analysis?farm=${tenantId}` : '/admin/crop-analysis'}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-black shadow-2xs transition-all"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>工程別PDCA・前年比較</span>
            </Link>
          </div>
        </div>

        {/* 朝イチ現場アラートバー ＆ 予実切り替えタブ */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
          {/* 左側：現場即応アクションアラート */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {pendingApprovalsCount > 0 ? (
              <Link
                href={tenantId ? `/admin/approvals?farm=${tenantId}` : '/admin/approvals'}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl text-xs font-black text-amber-900 transition-colors shadow-2xs group"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                <span>未承認の日報が <strong className="text-sm text-amber-950 underline">{pendingApprovalsCount}件</strong> あります</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </Link>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>未承認の日報はありません（承認完了済）</span>
              </div>
            )}
            
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 font-medium border-l border-slate-200 pl-3">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>本日の作業実績: <strong className="text-slate-800 font-bold">{todayWorkCount}件</strong></span>
            </div>
          </div>

          {/* 右側：予実切り替えスイッチ */}
          <div className="bg-slate-200/70 p-1 rounded-xl flex items-center shadow-inner w-full sm:w-auto">
            <button
              onClick={() => setDataViewMode('actualOnly')}
              className={`py-1.5 px-3.5 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
                dataViewMode === 'actualOnly' 
                  ? 'bg-white text-emerald-700 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${dataViewMode === 'actualOnly' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
              確定実績のみ
            </button>
            <button
              onClick={() => setDataViewMode('includePlanned')}
              className={`py-1.5 px-3.5 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
                dataViewMode === 'includePlanned' 
                  ? 'bg-white text-amber-700 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${dataViewMode === 'includePlanned' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
              予定＋実績 (着地予想)
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-bold tracking-widest text-sm">集計中...</p>
          </div>
        </div>
      ) : (
        <>
          {/* --- 作業工程3分類バランスバー（直接利益を生む作業の最大化PDCA） --- */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <span>⏱️ 全作業時間の工程バランス（総投入: {(summary.totalMinutes / 60).toFixed(1)}時間）</span>
                </h2>
                <p className="text-xs text-slate-500 font-bold">
                  🔴 準備・片付け・移動などの非収穫作業を短縮し、🟢 直接利益を生む作業（播種・定植・収穫・出荷）の割合を最大化しましょう
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-black">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  🟢 直接利益作業率: {directRate}%
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                  🔴 準備・片付け等: {prepRate}%
                </span>
              </div>
            </div>

            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
              <div style={{ width: `${directRate}%` }} className="bg-emerald-500 h-full transition-all" title={`直接利益作業: ${directRate}%`} />
              <div style={{ width: `${careRate}%` }} className="bg-amber-400 h-full transition-all" title={`育成・維持管理: ${careRate}%`} />
              <div style={{ width: `${prepRate}%` }} className="bg-rose-500 h-full transition-all" title={`準備・片付け・共通: ${prepRate}%`} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 text-xs font-bold">
              <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-200 rounded-xl px-3 py-2 text-emerald-900">
                <span>🟢 直接利益作業（収穫・播種・出荷）</span>
                <span className="font-black">{(summary.directMinutes / 60).toFixed(1)}h ({directRate}%)</span>
              </div>
              <div className="flex items-center justify-between bg-amber-50/70 border border-amber-200 rounded-xl px-3 py-2 text-amber-900">
                <span>🟡 育成・維持管理（防除・追肥・管理）</span>
                <span className="font-black">{(summary.careMinutes / 60).toFixed(1)}h ({careRate}%)</span>
              </div>
              <div className="flex items-center justify-between bg-rose-50/70 border border-rose-200 rounded-xl px-3 py-2 text-rose-900">
                <span>🔴 準備・片付け・草刈り・移動</span>
                <span className="font-black">{(summary.prepMinutes / 60).toFixed(1)}h ({prepRate}%)</span>
              </div>
            </div>
          </div>

          {/* --- エグゼクティブKPIサマリー（出荷売上 vs 投入人件費 ＝ 現場労働粗利） --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. 出荷売上高 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-slate-500 flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-blue-600 shrink-0" /> 出荷・販売売上
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                  出荷実績ベース
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ¥{summary.sales.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                現場の収穫・出荷記録からの集計額
              </p>
            </div>
            
            {/* 2. 投入人件費（労働コスト） */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-slate-500 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-rose-500 shrink-0" /> 投入人件費（労働コスト）
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  作業時間 × 時給
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ¥{summary.laborCost.toLocaleString()}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-1">
                <span>総作業: {(summary.totalMinutes / 60).toFixed(1)}時間</span>
                <span className="text-slate-300">|</span>
                <span>※資材・経理経費は除外</span>
              </div>
            </div>
            
            {/* 3 & 4. 現場労働粗利（売上 − 投入人件費）＆ 時間あたり利益 */}
            <div className={`rounded-2xl p-5 border shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden lg:col-span-2 ${
              summary.profit >= 0 
                ? 'bg-gradient-to-br from-emerald-50/60 to-teal-50/30 border-emerald-200' 
                : 'bg-gradient-to-br from-rose-50/80 to-amber-50/30 border-rose-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-black flex items-center gap-1.5 ${summary.profit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                  <TrendingUp className="w-4 h-4 shrink-0" /> 現場労働粗利（売上 − 投入人件費）
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-white/90 text-slate-800 border border-slate-200">
                    1時間あたり利益: {formatCurrency(summary.hourlyProfit)}/h
                  </span>
                  <div className={`text-xs font-black px-2.5 py-0.5 rounded-full border shadow-2xs ${
                    summary.profit >= 0 
                      ? 'bg-emerald-600 text-white border-emerald-700' 
                      : 'bg-rose-600 text-white border-rose-700'
                  }`}>
                    {summary.profit >= 0 ? '黒字' : '赤字'} 粗利率 {summary.margin.toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-3">
                <div className={`text-3xl sm:text-4xl font-black tracking-tight ${summary.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {formatCurrency(summary.profit)}
                </div>
              </div>
              <p className={`text-[11px] font-medium mt-1 ${summary.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                ※出荷売上から現場スタッフの投入人件費（直接作業＋準備・片付け等）を差し引いた現場生産粗利です。
              </p>
            </div>
          </div>

          {/* --- 月別推移トレンド --- */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  経営推移トレンド
                  <HelpTooltip content="月ごとの売上・コスト・利益の推移を確認できます。累計利益がゼロを超えたタイミングが黒字転換の目安です。" />
                </h2>
                <p className="text-sm text-slate-500 font-medium">単月の売上・コストと、累計利益の推移（黒字転換のタイミング）</p>
              </div>
            </div>
            
            <div className="w-full h-[400px]">
              {monthlyTrendData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400">データがありません</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyTrendData} margin={{ top: 20, right: 20, bottom: 0, left: 20 }}>
                    <CartesianGrid stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{fill: '#64748b', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={formatYAxisTenThousand} tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <Tooltip 
                      formatter={(val: any, name: any) => [`¥${Math.round(val || 0).toLocaleString()}`, String(name || '')]}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold' }} />
                    
                    <Bar dataKey="売上" barSize={32} fill="#3b82f6" radius={[4, 4, 0, 0]} name="売上" />
                    <Bar dataKey="コスト" barSize={32} fill="#ef4444" radius={[4, 4, 0, 0]} name="コスト" />
                    <Line type="monotone" dataKey="単月利益" stroke="#f59e0b" strokeWidth={3} dot={{r: 4}} name="単月利益" />
                    <Area type="monotone" dataKey="累計利益" fill="#10b981" stroke="#10b981" fillOpacity={0.1} strokeWidth={3} name="累計利益" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* --- 分析グラフ群 (作目・圃場・人) --- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 作目別採算性 */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col h-[450px]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700">
                  <Sprout className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    作目別 採算性
                    <HelpTooltip content="作目ごとの『売上 - コスト』を計算し、どの作目が一番儲かっているか（または赤字か）を可視化します。" />
                  </h3>
                  <p className="text-sm text-slate-500">最も利益率が高い作目は？</p>
                </div>
              </div>
              <div className="flex-1 w-full">
                {profitabilityData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">データがありません</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profitabilityData} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} angle={-45} textAnchor="end" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={formatYAxisTenThousand} />
                      <Tooltip content={<CustomProfitTooltip />} cursor={{fill: '#f8fafc'}} />
                      <Bar dataKey="利益" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        {profitabilityData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.利益 >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            {/* 圃場別採算性 */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col h-[450px]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-teal-100 rounded-xl text-teal-700">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    圃場別 採算性
                    <HelpTooltip content="圃場（畑）ごとの収益性を確認できます。環境や土壌の違いによる利益の差を分析するのに役立ちます。" />
                  </h3>
                  <p className="text-sm text-slate-500">収益性の高い畑を特定</p>
                </div>
              </div>
              <div className="flex-1 w-full">
                {fieldData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">データがありません</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fieldData} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} angle={-45} textAnchor="end" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={formatYAxisTenThousand} />
                      <Tooltip content={<CustomProfitTooltip />} cursor={{fill: '#f8fafc'}} />
                      <Bar dataKey="利益" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        {fieldData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.利益 >= 0 ? '#14b8a6' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            {/* 個人別生産性 */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col h-[450px] lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-purple-100 rounded-xl text-purple-700">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">スタッフ別 生産性（利益貢献度）</h3>
                  <p className="text-sm text-slate-500">1時間あたりに生み出している利益額（時給換算）</p>
                </div>
              </div>
              <div className="flex-1 w-full">
                {workerProductivityData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">データがありません</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={workerProductivityData} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} angle={-45} textAnchor="end" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={formatCurrency} />
                      <Tooltip 
                        formatter={(val: any, name: any) => [`¥${val.toLocaleString()}/h`, String(name || '')]}
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="生産性" radius={[6, 6, 0, 0]} maxBarSize={60}>
                        {workerProductivityData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.生産性 >= 0 ? '#8b5cf6' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

          </div>
        </>
      )}
    </div>
  );
}
