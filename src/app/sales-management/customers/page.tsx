"use client";

import React, { useEffect, useState } from 'react';
import { Users, Plus, Link as LinkIcon, Settings, Search } from 'lucide-react';
import { getB2BCustomers, createB2BCustomer } from '@/app/actions/b2b';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
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
    const res = await getB2BCustomers(null);
    if (res.success) {
      setCustomers(res.customers);
    }
    setLoading(false);
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = Math.random().toString(36).substr(2, 9); // mock token
    const res = await createB2BCustomer({
      ...formData,
      order_token: token,
      farm_id: '00000000-0000-0000-0000-000000000001'
    });
    if (res.success) {
      setShowModal(false);
      loadCustomers();
    } else {
      alert("エラーが発生しました: " + res.error);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/b2b-order/${token}`;
    navigator.clipboard.writeText(url);
    alert("発注用URLをコピーしました:\n" + url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            顧客マスタ
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">取引先の情報と締め日・支払日を管理します。</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-5 h-5" /> 新規顧客登録
        </button>
      </div>

      {/* 検索・フィルター（モック） */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="顧客名で検索..." 
          className="bg-transparent border-none focus:outline-none text-slate-700 font-bold w-full"
        />
      </div>

      {/* 顧客一覧 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm">
                <th className="p-4 font-black text-slate-500 w-1/3">顧客名・タイプ</th>
                <th className="p-4 font-black text-slate-500">締め日・支払日</th>
                <th className="p-4 font-black text-slate-500 text-center">発注用URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500 font-bold">読み込み中...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500 font-bold">顧客が登録されていません。</td></tr>
              ) : customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-black text-slate-800">{c.name}</div>
                    <div className="text-xs font-bold text-slate-400 mt-0.5">{c.type}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold">
                        {c.closing_day === 31 ? '月末' : `${c.closing_day}日`}締め
                      </span>
                      <span className="text-slate-400 font-bold text-sm">→</span>
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                        {c.payment_month === 0 ? '当月' : c.payment_month === 1 ? '翌月' : '翌々月'}
                        {c.payment_day === 31 ? '末' : `${c.payment_day}日`}払い
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    {c.order_token ? (
                      <button 
                        onClick={() => copyLink(c.order_token)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-bold transition-colors"
                      >
                        <LinkIcon className="w-4 h-4" /> コピー
                      </button>
                    ) : (
                      <span className="text-slate-400 text-sm font-bold">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新規登録モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800">新規顧客の登録</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">顧客名・屋号</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">取引タイプ</label>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 font-bold focus:outline-none focus:border-blue-500"
                >
                  <option value="飲食店">飲食店</option>
                  <option value="小売店">小売店</option>
                  <option value="卸売">卸売</option>
                  <option value="個人">個人</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">締め日</label>
                  <select 
                    value={formData.closing_day}
                    onChange={e => setFormData({...formData, closing_day: Number(e.target.value)})}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 font-bold focus:outline-none focus:border-blue-500"
                  >
                    <option value={10}>10日締め</option>
                    <option value={15}>15日締め</option>
                    <option value={20}>20日締め</option>
                    <option value={25}>25日締め</option>
                    <option value={31}>月末締め</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">支払日 (月)</label>
                  <select 
                    value={formData.payment_month}
                    onChange={e => setFormData({...formData, payment_month: Number(e.target.value)})}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 font-bold focus:outline-none focus:border-blue-500"
                  >
                    <option value={0}>当月</option>
                    <option value={1}>翌月</option>
                    <option value={2}>翌々月</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">支払日 (日)</label>
                <select 
                  value={formData.payment_day}
                  onChange={e => setFormData({...formData, payment_day: Number(e.target.value)})}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 font-bold focus:outline-none focus:border-blue-500"
                >
                  <option value={10}>10日払い</option>
                  <option value={15}>15日払い</option>
                  <option value={20}>20日払い</option>
                  <option value={25}>25日払い</option>
                  <option value={31}>月末払い</option>
                </select>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all">
                  登録する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
