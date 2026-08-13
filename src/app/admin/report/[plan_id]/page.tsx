"use client";

import React, { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import { Printer, Loader2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

// 作業種類をPDFの表現に合わせるためのマッピング（必要に応じて）
const WORK_TYPE_MAP: Record<string, string> = {
  '定植・播種': '播種・定植',
  '水やり': '灌水',
  '肥料・農薬': '施肥・防除',
  '草刈り': '除草',
  '収穫': '収穫',
  '片付け・メンテ': '片付け',
};

export default function ReportPage({ params }: { params: Promise<{ plan_id: string }> | { plan_id: string } }) {
  const unwrappedParams = params instanceof Promise ? use(params) : params;
  
  const [isLoading, setIsLoading] = useState(true);
  const [planData, setPlanData] = useState<any>(null);
  
  // マトリックス用データ
  const [laborMatrix, setLaborMatrix] = useState<any>({});
  const [laborTotals, setLaborTotals] = useState<any>({});
  
  // 経費・売上データ
  const [costs, setCosts] = useState<any>({});
  const [sales, setSales] = useState<any>({});
  
  // 面積と10a換算係数
  const [multiplier, setMultiplier] = useState(1);
  const [areaSize, setAreaSize] = useState(10);
  
  // 記号カレンダー用データ
  const [calendarMarks, setCalendarMarks] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, [unwrappedParams.plan_id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 計画データの取得
      const { data: planRes, error: planErr } = await supabase
        .from('cultivation_plans_v2')
        .select(`
          *,
          fields ( name, area_size ),
          crops ( name )
        `)
        .eq('id', unwrappedParams.plan_id)
        .single();
        
      if (planErr) throw planErr;
      
      const plan = planRes;
      setPlanData(plan);
      
      const area = plan.fields?.area_size || plan.calculated_area || 1;
      setAreaSize(area);
      const m = 10 / area;
      setMultiplier(m);
      
      // 作業ログと出荷ログの取得 (スマホから入力された plan_id のないデータも拾うため or 条件を使用)
      const [workRes, salesRes] = await Promise.all([
        supabase.from('work_logs').select(`
          *,
          materials (*)
        `).or(`plan_id.eq.${unwrappedParams.plan_id},and(crop_id.eq.${plan.crop_id},field_id.eq.${plan.field_id})`).order('work_date', { ascending: true }),
        supabase.from('sales_logs').select('*').or(`plan_id.eq.${unwrappedParams.plan_id},crop_id.eq.${plan.crop_id}`).order('sales_date', { ascending: true })
      ]);
      
      const workLogs = workRes.data || [];
      const salesLogs = salesRes.data || [];
      
      processLogs(workLogs, salesLogs, m);
      
    } catch (err: any) {
      console.error(err);
      alert(`データの取得に失敗しました: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const processLogs = (workLogs: any[], salesLogs: any[], m: number) => {
    // 旬別労働時間のマトリックス初期化
    const matrix: any = {};
    const marks: any = {};
    const totals: any = { months: {} };
    
    // 資材費カテゴリ初期化
    const calculatedCosts: any = {
      '種苗費': [],
      '肥料費': [],
      '農薬費': [],
      '動力光熱費': [],
      '諸材料費': [],
      '機械・車両費': [],
      'その他経費': []
    };
    
    workLogs.forEach(log => {
      const date = new Date(log.work_date);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      
      // 旬の判定 (上=1, 中=2, 下=3)
      let period = '上';
      if (day > 10 && day <= 20) period = '中';
      else if (day > 20) period = '下';
      
      const monthPeriodKey = `${month}-${period}`;
      const rawType = log.work_type || 'その他';
      const mappedType = WORK_TYPE_MAP[rawType] || rawType;
      
      // 労働時間マトリックス (10a換算)
      const hours = (Number(log.duration_minutes) || 0) / 60 * m;
      
      if (!matrix[mappedType]) matrix[mappedType] = {};
      matrix[mappedType][monthPeriodKey] = (matrix[mappedType][monthPeriodKey] || 0) + hours;
      
      totals.months[monthPeriodKey] = (totals.months[monthPeriodKey] || 0) + hours;
      totals.total = (totals.total || 0) + hours;
      if (!totals.byType) totals.byType = {};
      totals.byType[mappedType] = (totals.byType[mappedType] || 0) + hours;
      
      // カレンダーマーク
      if (rawType.includes('播種')) marks[monthPeriodKey] = '○';
      else if (rawType.includes('定植')) marks[monthPeriodKey] = '◎';
      else if (rawType.includes('収穫')) marks[monthPeriodKey] = '■';
      
      // 経費計算 (10a換算しない。実際の使用量を表示して後で換算する)
      if (log.material_quantity && log.materials) {
        const cat = log.materials.category || '諸材料費';
        const costArray = calculatedCosts[cat] || calculatedCosts['諸材料費'];
        
        // 既存の資材かチェックしてまとめる
        const existing = costArray.find((c: any) => c.name === log.materials.name);
        if (existing) {
          existing.quantity += log.material_quantity;
          existing.amount += log.material_quantity * (log.materials.default_price || 0);
        } else {
          costArray.push({
            name: log.materials.name,
            specification: log.materials.specification || '',
            unit: log.materials.unit || '',
            price: log.materials.default_price || 0,
            quantity: log.material_quantity,
            amount: log.material_quantity * (log.materials.default_price || 0)
          });
        }
      }
    });
    
    // 売上計算 (10a換算)
    let totalYield = 0;
    let totalRevenue = 0;
    salesLogs.forEach(log => {
      totalYield += (Number(log.quantity) || 0);
      totalRevenue += (Number(log.total_sales) || 0);
    });
    
    setLaborMatrix(matrix);
    setLaborTotals(totals);
    setCalendarMarks(marks);
    setCosts(calculatedCosts);
    
    setSales({
      yield_10a: totalYield * m,
      revenue_10a: totalRevenue * m,
      unit_price: totalYield > 0 ? totalRevenue / totalYield : 0
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // 1〜12月の月配列
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const periods = ['上', '中', '下'];

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="bg-slate-100 min-h-screen pb-12">
      {/* 印刷時には非表示になるツールバー */}
      <div className="no-print bg-white border-b border-slate-200 p-4 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/cultivation-schedule" className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-slate-700">経営指標レポート出力</h1>
        </div>
        <button 
          onClick={handlePrint}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors"
        >
          <Printer className="w-5 h-5" />
          PDFとして保存・印刷
        </button>
      </div>

      {/* 印刷用領域 (A4横を想定) */}
      <div id="printable-report" className="bg-white mx-auto mt-8 shadow-lg p-8 text-sm" style={{ width: '100%', maxWidth: '297mm', minHeight: '210mm' }}>
        
        {/* スタイル定義 */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * { visibility: hidden; }
            #printable-report, #printable-report * { visibility: visible; }
            #printable-report { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; box-shadow: none; }
            @page { size: landscape; margin: 10mm; }
            .no-print { display: none !important; }
          }
          table { border-collapse: collapse; width: 100%; font-size: 11px; }
          th, td { border: 1px solid #333; padding: 2px 4px; text-align: center; }
          th { font-weight: bold; }
          .text-left { text-align: left; }
          .text-right { text-align: right; }
          .section-title { font-weight: bold; margin-top: 15px; margin-bottom: 5px; font-size: 12px; }
        `}} />

        <h2 className="text-xl font-bold mb-4 border-b border-black pb-1 flex justify-between items-end">
          <span>経営指標記入用紙【詳細レポート】</span>
          <span className="text-sm font-normal">出力日: {new Date().toLocaleDateString()}</span>
        </h2>

        {/* 基本情報 */}
        <table className="mb-4">
          <tbody>
            <tr>
              <th className="bg-slate-100 w-32">作目(品種)名</th>
              <td className="text-left font-bold">{planData?.crops?.name} {planData?.variety ? `(${planData.variety})` : ''}</td>
              <th className="bg-slate-100 w-32">圃場・作型</th>
              <td className="text-left">{planData?.fields?.name} / {planData?.start_month}月〜{planData?.end_month}月</td>
              <th className="bg-slate-100 w-24">作付面積</th>
              <td className="text-right">{areaSize} a</td>
            </tr>
            <tr>
              <th className="bg-slate-100">◆ 労働力</th>
              <td colSpan={5} className="text-left">
                自家労働：＿＿＿ 人、 雇用労働：＿＿＿ 人、 無給労働：＿＿＿ 人
              </td>
            </tr>
          </tbody>
        </table>

        {/* 旬別労働時間 */}
        <div className="section-title">◆ 旬別労働時間 (10aあたり / 単位：時間)</div>
        <table className="mb-4">
          <thead>
            <tr>
              <th rowSpan={2} className="w-24 bg-slate-100">作業名</th>
              {months.map(m => (
                <th colSpan={3} key={`m-${m}`} className="bg-slate-100">{m}月</th>
              ))}
              <th rowSpan={2} className="w-16 bg-slate-100">合計</th>
            </tr>
            <tr>
              {months.map(m => periods.map(p => (
                <th key={`p-${m}-${p}`} className="w-6 text-[10px] font-normal">{p}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(laborMatrix).length > 0 ? Object.keys(laborMatrix).map(work => (
              <tr key={work}>
                <td className="text-left font-bold">{work}</td>
                {months.map(m => periods.map(p => {
                  const key = `${m}-${p}`;
                  const val = laborMatrix[work][key];
                  return <td key={`d-${work}-${key}`}>{val ? val.toFixed(1) : ''}</td>;
                }))}
                <td className="text-right font-bold">{laborTotals.byType[work]?.toFixed(1) || ''}</td>
              </tr>
            )) : (
              <tr><td colSpan={38} className="text-slate-400 py-4">作業記録データがありません</td></tr>
            )}
            {/* 合計行 */}
            <tr className="bg-slate-50 font-bold">
              <td className="text-left">合　計</td>
              {months.map(m => periods.map(p => {
                const key = `${m}-${p}`;
                const val = laborTotals.months[key];
                return <td key={`sum-${key}`}>{val ? val.toFixed(1) : '0.0'}</td>;
              }))}
              <td className="text-right">{laborTotals.total?.toFixed(1) || '0.0'}</td>
            </tr>
          </tbody>
        </table>

        {/* 作付体系 (横幅いっぱい使うため、グリッドの外に配置) */}
        <div className="section-title">◆ 作付体系及び粗収益 (10aあたり)</div>
        <table className="mb-6">
          <thead>
            <tr>
              <th className="bg-slate-100">旬</th>
              {months.map(m => periods.map(p => (
                <th key={`c-${m}-${p}`} className="text-[9px] font-normal">{m}月{p}</th>
              )))}
              <th className="bg-slate-100 text-[10px]">備考</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="bg-slate-100 text-left">作付体系</td>
              {months.map(m => periods.map(p => (
                <td key={`mark-${m}-${p}`}>{calendarMarks[`${m}-${p}`] || ''}</td>
              )))}
              <td className="text-[10px] text-left leading-tight">○:播種<br/>◎:定植<br/>■:収穫</td>
            </tr>
          </tbody>
        </table>

        {/* 費用・売上の詳細 (3カラムレイアウトで配置) */}
        <div className="grid grid-cols-3 gap-6">
          {/* 左カラム */}
          <div className="space-y-6">
            <table>
              <tbody>
                <tr>
                  <th className="w-24 bg-slate-100 text-left">収量 (kg/10a)</th>
                  <td className="text-right font-bold">{Math.round(sales.yield_10a || 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <th className="w-24 bg-slate-100 text-left">単価 (円/kg)</th>
                  <td className="text-right">{Math.round(sales.unit_price || 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <th className="w-24 bg-slate-100 text-left">金額 (円/10a)</th>
                  <td className="text-right font-bold">{Math.round(sales.revenue_10a || 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div>
              <div className="section-title mt-0">◆ 種苗費 (10aあたり)</div>
              <table>
                <thead><tr className="bg-slate-100"><th>品名</th><th>数量</th><th>単価</th><th>金額</th></tr></thead>
                <tbody>
                  {costs['種苗費']?.map((c: any, i: number) => (
                    <tr key={i}>
                      <td className="text-left">{c.name}</td><td className="text-right">{(c.quantity * multiplier).toFixed(1)}{c.unit}</td><td className="text-right">{c.price}</td><td className="text-right">{Math.round(c.amount * multiplier).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!costs['種苗費'] || costs['種苗費'].length === 0) && [...Array(3)].map((_, i) => <tr key={`e1-${i}`}><td>&nbsp;</td><td></td><td></td><td></td></tr>)}
                  <tr className="bg-slate-50"><th className="text-left">合計</th><td colSpan={2}></td><td className="text-right font-bold">{Math.round(costs['種苗費']?.reduce((sum: number, c: any) => sum + c.amount * multiplier, 0) || 0).toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
            
            <div>
              <div className="section-title mt-0">◆ 農薬費 (10aあたり)</div>
              <table>
                <thead><tr className="bg-slate-100"><th>品名</th><th>規格</th><th>使用量</th><th>金額</th></tr></thead>
                <tbody>
                  {costs['農薬費']?.map((c: any, i: number) => (
                    <tr key={i}>
                      <td className="text-left">{c.name}</td><td>{c.specification}</td><td className="text-right">{(c.quantity * multiplier).toFixed(1)}{c.unit}</td><td className="text-right">{Math.round(c.amount * multiplier).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!costs['農薬費'] || costs['農薬費'].length === 0) && [...Array(3)].map((_, i) => <tr key={`e3-${i}`}><td>&nbsp;</td><td></td><td></td><td></td></tr>)}
                  <tr className="bg-slate-50"><th className="text-left">合計</th><td colSpan={2}></td><td className="text-right font-bold">{Math.round(costs['農薬費']?.reduce((sum: number, c: any) => sum + c.amount * multiplier, 0) || 0).toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 中央カラム */}
          <div className="space-y-6">
            <div>
              <div className="section-title mt-0">◆ 肥料費 (10aあたり)</div>
              <table>
                <thead><tr className="bg-slate-100"><th>品名</th><th>使用量</th><th>規格</th><th>価格</th><th>金額</th></tr></thead>
                <tbody>
                  {costs['肥料費']?.map((c: any, i: number) => (
                    <tr key={i}>
                      <td className="text-left">{c.name}</td><td className="text-right">{(c.quantity * multiplier).toFixed(1)}{c.unit}</td><td>{c.specification}</td><td className="text-right">{c.price}</td><td className="text-right">{Math.round(c.amount * multiplier).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!costs['肥料費'] || costs['肥料費'].length === 0) && [...Array(4)].map((_, i) => <tr key={`e2-${i}`}><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>)}
                  <tr className="bg-slate-50"><th className="text-left">合計</th><td colSpan={3}></td><td className="text-right font-bold">{Math.round(costs['肥料費']?.reduce((sum: number, c: any) => sum + c.amount * multiplier, 0) || 0).toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
            
            <div>
              <div className="section-title mt-0">◆ その他諸材料費 (10aあたり)</div>
              <table>
                <thead><tr className="bg-slate-100"><th>品名</th><th>規格</th><th>数量</th><th>金額</th></tr></thead>
                <tbody>
                  {costs['諸材料費']?.map((c: any, i: number) => (
                    <tr key={i}>
                      <td className="text-left">{c.name}</td><td>{c.specification}</td><td className="text-right">{(c.quantity * multiplier).toFixed(1)}{c.unit}</td><td className="text-right">{Math.round(c.amount * multiplier).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!costs['諸材料費'] || costs['諸材料費'].length === 0) && [...Array(3)].map((_, i) => <tr key={`e4-${i}`}><td>&nbsp;</td><td></td><td></td><td></td></tr>)}
                  <tr className="bg-slate-50"><th className="text-left">合計</th><td colSpan={2}></td><td className="text-right font-bold">{Math.round(costs['諸材料費']?.reduce((sum: number, c: any) => sum + c.amount * multiplier, 0) || 0).toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 右カラム */}
          <div className="space-y-6">
            <div>
              <div className="section-title mt-0">◆ 動力光熱費 (10aあたり)</div>
              <table>
                <thead><tr className="bg-slate-100"><th>品名</th><th>数量</th><th>金額</th></tr></thead>
                <tbody>
                  {costs['動力光熱費']?.map((c: any, i: number) => (
                    <tr key={i}>
                      <td className="text-left">{c.name}</td><td className="text-right">{(c.quantity * multiplier).toFixed(1)}{c.unit}</td><td className="text-right">{Math.round(c.amount * multiplier).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!costs['動力光熱費'] || costs['動力光熱費'].length === 0) && [...Array(3)].map((_, i) => <tr key={`e5-${i}`}><td>&nbsp;</td><td></td><td></td></tr>)}
                  <tr className="bg-slate-50"><th className="text-left">合計</th><td></td><td className="text-right font-bold">{Math.round(costs['動力光熱費']?.reduce((sum: number, c: any) => sum + c.amount * multiplier, 0) || 0).toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>

            <div>
              <div className="section-title mt-0">◇ 直接経費 (10aあたり合計)</div>
              <table>
                <thead>
                  <tr className="bg-slate-100"><th>費目</th><th>金額 (円)</th></tr>
                </thead>
                <tbody>
                  <tr><td className="text-left font-medium">種苗費</td><td className="text-right">{Math.round(costs['種苗費']?.reduce((sum: number, c: any) => sum + c.amount * multiplier, 0) || 0).toLocaleString()}</td></tr>
                  <tr><td className="text-left font-medium">肥料費</td><td className="text-right">{Math.round(costs['肥料費']?.reduce((sum: number, c: any) => sum + c.amount * multiplier, 0) || 0).toLocaleString()}</td></tr>
                  <tr><td className="text-left font-medium">農薬費</td><td className="text-right">{Math.round(costs['農薬費']?.reduce((sum: number, c: any) => sum + c.amount * multiplier, 0) || 0).toLocaleString()}</td></tr>
                  <tr><td className="text-left font-medium">動力光熱費</td><td className="text-right">{Math.round(costs['動力光熱費']?.reduce((sum: number, c: any) => sum + c.amount * multiplier, 0) || 0).toLocaleString()}</td></tr>
                  <tr><td className="text-left font-medium">その他諸材料費</td><td className="text-right">{Math.round(costs['諸材料費']?.reduce((sum: number, c: any) => sum + c.amount * multiplier, 0) || 0).toLocaleString()}</td></tr>
                  <tr><td className="text-left font-medium">機械・車両費 (参考)</td><td className="text-right">{Math.round(costs['機械・車両費']?.reduce((sum: number, c: any) => sum + c.amount * multiplier, 0) || 0).toLocaleString()}</td></tr>
                  <tr><td className="text-left font-medium">その他経費</td><td className="text-right">{Math.round(costs['その他経費']?.reduce((sum: number, c: any) => sum + c.amount * multiplier, 0) || 0).toLocaleString()}</td></tr>
                  <tr className="bg-slate-100">
                    <th className="text-left">合 計</th>
                    <td className="text-right font-black">
                      {Math.round(
                        Object.keys(costs).reduce((total, cat) => 
                          total + costs[cat].reduce((sum: number, c: any) => sum + c.amount * multiplier, 0)
                        , 0)
                      ).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="text-[10px] text-slate-500 mt-1 text-right">※減価償却費等の固定費は除外しています</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
