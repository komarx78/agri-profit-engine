"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Link as LinkIcon,
  Edit2,
  Trash2,
  Search,
  Loader2,
  CheckCircle2,
  Phone,
  MapPin,
  FileText,
  ExternalLink,
  MessageSquare,
  Banknote,
  ShoppingCart,
  Sprout,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import {
  getB2BCustomers,
  createB2BCustomer,
  updateB2BCustomer,
  deleteB2BCustomer,
  saveCustomerCropPricesAction,
  saveCropDefaultSalesPricesAction
} from '@/app/actions/b2b';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';

export default function CustomersPage() {
  const [tenantId, setTenantId] = useState<string>('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [cropDefaultPrices, setCropDefaultPrices] = useState<
    Record<string, { unit_price: number; unit: string }>
  >({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 農園全体の野菜基本単価パネルの開閉
  const [showDefaultPricesPanel, setShowDefaultPricesPanel] = useState(false);
  const [isSavingDefaultPrices, setIsSavingDefaultPrices] = useState(false);

  // 得意先の登録・編集モーダル用
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: '飲食店',
    phone: '',
    contact_person: '',
    address: '',
    notes: '',
    closing_day: 31,
    payment_month: 1,
    payment_day: 31
  });

  // 得意先ごとの「野菜別卸単価・単位設定」モーダル用
  const [pricingCustomer, setPricingCustomer] = useState<any | null>(null);
  const [editingCustomPrices, setEditingCustomPrices] = useState<
    Record<string, { unit_price: number; unit: string; enabled: boolean }>
  >({});
  const [isSavingCustomerPrices, setIsSavingCustomerPrices] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(prev => (prev === msg ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const tid = await getCurrentTenantId();
      if (tid) setTenantId(tid);

      const [custRes, cropRes] = await Promise.all([
        getB2BCustomers(tid),
        tid
          ? supabase.from('crops').select('*').eq('user_id', tid).order('name')
          : Promise.resolve({ data: [] })
      ]);

      if (custRes.success) {
        setCustomers(custRes.customers || []);
        setCropDefaultPrices((custRes as any).cropDefaultPrices || {});
      }
      if (cropRes.data) {
        setCrops(cropRes.data);
      }
    } finally {
      setLoading(false);
    }
  }

  // 新規追加モーダルを開く
  const handleOpenCreateModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      type: '飲食店',
      phone: '',
      contact_person: '',
      address: '',
      notes: '',
      closing_day: 31,
      payment_month: 1,
      payment_day: 31
    });
    setShowModal(true);
  };

  // 編集モーダルを開く
  const handleOpenEditModal = (c: any) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name || '',
      type: c.type || '飲食店',
      phone: c.phone || '',
      contact_person: c.contact_person || '',
      address: c.address || '',
      notes: c.notes || '',
      closing_day: c.closing_day !== undefined ? Number(c.closing_day) : 31,
      payment_month: c.payment_month !== undefined ? Number(c.payment_month) : 1,
      payment_day: c.payment_day !== undefined ? Number(c.payment_day) : 31
    });
    setShowModal(true);
  };

  // 得意先ごとの卸単価設定モーダルを開く
  const handleOpenPricingModal = (c: any) => {
    setPricingCustomer(c);
    const currentCustom = c.custom_prices || {};
    const initialMap: Record<string, { unit_price: number; unit: string; enabled: boolean }> = {};
    crops.forEach(crop => {
      const cp = currentCustom[crop.id];
      const dp = cropDefaultPrices[crop.id];
      initialMap[crop.id] = {
        unit_price:
          cp?.unit_price !== undefined
            ? Number(cp.unit_price)
            : dp?.unit_price !== undefined
            ? Number(dp.unit_price)
            : 0,
        unit: cp?.unit || dp?.unit || crop.default_unit || 'kg',
        enabled: cp?.enabled !== false
      };
    });
    setEditingCustomPrices(initialMap);
  };

  // 得意先ごとの卸単価を保存
  const handleSaveCustomerPrices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricingCustomer) return;
    setIsSavingCustomerPrices(true);
    try {
      const res = await saveCustomerCropPricesAction(pricingCustomer.id, editingCustomPrices, tenantId);
      if (res.success) {
        setCustomers(prev =>
          prev.map(c => (c.id === pricingCustomer.id ? { ...c, custom_prices: editingCustomPrices } : c))
        );
        setPricingCustomer(null);
        showToast(`「${pricingCustomer.name}」の野菜別卸単価を保存しました！`);
      } else {
        alert('保存エラー: ' + res.error);
      }
    } finally {
      setIsSavingCustomerPrices(false);
    }
  };

  // 農園全体の野菜基本単価を保存
  const handleSaveDefaultPrices = async () => {
    setIsSavingDefaultPrices(true);
    try {
      const res = await saveCropDefaultSalesPricesAction(cropDefaultPrices, tenantId);
      if (res.success) {
        showToast('野菜の基本販売単価・単位を保存しました！');
        setShowDefaultPricesPanel(false);
      } else {
        alert('保存エラー: ' + res.error);
      }
    } finally {
      setIsSavingDefaultPrices(false);
    }
  };

  // 保存処理 (新規 / 更新)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.name.trim()) {
      alert('得意先名（お店の名前・屋号）を入力してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      const currentTid = tenantId || (await getCurrentTenantId());
      if (editingCustomer) {
        const res = await updateB2BCustomer(editingCustomer.id, formData, currentTid);
        if (res.success) {
          setShowModal(false);
          await loadData();
          showToast(`「${formData.name}」の情報を更新しました！`);
        } else {
          alert('更新エラー: ' + res.error);
        }
      } else {
        const token = Math.random().toString(36).substring(2, 11);
        const res = await createB2BCustomer(
          {
            ...formData,
            order_token: token,
            user_id: currentTid
          },
          currentTid
        );

        if (res.success) {
          setShowModal(false);
          await loadData();
          showToast(`新しい得意先「${formData.name}」を登録しました！`);
        } else {
          alert('登録エラー: ' + res.error);
        }
      }
    } catch (err: any) {
      alert('通信エラーが発生しました: ' + (err.message || '不明なエラー'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 削除処理
  const handleDelete = async (c: any) => {
    if (!window.confirm(`得意先「${c.name}」を削除しますか？\n（※この操作は取り消せません）`)) return;

    setDeletingId(c.id);
    try {
      const currentTid = tenantId || (await getCurrentTenantId());
      const res = await deleteB2BCustomer(c.id, currentTid);
      if (res.success) {
        await loadData();
        showToast(`「${c.name}」を削除しました。`);
      } else {
        alert('削除できませんでした: ' + res.error);
      }
    } catch (err: any) {
      alert('削除中にエラーが発生しました: ' + (err.message || '不明なエラー'));
    } finally {
      setDeletingId(null);
    }
  };

  // 発注用URLのみコピー
  const copyLinkOnly = (c: any) => {
    const tokenOrId = c.order_token || c.id;
    const url = `${window.location.origin}/b2b-order/${tokenOrId}`;
    navigator.clipboard.writeText(url);
    showToast(`「${c.name}」専用の発注URLをコピーしました！`);
  };

  // LINE・メール用の丁寧な案内文＋URLをコピー
  const copyLineInviteMessage = (c: any) => {
    const tokenOrId = c.order_token || c.id;
    const url = `${window.location.origin}/b2b-order/${tokenOrId}`;
    const msg = `${c.name} 様\nいつもお世話になっております。\n\n下記のお客様専用ページより、スマートフォンやパソコンから24時間いつでも簡単にご注文・過去の請求書確認が可能です。\n（ブックマークしてご利用ください）\n\n▼ ${c.name}様 専用ご注文ページ\n${url}`;
    navigator.clipboard.writeText(msg);
    showToast(`LINE・メール用の案内文とURLをコピーしました！そのまま貼り付けて送れます。`);
  };

  // リアルタイム検索フィルター
  const filteredCustomers = customers.filter(c => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.type && c.type.toLowerCase().includes(term)) ||
      (c.phone && c.phone.toLowerCase().includes(term)) ||
      (c.address && c.address.toLowerCase().includes(term)) ||
      (c.contact_person && c.contact_person.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative">
      {/* トースト通知 */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-sm font-black">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2.5">
            <Users className="w-7 h-7 text-blue-600" />
            <span>得意先（お店・出荷先）と卸単価の設定</span>
          </h1>
          <p className="text-xs sm:text-sm font-bold text-slate-500 mt-1">
            飲食店・スーパー・直売所などの連絡先、お店ごとの野菜の卸値（単価）、スマホで注文してもらえる専用URLを1画面で管理します。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDefaultPricesPanel(prev => !prev)}
            className="bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-black py-2.5 px-4 rounded-xl transition-all flex items-center gap-1.5 text-xs shadow-2xs cursor-pointer"
          >
            <Sprout className="w-4 h-4 text-emerald-600" />
            <span>野菜の基本単価（全店共通の目安）を設定</span>
            {showDefaultPricesPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black py-2.5 px-5 rounded-xl transition-all flex items-center gap-2 text-xs sm:text-sm shadow-sm shrink-0 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>＋ 新しい得意先を登録</span>
          </button>
        </div>
      </div>

      {/* 2. 農園の「野菜ごとの基本販売単価・単位」設定パネル（開閉式） */}
      {showDefaultPricesPanel && (
        <div className="bg-emerald-50/80 border-2 border-emerald-200 rounded-3xl p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-3">
            <div>
              <h2 className="text-base font-black text-emerald-950 flex items-center gap-2">
                <Sprout className="w-5 h-5 text-emerald-600" />
                <span>🌱 うちの野菜の基本販売単価・単位（全店共通の初期値）</span>
              </h2>
              <p className="text-xs font-bold text-emerald-800 mt-0.5">
                ここで「基本の単価と単位（例：キャベツ 1箱 1,500円）」を決めておくと、すべてのお店への注文で自動的にこの単価が初期表示されます。（※お店ごとに違う値段にしたい場合は、下の各お店の「💰 卸単価を設定」から個別に変えられます）
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveDefaultPrices}
              disabled={isSavingDefaultPrices}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shrink-0 shadow-xs cursor-pointer"
            >
              {isSavingDefaultPrices ? '保存中...' : '✓ 基本単価を保存する'}
            </button>
          </div>

          {crops.length === 0 ? (
            <p className="text-xs font-bold text-slate-500">
              まだ作目が登録されていません。農業司令塔の「マスタ設定」から栽培する野菜を登録してください。
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {crops.map(crop => {
                const entry = cropDefaultPrices[crop.id] || {
                  unit_price: Number(crop.default_unit_price) || 0,
                  unit: crop.default_unit || 'kg'
                };
                return (
                  <div
                    key={crop.id}
                    className="bg-white p-3 rounded-2xl border border-emerald-200 flex items-center justify-between gap-2"
                  >
                    <span className="font-black text-slate-800 text-sm truncate">🌱 {crop.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-bold text-slate-400">1</span>
                      <input
                        type="text"
                        value={entry.unit}
                        onChange={e =>
                          setCropDefaultPrices(prev => ({
                            ...prev,
                            [crop.id]: { ...entry, unit: e.target.value }
                          }))
                        }
                        placeholder="kg/箱/袋"
                        className="w-14 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs font-black text-slate-800"
                      />
                      <span className="text-xs font-bold text-slate-400">あたり ¥</span>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={entry.unit_price || ''}
                        placeholder="単価"
                        onChange={e =>
                          setCropDefaultPrices(prev => ({
                            ...prev,
                            [crop.id]: { ...entry, unit_price: Number(e.target.value) || 0 }
                          }))
                        }
                        className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right text-xs font-black text-slate-800"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. 検索・フィルター */}
      <div className="bg-white p-3 px-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="お店の名前・電話番号・配達先住所・取引タイプで検索..."
          className="bg-transparent border-none focus:outline-none text-slate-800 font-bold w-full text-sm placeholder:text-slate-400"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2.5 py-1 bg-slate-100 rounded-lg cursor-pointer"
          >
            クリア
          </button>
        )}
      </div>

      {/* 4. 得意先一覧（連絡先・卸単価・注文ボタン・専用URLプレビュー完備） */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 font-bold">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
            <span>得意先データを読み込んでいます...</span>
          </div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
          <Users className="w-10 h-10 text-slate-400 mx-auto" />
          <div className="font-black text-slate-700 text-base">
            {search ? '該当する得意先が見つかりませんでした。' : 'まだ得意先（お店・出荷先）が登録されていません。'}
          </div>
          <p className="text-xs font-bold text-slate-500">
            右上の「＋ 新しい得意先を登録」ボタンから、飲食店やスーパー・直売所を登録してください。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCustomers.map(c => {
            const customPrices = c.custom_prices || {};
            const tokenOrId = c.order_token || c.id;
            const orderNewHref = tenantId
              ? `/sales-management/orders/new?customerId=${c.id}&farm=${tenantId}`
              : `/sales-management/orders/new?customerId=${c.id}`;

            // 表示用の単価サマリータグを作成
            const priceBadges = crops
              .map(crop => {
                const cp = customPrices[crop.id];
                const dp = cropDefaultPrices[crop.id];
                if (cp?.enabled === false) return null;
                const price =
                  cp?.unit_price !== undefined && Number(cp.unit_price) > 0
                    ? Number(cp.unit_price)
                    : dp?.unit_price !== undefined && Number(dp.unit_price) > 0
                    ? Number(dp.unit_price)
                    : 0;
                const unit = cp?.unit || dp?.unit || crop.default_unit || 'kg';
                const isCustom = cp?.unit_price !== undefined && Number(cp.unit_price) > 0;
                return { cropName: crop.name, price, unit, isCustom };
              })
              .filter(Boolean) as Array<{ cropName: string; price: number; unit: string; isCustom: boolean }>;

            return (
              <div
                key={c.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 hover:border-slate-300 transition-all space-y-4"
              >
                {/* 上段：店名・区分・支払条件 ＋ 即時アクション（注文を入れる / 編集 / 削除） */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-black">
                        {c.type || '飲食店'}
                      </span>
                      <h3 className="text-lg sm:text-xl font-black text-slate-900">{c.name}</h3>

                      {/* 支払条件バッジ */}
                      {c.payment_day === 0 || c.closing_day === 0 ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-xs font-black">
                          💵 当日現金払い（都度）
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg text-xs font-bold border border-slate-200">
                          🧾 {c.closing_day === 31 ? '月末' : `${c.closing_day}日`}締め ➔{' '}
                          {c.payment_month === 0 ? '当月' : c.payment_month === 1 ? '翌月' : '翌々月'}
                          {c.payment_day === 31 ? '末' : `${c.payment_day}日`}払い
                        </span>
                      )}
                    </div>

                    {/* 電話番号・担当者・住所・配達メモ */}
                    <div className="flex items-center gap-4 flex-wrap text-xs font-bold text-slate-600 pt-0.5">
                      {c.phone ? (
                        <span className="inline-flex items-center gap-1 text-slate-700">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          {c.phone}
                          {c.contact_person ? `（担当: ${c.contact_person}）` : ''}
                        </span>
                      ) : c.contact_person ? (
                        <span className="inline-flex items-center gap-1 text-slate-700">
                          👤 担当: {c.contact_person}
                        </span>
                      ) : null}

                      {c.address && (
                        <span className="inline-flex items-center gap-1 text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          {c.address}
                        </span>
                      )}

                      {c.notes && (
                        <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                          <FileText className="w-3.5 h-3.5 text-amber-600" />
                          {c.notes}
                        </span>
                      )}

                      {!c.phone && !c.address && !c.notes && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(c)}
                          className="text-slate-400 hover:text-blue-600 underline text-[11px] cursor-pointer"
                        >
                          ＋ 電話番号・配達先住所・納品メモを登録する
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 右側：一番よく使う「注文を入れる」ボタン ＆ 卸単価設定 ＆ 編集・削除 */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link
                      href={orderNewHref}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs transition-colors"
                      title="電話やLINEで受けた注文をすぐ登録します"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>＋ このお店の注文を入れる</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleOpenPricingModal(c)}
                      className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Banknote className="w-4 h-4 text-amber-600" />
                      <span>卸単価を設定</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(c)}
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                      title="連絡先や締め日を編集"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      disabled={deletingId === c.id}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                      title="削除"
                    >
                      {deletingId === c.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* 下段：左＝このお店の野菜別単価一覧 ／ 右＝お客さん専用注文ページ（プレビュー・LINE案内コピー） */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                  {/* 左（7列）：このお店向けの卸単価 */}
                  <div className="lg:col-span-7 bg-slate-50/90 border border-slate-200/80 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1 flex-1">
                      <div className="text-[11px] font-black text-slate-500 flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5 text-amber-600" />
                        <span>このお店の野菜卸単価（注文時に自動反映）:</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {priceBadges.length === 0 ? (
                          <span className="text-xs font-bold text-slate-400">作目がまだありません</span>
                        ) : (
                          priceBadges.map((pb, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${
                                pb.price > 0
                                  ? pb.isCustom
                                    ? 'bg-amber-50 text-amber-900 border-amber-300 font-black'
                                    : 'bg-white text-slate-700 border-slate-200'
                                  : 'bg-white text-slate-400 border-dashed border-slate-300'
                              }`}
                            >
                              🌱 {pb.cropName}:{' '}
                              {pb.price > 0 ? (
                                <strong>
                                  ¥{pb.price.toLocaleString()}/{pb.unit}
                                </strong>
                              ) : (
                                '単価未設定'
                              )}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenPricingModal(c)}
                      className="text-xs font-black text-amber-700 hover:text-amber-900 underline shrink-0 self-end sm:self-center cursor-pointer"
                    >
                      単価を変更 ➔
                    </button>
                  </div>

                  {/* 右（5列）：お客様専用のスマホ発注URL（プレビュー・LINE案内コピー・URLコピー） */}
                  <div className="lg:col-span-5 bg-indigo-50/50 border border-indigo-200/80 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-[11px] font-black text-indigo-950">
                      📱 お客様専用のスマホ注文ページ:
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <a
                        href={`/b2b-order/${tokenOrId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black transition-colors shadow-2xs"
                        title="実際にお客さんが見る注文画面を別タブで開いて確認します"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>注文画面を見る</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => copyLineInviteMessage(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-colors shadow-2xs cursor-pointer"
                        title="LINEやメールでそのまま送れる丁寧な案内文とURLをセットでコピーします"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>LINE案内文コピー</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => copyLinkOnly(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="URLのみをコピーします"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>URLのみ</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. 得意先の登録・編集モーダル（電話番号・住所・担当者・配達メモ対応） */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                {editingCustomer ? '得意先（お店）情報の編集' : '新しい得意先（お店・出荷先）の登録'}
              </h2>
              <button
                type="button"
                onClick={() => !isSubmitting && setShowModal(false)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    お店の名前・屋号 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例: レストラン山田 / 〇〇スーパー"
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">取引の種類</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="飲食店">飲食店</option>
                    <option value="スーパー">スーパー</option>
                    <option value="小売店">小売店・八百屋</option>
                    <option value="直売所">直売所</option>
                    <option value="卸売">市場・卸売</option>
                    <option value="個人">個人のお客様</option>
                  </select>
                </div>
              </div>

              {/* 連絡先・担当者 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    📞 電話番号（急な連絡用）
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="例: 090-1234-5678"
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2 font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    👤 ご担当者名（任意）
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="例: 料理長 佐藤様"
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2 font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 配達先住所・納品メモ */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  📍 配達先住所・納品場所（任意）
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="例: 〇〇市△△町1-2-3（店舗裏口の納品ボックス）"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  📝 配達時間帯・定休日などのメモ（任意）
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="例: 朝9時〜10時までに納品 / 水曜定休"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* 決済・支払条件 */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="block text-xs font-black text-slate-700">お支払い方法・締め日</label>

                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        closing_day: 31,
                        payment_month: 1,
                        payment_day: 31
                      });
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      formData.payment_day !== 0
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    🧾 月まとめ請求（掛売）
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        closing_day: 0,
                        payment_month: 0,
                        payment_day: 0
                      });
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      formData.payment_day === 0
                        ? 'bg-white text-emerald-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    💵 配達時に現金払い（都度）
                  </button>
                </div>

                {formData.payment_day !== 0 && (
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 mb-1">締め日</label>
                      <select
                        value={formData.closing_day}
                        onChange={e => setFormData({ ...formData, closing_day: Number(e.target.value) })}
                        className="w-full border border-slate-300 bg-white rounded-xl px-3 py-2 font-bold text-xs text-slate-800"
                      >
                        <option value={31}>月末締め</option>
                        <option value={25}>25日締め</option>
                        <option value={20}>20日締め</option>
                        <option value={15}>15日締め</option>
                        <option value={10}>10日締め</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-500 mb-1">支払日</label>
                      <div className="flex gap-1.5">
                        <select
                          value={formData.payment_month}
                          onChange={e => setFormData({ ...formData, payment_month: Number(e.target.value) })}
                          className="w-1/2 border border-slate-300 bg-white rounded-xl px-2 py-2 font-bold text-xs text-slate-800"
                        >
                          <option value={0}>当月</option>
                          <option value={1}>翌月</option>
                          <option value={2}>翌々月</option>
                        </select>
                        <select
                          value={formData.payment_day}
                          onChange={e => setFormData({ ...formData, payment_day: Number(e.target.value) })}
                          className="w-1/2 border border-slate-300 bg-white rounded-xl px-2 py-2 font-bold text-xs text-slate-800"
                        >
                          <option value={31}>末払い</option>
                          <option value={25}>25日払い</option>
                          <option value={20}>20日払い</option>
                          <option value={15}>15日払い</option>
                          <option value={10}>10日払い</option>
                          <option value={5}>5日払い</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-xl text-sm transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> 保存中...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> 保存する
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. 得意先ごとの「野菜別卸単価・単位・出品設定」モーダル */}
      {pricingCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-amber-600" />
                  <span>「{pricingCustomer.name}」向けの野菜卸単価・単位設定</span>
                </h2>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  ここで設定した単価と単位は、注文入力時および「{pricingCustomer.name}様専用のスマホ注文画面」に自動で反映されます。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPricingCustomer(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerPrices} className="p-5 sm:p-6 space-y-4">
              {crops.length === 0 ? (
                <div className="p-6 text-center text-xs font-bold text-slate-500">
                  作目が登録されていません。
                </div>
              ) : (
                <div className="space-y-2.5">
                  {crops.map(crop => {
                    const row = editingCustomPrices[crop.id] || {
                      unit_price: 0,
                      unit: 'kg',
                      enabled: true
                    };
                    return (
                      <div
                        key={crop.id}
                        className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          row.enabled
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-slate-100/60 border-slate-200 opacity-60'
                        }`}
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={e =>
                              setEditingCustomPrices(prev => ({
                                ...prev,
                                [crop.id]: { ...row, enabled: e.target.checked }
                              }))
                            }
                            className="w-4 h-4 rounded accent-emerald-600"
                          />
                          <span className="font-black text-slate-900 text-sm">🌱 {crop.name}</span>
                          {!row.enabled && (
                            <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border">
                              注文画面に非表示
                            </span>
                          )}
                        </label>

                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs font-bold text-slate-500">単位:</span>
                          <input
                            type="text"
                            value={row.unit}
                            onChange={e =>
                              setEditingCustomPrices(prev => ({
                                ...prev,
                                [crop.id]: { ...row, unit: e.target.value }
                              }))
                            }
                            placeholder="kg / 箱 / 袋"
                            className="w-16 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-center text-xs font-black text-slate-800"
                          />

                          <span className="text-xs font-bold text-slate-500 ml-1">卸単価: ¥</span>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={row.unit_price || ''}
                            placeholder="0"
                            onChange={e =>
                              setEditingCustomPrices(prev => ({
                                ...prev,
                                [crop.id]: { ...row, unit_price: Number(e.target.value) || 0 }
                              }))
                            }
                            className="w-24 px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-right text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPricingCustomer(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomerPrices}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-sm cursor-pointer"
                >
                  {isSavingCustomerPrices ? '保存中...' : '✓ このお店の卸単価を保存する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
