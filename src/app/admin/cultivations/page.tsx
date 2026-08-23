"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sprout, 
  MapPin, 
  Calendar, 
  Search, 
  List, 
  Map as MapIcon, 
  CheckSquare, 
  Square, 
  Loader2, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  ChevronRight,
  Folder
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CultivationActionSheet, CultivationTarget } from '@/components/CultivationActionSheet';
import Link from 'next/link';

interface CultivationItem {
  id: string;
  fieldId: string;
  fieldName: string;
  cropId: string;
  cropName: string;
  areaAcre: number;
  startDate: string;
  status: string;
}

export default function CultivationsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [cultivations, setCultivations] = useState<CultivationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // データ取得
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. 圃場マスタと作目マスタ、栽培計画を取得
      const [fieldsRes, cropsRes, plansRes] = await Promise.all([
        supabase.from('fields').select('*').order('name'),
        supabase.from('crops').select('*').order('name'),
        supabase.from('cultivation_plans_v2').select('*, crops(*)').order('created_at', { ascending: false })
      ]);

      const fields = fieldsRes.data || [];
      const crops = cropsRes.data || [];
      const plans = plansRes.data || [];

      const list: CultivationItem[] = [];

      // 栽培計画(plans)がある場合はそれを優先して作付けとして展開
      if (plans.length > 0) {
        plans.forEach((p: any) => {
          const matchedField = fields.find(f => f.id === p.field_id);
          const matchedCrop = p.crops || crops.find(c => c.id === p.crop_id);
          
          // 面積 (a換算: sqm / 100)
          const areaSqm = matchedField?.area_sqm || matchedField?.area_size || 0;
          const areaAcre = areaSqm > 0 ? Math.round((areaSqm / 100) * 10) / 10 : 10.0;
          
          const startMonth = p.start_month || 8;
          const year = p.year || new Date().getFullYear();

          list.push({
            id: p.id,
            fieldId: p.field_id,
            fieldName: matchedField?.name || '指定なし圃場',
            cropId: p.crop_id,
            cropName: matchedCrop?.name || p.variety || '作目未設定',
            areaAcre: areaAcre,
            startDate: `${year}年 ${startMonth}月〜`,
            status: 'cultivating'
          });
        });
      }

      // 計画データがない圃場も作付け候補として表示
      fields.forEach((f: any) => {
        const alreadyAdded = list.some(item => item.fieldId === f.id);
        if (!alreadyAdded) {
          const areaSqm = f.area_sqm || f.area_size || 0;
          const areaAcre = areaSqm > 0 ? Math.round((areaSqm / 100) * 10) / 10 : 10.0;
          const defaultCrop = crops[0];

          list.push({
            id: `field-${f.id}`,
            fieldId: f.id,
            fieldName: f.name,
            cropId: defaultCrop?.id || '',
            cropName: defaultCrop?.name || '現在作付中',
            areaAcre: areaAcre,
            startDate: `${new Date().getFullYear()}年 8月〜`,
            status: 'active'
          });
        }
      });

      setCultivations(list);
    } catch (err) {
      console.error('Error fetching cultivations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // トースト通知の自動非表示
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // 検索フィルタリング
  const filteredCultivations = useMemo(() => {
    if (!searchQuery.trim()) return cultivations;
    const q = searchQuery.toLowerCase();
    return cultivations.filter(
      c => c.cropName.toLowerCase().includes(q) || c.fieldName.toLowerCase().includes(q)
    );
  }, [cultivations, searchQuery]);

  // チェックボックス操作
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // 全選択 / 全解除
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredCultivations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCultivations.map(c => c.id));
    }
  };

  // 選択中の作付けオブジェクト配列
  const selectedTargets: CultivationTarget[] = useMemo(() => {
    return cultivations
      .filter(c => selectedIds.includes(c.id))
      .map(c => ({
        id: c.id,
        fieldId: c.fieldId,
        fieldName: c.fieldName,
        cropId: c.cropId,
        cropName: c.cropName,
        areaAcre: c.areaAcre,
        startDate: c.startDate
      }));
  }, [cultivations, selectedIds]);

  const handleSuccess = (msg: string) => {
    setToastMessage(msg);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-40">
      
      {/* 画面上部ヘッダー */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:px-6">
          
          {/* タイトル ＆ 表示切り替えタブ */}
          <div className="flex items-center justify-between gap-4 mb-3">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Sprout className="w-5 h-5 text-emerald-600" />
              <span>作付け一覧</span>
            </h1>

            {/* リスト / 地図 タブ */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-emerald-700 shadow-xs"
              >
                <List className="w-3.5 h-3.5" />
                <span>リスト</span>
              </button>
              <Link
                href="/admin/map"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>地図</span>
              </Link>
            </div>
          </div>

          {/* 検索バー */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="作目や圃場名で検索..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition-all"
            />
          </div>

          {/* 全て選択 & ガイドメッセージ */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleToggleSelectAll}
              className="px-3 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              {selectedIds.length === filteredCultivations.length && filteredCultivations.length > 0 ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>全選択を解除</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                  <span>全て選択</span>
                </>
              )}
            </button>

            <span className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1">
              <CheckSquare className="w-3 h-3 text-emerald-600" />
              チェックした作付けに、まとめて日誌を登録できます
            </span>
          </div>

        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6">
        
        {/* トースト通知 */}
        {toastMessage && (
          <div className="mb-4 p-3.5 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center gap-2.5 text-sm font-bold animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ローディング表示 */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-emerald-600" />
            <p className="text-xs font-bold">作付けデータを読み込み中...</p>
          </div>
        ) : filteredCultivations.length === 0 ? (
          /* データなし表示 */
          <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
            <Sprout className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700 mb-1">作付けデータが見つかりません</h3>
            <p className="text-xs text-slate-400 mb-4">圃場や栽培計画を登録すると、ここに作付け一覧が表示されます。</p>
            <Link
              href="/admin/cultivation-schedule"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>栽培計画を登録する</span>
            </Link>
          </div>
        ) : (
          /* 作付けカードリスト */
          <div className="space-y-2.5">
            {filteredCultivations.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => handleToggleSelect(item.id)}
                  className={`relative flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-500 shadow-sm ring-1 ring-emerald-500'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
                  }`}
                >
                  {/* 左側：フォルダアイコンと作目名・作期 */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isSelected ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}>
                      <Folder className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {item.cropName}
                      </h4>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {item.startDate}
                      </p>
                    </div>
                  </div>

                  {/* 右側：圃場名・面積・チェックボックス */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-800 flex items-center justify-end gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.fieldName}</span>
                      </div>
                      <div className="text-xs text-slate-500 font-semibold mt-0.5">
                        {item.areaAcre.toFixed(1)} a
                      </div>
                    </div>

                    {/* チェックボックス */}
                    <div className="pl-2">
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* 7大アクション・ボトムシート */}
      <CultivationActionSheet
        selectedCultivations={selectedTargets}
        onClearSelection={() => setSelectedIds([])}
        onSuccess={handleSuccess}
      />

    </div>
  );
}
