"use client";

import React, { useState, useMemo, useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Calendar, 
  Filter, 
  FileText, 
  Building, 
  ShieldCheck,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';
import { getJSTDate } from '@/lib/dateUtils';

interface WorkLog {
  id: string;
  work_date: string;
  work_type: string;
  duration_minutes: number;
  memo?: string;
  crop_id?: string;
  field_id?: string;
  worker_id?: string;
  crops?: { id: string; name: string };
  fields?: { id: string; name: string; area_size?: number };
  workers?: { id: string; name: string };
}

interface PesticideLogReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workLogs: WorkLog[];
  crops: { id: string; name: string }[];
  fields: { id: string; name: string; area_size?: number }[];
  companyName: string;
}

export function PesticideLogReportModal({
  isOpen,
  onClose,
  workLogs,
  crops,
  fields,
  companyName
}: PesticideLogReportModalProps) {
  // 期間・絞り込みフィルター
  const [selectedCropId, setSelectedCropId] = useState<string>('all');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => getJSTDate());

  // 印刷用Ref
  const printAreaRef = useRef<HTMLDivElement>(null);

  // 散布ログのみ抽出し、パースして構造化
  const sprayRecords = useMemo(() => {
    return workLogs
      .filter(log => {
        // 散布ログの判定
        const isSpray = log.work_type?.includes('農薬') || 
                        log.work_type?.includes('防除') || 
                        log.work_type?.includes('散布') ||
                        log.memo?.includes('[散布管理]') || 
                        log.memo?.includes('農薬:');
        if (!isSpray) return false;

        // 期間フィルター
        if (startDate && log.work_date < startDate) return false;
        if (endDate && log.work_date > endDate) return false;

        // 作物フィルター
        if (selectedCropId !== 'all' && log.crop_id !== selectedCropId) return false;

        // 圃場フィルター
        if (selectedFieldId !== 'all' && log.field_id !== selectedFieldId) return false;

        return true;
      })
      .map(log => {
        const memo = log.memo || '';
        
        // メモから農薬名、希釈倍率、散布液量、対象病害虫を抽出
        // 例: "[散布管理] 農薬:アファーム乳剤(2000倍) 水量:100L 対象:オオタバコガ"
        let pesticideName = '農薬';
        let dilution = '-';
        let waterVolume = '-';
        let targetPest = '-';

        const nameMatch = memo.match(/農薬:([^\(\s,]+)/);
        if (nameMatch) pesticideName = nameMatch[1];

        const dilMatch = memo.match(/\(([^\)]+倍?)\)/) || memo.match(/希釈:?([^\s,]+)/);
        if (dilMatch) dilution = dilMatch[1];

        const volMatch = memo.match(/水量:?([^\s,]+)/) || memo.match(/(\d+L)/);
        if (volMatch) waterVolume = volMatch[1];

        const pestMatch = memo.match(/対象:?([^\s,]+)/) || memo.match(/防除:?([^\s,]+)/);
        if (pestMatch) targetPest = pestMatch[1];

        // もしパースできずそのままの場合、メモから補完
        if (pesticideName === '農薬' && memo) {
          const parts = memo.replace('[散布管理]', '').trim().split(' ');
          if (parts[0]) pesticideName = parts[0];
        }

        return {
          id: log.id,
          date: log.work_date,
          fieldName: log.fields?.name || '指定なし',
          areaSize: log.fields?.area_size ? `${log.fields.area_size}a` : '-',
          cropName: log.crops?.name || '指定なし',
          pesticideName,
          targetPest,
          dilution,
          waterVolume,
          workerName: log.workers?.name || '担当者',
          memo: memo.replace(/\[散布管理\]|農薬:[^\s]+|水量:[^\s]+|対象:[^\s]+/g, '').trim()
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [workLogs, startDate, endDate, selectedCropId, selectedFieldId]);

  // 同一農薬の累積散布回数を計算
  const recordsWithCumulative = useMemo(() => {
    const counts: { [pesticide: string]: number } = {};
    return sprayRecords.map(rec => {
      counts[rec.pesticideName] = (counts[rec.pesticideName] || 0) + 1;
      return {
        ...rec,
        cumulativeCount: counts[rec.pesticideName]
      };
    });
  }, [sprayRecords]);

  // 印刷ハンドラー
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden print:max-h-none print:border-none print:shadow-none print:rounded-none">
        
        {/* モーダルヘッダー（印刷時は非表示） */}
        <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-xs">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800">
                📑 公的防除日誌（農薬使用台帳）出力
              </h2>
              <p className="text-xs text-slate-500 font-bold">
                農協（JA）・農業改良普及センター・GAP認証の公的提出規格（A4横）プレビュー
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>A4横で印刷 / PDF保存</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 絞り込みフィルターバー（印刷時は非表示） */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs font-bold print:hidden">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>絞り込み:</span>
          </div>

          {/* 期間 */}
          <div className="flex items-center gap-1.5">
            <input 
              type="date" 
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none"
            />
            <span className="text-slate-400">〜</span>
            <input 
              type="date" 
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none"
            />
          </div>

          {/* 作物 */}
          <select
            value={selectedCropId}
            onChange={e => setSelectedCropId(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none"
          >
            <option value="all">すべての作物</option>
            {crops.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* 圃場 */}
          <select
            value={selectedFieldId}
            onChange={e => setSelectedFieldId(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none"
          >
            <option value="all">すべての圃場</option>
            {fields.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          <span className="text-slate-400 ml-auto">
            該当件数: <strong className="text-emerald-700 font-black">{recordsWithCumulative.length}</strong> 件
          </span>
        </div>

        {/* 帳票印刷領域（A4横規格） */}
        <div ref={printAreaRef} className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 print:p-0 print:bg-white print:overflow-visible">
          <div className="max-w-[297mm] mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 print:max-w-none">
            
            {/* 帳票タイトル */}
            <div className="border-b-2 border-slate-800 pb-3 mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-wider">
                  病害虫防除日誌・農薬使用台帳
                </h1>
                <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                  ※農薬取締法およびGAP適正農業規範に基づく公的記録簿
                </p>
              </div>

              {/* 事業所・管理者情報 */}
              <div className="text-right text-xs text-slate-700 space-y-0.5">
                <div>農園名: <strong className="font-bold text-slate-900">{companyName || '佐原農園'}</strong></div>
                <div>作成日: {getJSTDate()}</div>
                <div>記録対象期間: {startDate || '指定なし'} 〜 {endDate || '指定なし'}</div>
              </div>
            </div>

            {/* 帳票テーブル */}
            {recordsWithCumulative.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-bold">
                指定された期間・条件の散布記録がありません。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-800 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-black border-b border-slate-800">
                      <th className="border border-slate-400 p-2 text-center w-12">No.</th>
                      <th className="border border-slate-400 p-2 w-24">散布年月日</th>
                      <th className="border border-slate-400 p-2 w-28">対象圃場</th>
                      <th className="border border-slate-400 p-2 w-24">作物名</th>
                      <th className="border border-slate-400 p-2">使用農薬名</th>
                      <th className="border border-slate-400 p-2 w-28">対象病害虫</th>
                      <th className="border border-slate-400 p-2 text-center w-20">希釈倍率</th>
                      <th className="border border-slate-400 p-2 text-center w-20">散布液量</th>
                      <th className="border border-slate-400 p-2 text-center w-16">当期累計</th>
                      <th className="border border-slate-400 p-2 w-20 text-center">散布者</th>
                      <th className="border border-slate-400 p-2 w-28">備考・確認</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordsWithCumulative.map((rec, index) => (
                      <tr key={rec.id} className="border-b border-slate-300 hover:bg-slate-50 print:hover:bg-transparent">
                        <td className="border border-slate-300 p-2 text-center font-bold text-slate-500">
                          {index + 1}
                        </td>
                        <td className="border border-slate-300 p-2 font-bold text-slate-900 whitespace-nowrap">
                          {rec.date}
                        </td>
                        <td className="border border-slate-300 p-2 font-bold text-slate-800">
                          {rec.fieldName}
                        </td>
                        <td className="border border-slate-300 p-2 font-bold text-emerald-800">
                          {rec.cropName}
                        </td>
                        <td className="border border-slate-300 p-2 font-black text-slate-900">
                          {rec.pesticideName}
                        </td>
                        <td className="border border-slate-300 p-2 text-slate-700">
                          {rec.targetPest}
                        </td>
                        <td className="border border-slate-300 p-2 text-center font-bold text-slate-800 whitespace-nowrap">
                          {rec.dilution}
                        </td>
                        <td className="border border-slate-300 p-2 text-center font-bold text-slate-800 whitespace-nowrap">
                          {rec.waterVolume}
                        </td>
                        <td className="border border-slate-300 p-2 text-center font-black text-rose-700 bg-rose-50/50">
                          {rec.cumulativeCount}回目
                        </td>
                        <td className="border border-slate-300 p-2 text-center font-bold text-slate-800">
                          {rec.workerName}
                        </td>
                        <td className="border border-slate-300 p-2 text-slate-600 text-[10px]">
                          {rec.memo || '適合確認済'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 帳票フッター・署名捺印枠 */}
            <div className="mt-6 pt-4 border-t border-slate-300 flex flex-col sm:flex-row items-end justify-between gap-4 text-xs text-slate-600">
              <div className="space-y-1">
                <p>【確認事項】上記散布において、使用時期（収穫前日数）および総使用回数に違反がないことを確認いたしました。</p>
                <p className="text-[10px] text-slate-400">※本台帳は農薬取締法第13条に基づき、作期終了後3年間の保管が推奨されます。</p>
              </div>

              {/* 押印欄 */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="border border-slate-400 rounded-lg p-2 text-center w-24">
                  <div className="text-[9px] text-slate-400 mb-6">防除責任者</div>
                  <div className="text-[10px] text-slate-300">㊞</div>
                </div>
                <div className="border border-slate-400 rounded-lg p-2 text-center w-24">
                  <div className="text-[9px] text-slate-400 mb-6">農園統括者</div>
                  <div className="text-[10px] text-slate-300">㊞</div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* 印刷専用CSS */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          /* モーダル外のすべての要素を印刷対象外にする */
          body > *:not(.fixed) {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
