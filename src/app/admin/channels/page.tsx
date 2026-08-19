"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { HelpTooltip } from '@/components/HelpTooltip';
import { Store, Plus, Save, Trash2, Mail, Loader2, AlertCircle } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  email: string | null;
}

export default function ChannelsMasterPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchChannels();
  }, []);

  async function fetchChannels() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_channels')
        .select('id, name, email')
        .order('name'); // UUIDの場合は名前順などでソート

      if (error) throw error;
      setChannels(data || []);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('email')) {
        setMessage({ text: 'データベースに email カラムがありません。Supabaseでカラムを追加してください。', type: 'error' });
      } else {
        setMessage({ text: 'データの取得に失敗しました。', type: 'error' });
      }
    } finally {
      setIsLoading(false);
    }
  }

  const handleAddRow = () => {
    // 仮のIDとして 'new-' をプレフィックスに持つ文字列にする
    const tempId = `new-${Date.now()}`;
    setChannels([...channels, { id: tempId, name: '', email: '' }]);
  };

  const handleChange = (id: string, field: keyof Channel, value: string) => {
    setChannels(prev => prev.map(ch => ch.id === id ? { ...ch, [field]: value } : ch));
  };

  const handleDelete = async (id: string) => {
    if (id.startsWith('new-')) {
      // 未保存の新規行
      setChannels(prev => prev.filter(ch => ch.id !== id));
      return;
    }
    
    if (!confirm('この出荷先を削除しますか？\n※既にこの出荷先で登録された過去の売上データに影響が出る場合があります。')) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase.from('sales_channels').delete().eq('id', id);
      if (error) throw error;
      setChannels(prev => prev.filter(ch => ch.id !== id));
      setMessage({ text: '削除しました。', type: 'success' });
    } catch (err) {
      console.error(err);
      setMessage({ text: '削除に失敗しました。', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      // 名前が空の行は弾く
      const validChannels = channels.filter(ch => ch.name.trim() !== '');
      
      const newRows = validChannels.filter(ch => ch.id.startsWith('new-')).map(ch => ({ name: ch.name, email: ch.email || null }));
      const existingRows = validChannels.filter(ch => !ch.id.startsWith('new-'));

      if (newRows.length > 0) {
        const { error } = await supabase.from('sales_channels').insert(newRows);
        if (error) throw error;
      }
      
      for (const row of existingRows) {
        const { error } = await supabase.from('sales_channels').update({ name: row.name, email: row.email || null }).eq('id', row.id);
        if (error) throw error;
      }
      
      setMessage({ text: '保存が完了しました。', type: 'success' });
      fetchChannels(); // IDの振り直しなどを反映するため再取得
    } catch (err) {
      console.error(err);
      setMessage({ text: '保存に失敗しました。', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <Store className="w-8 h-8 text-blue-500" />
          出荷先（請求先）マスタ
          <HelpTooltip content="出荷先ごとの名称や、請求書をPDFで送信するためのメールアドレスを登録します。" className="ml-1" />
        </h1>
        <p className="text-slate-500 mt-2 font-medium">出荷先の名前や、請求書送付用のメールアドレスを管理します。</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-start gap-3 font-bold ${message.type === 'error' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{message.text}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-slate-200">
                  <th className="py-4 px-6 text-sm font-black text-slate-600">出荷先（請求先）名 <span className="text-rose-500">*</span></th>
                  <th className="py-4 px-6 text-sm font-black text-slate-600">メールアドレス <span className="text-slate-400 font-normal text-xs ml-1">(請求書受信用)</span></th>
                  <th className="py-4 px-6 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {channels.map((ch) => (
                  <tr key={ch.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-6">
                      <div className="relative flex items-center">
                        <Store className="w-4 h-4 text-slate-400 absolute left-3" />
                        <input
                          type="text"
                          value={ch.name}
                          onChange={(e) => handleChange(ch.id, 'name', e.target.value)}
                          placeholder="例: 〇〇スーパー"
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <div className="relative flex items-center">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3" />
                        <input
                          type="email"
                          value={ch.email || ''}
                          onChange={(e) => handleChange(ch.id, 'email', e.target.value)}
                          placeholder="例: info@example.com"
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        onClick={() => handleDelete(ch.id)}
                        className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                        title="削除"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {channels.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400 font-bold">
                      出荷先が登録されていません。「＋ 行を追加」から登録してください。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
            <button
              onClick={handleAddRow}
              className="px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" /> 行を追加
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black shadow-md flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              変更を保存する
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
