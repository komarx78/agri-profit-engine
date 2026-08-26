"use client";

import React, { useEffect, useState } from 'react';
import { Users, Plus, Link as LinkIcon, Edit2, Trash2, Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getB2BCustomers, createB2BCustomer, updateB2BCustomer, deleteB2BCustomer } from '@/app/actions/b2b';
import { getCurrentTenantId } from '@/lib/tenant';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // モーダル用
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: '飲食店',
    closing_day: 31,
    payment_month: 1,
    payment_day: 31
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    const tenantId = await getCurrentTenantId();
    const res = await getB2BCustomers(tenantId);
    if (res.success) {
      setCustomers(res.customers);
    }
    setLoading(false);
  }

  // 新規追加モーダルを開く
  const handleOpenCreateModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      type: '飲食店',
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
      closing_day: Number(c.closing_day) || 31,
      payment_month: Number(c.payment_month) || 1,
      payment_day: Number(c.payment_day) || 31
    });
    setShowModal(true);
  };

  // 保存処理 (新規 / 更新) - 二重クリック完全ガード
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.name.trim()) {
      alert("顧客名・屋号を入力してください。");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCustomer) {
        // 更新処理
        const res = await updateB2BCustomer(editingCustomer.id, formData);
        if (res.success) {
          setShowModal(false);
          await loadCustomers();
        } else {
          alert("更新エラー: " + res.error);
        }
      } else {
        // 新規登録処理
        const tenantId = await getCurrentTenantId();
        const token = Math.random().toString(36).substring(2, 11);
        const res = await createB2BCustomer({
          ...formData,
          order_token: token,
          user_id: tenantId
        }, tenantId);

        if (res.success) {
          setShowModal(false);
          await loadCustomers();
        } else {
          alert("登録エラー: " + res.error);
        }
      }
    } catch (err: any) {
      alert("通信エラーが発生しました: " + (err.message || '不明なエラー'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 削除処理
  const handleDelete = async (c: any) => {
    if (!window.confirm(`顧客「${c.name}」を削除しますか？\n（※この操作は取り消せません）`)) return;

    setDeletingId(c.id);
    try {
      const res = await deleteB2BCustomer(c.id);
      if (res.success) {
        await loadCustomers();
      } else {
        alert("削除できませんでした: " + res.error);
      }
    } catch (err: any) {
      alert("削除中にエラーが発生しました: " + (err.message || '不明なエラー'));
    } finally {
      setDeletingId(null);
    }
  };

  // 発注用URLコピー
  const copyLink = (token: string) => {
    const url = `${window.location.origin}/b2b-order/${token}`;
    navigator.clipboard.writeText(url);
    alert("発注用URLをコピーしました:\n" + url);
  };

  // リアルタイム検索フィルター
  const filteredCustomers = customers.filter(c => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.type && c.type.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            顧客マスタ
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">取引先の情報と締め日・支払日・専用発注URLを管理します。</p>
        </div>
        <button 
          onClick={handleOpenCreateModal}
          className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black py-2.5 px-5 rounded-xl transition-all flex items-center gap-2 shadow-sm shrink-0"
        >
          <Plus className="w-5 h-5" /> 新規顧客登録
        </button>
      </div>

      {/* 検索・フィルター */}
      <div className="bg-white p-3 px-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input 
          type="text" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="顧客名や取引タイプで検索..." 
          className="bg-transparent border-none focus:outline-none text-slate-800 font-bold w-full text-sm placeholder:text-slate-400"
        />
        {search && (
          <button 
            onClick={() => setSearch('')}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-1 bg-slate-100 rounded-lg"
          >
            クリア
          </button>
        )}
      </div>

      {/* 顧客一覧テーブル */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500">
                <th className="p-4 w-1/3">顧客名・屋号 / 取引タイプ</th>
                <th className="p-4">締め日・支払日</th>
                <th className="p-4 text-center">専用発注URL</th>
                <th className="p-4 text-center w-36">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-500 font-bold">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      <span>読み込み中...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-500 font-bold">
                    {search ? '該当する顧客が見つかりませんでした。' : '顧客がまだ登録されていません。'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <div className="font-black text-slate-800 text-base">{c.name}</div>
                      <div className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[11px] font-bold">
                        {c.type || '未設定'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200">
                          {c.closing_day === 31 ? '月末' : `${c.closing_day}日`}締め
                        </span>
                        <span className="text-slate-400 font-bold text-sm">➔</span>
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-blue-100">
                          {c.payment_month === 0 ? '当月' : c.payment_month === 1 ? '翌月' : '翌々月'}
                          {c.payment_day === 31 ? '末' : `${c.payment_day}日`}払い
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {c.order_token ? (
                        <button 
                          onClick={() => copyLink(c.order_token)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 active:scale-95 rounded-xl text-xs font-bold transition-all border border-indigo-200/60 shadow-xs"
                          title="発注用URLをクリップボードにコピー"
                        >
                          <LinkIcon className="w-3.5 h-3.5" /> URLコピー
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs font-bold">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="編集"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          disabled={deletingId === c.id}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                          title="削除"
                        >
                          {deletingId === c.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 登録・編集モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                {editingCustomer ? '顧客情報の編集' : '新規顧客の登録'}
              </h2>
              <button 
                onClick={() => !isSubmitting && setShowModal(false)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  顧客名・屋号 <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="例: レストラン山田 / 〇〇スーパー"
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">取引タイプ</label>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="飲食店">飲食店</option>
                  <option value="小売店">小売店</option>
                  <option value="スーパー">スーパー</option>
                  <option value="直売所">直売所</option>
                  <option value="卸売">卸売</option>
                  <option value="個人">個人</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">締め日</label>
                  <select 
                    value={formData.closing_day}
                    onChange={e => setFormData({...formData, closing_day: Number(e.target.value)})}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value={5}>5日締め</option>
                    <option value={10}>10日締め</option>
                    <option value={15}>15日締め</option>
                    <option value={20}>20日締め</option>
                    <option value={25}>25日締め</option>
                    <option value={31}>月末締め</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">支払日 (月)</label>
                  <select 
                    value={formData.payment_month}
                    onChange={e => setFormData({...formData, payment_month: Number(e.target.value)})}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value={0}>当月</option>
                    <option value={1}>翌月</option>
                    <option value={2}>翌々月</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">支払日 (日)</label>
                <select 
                  value={formData.payment_day}
                  onChange={e => setFormData({...formData, payment_day: Number(e.target.value)})}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value={5}>5日払い</option>
                  <option value={10}>10日払い</option>
                  <option value={15}>15日払い</option>
                  <option value={20}>20日払い</option>
                  <option value={25}>25日払い</option>
                  <option value={31}>月末払い</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{editingCustomer ? '更新中...' : '登録中...'}</span>
                    </>
                  ) : (
                    <span>{editingCustomer ? '更新する' : '登録する'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
