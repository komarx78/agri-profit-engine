"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, AlertTriangle, CheckCircle2, X, RefreshCw, Smartphone, ExternalLink, Settings, ShieldCheck } from 'lucide-react';
import { t, LanguageCode } from '@/lib/i18n';

interface GpsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => Promise<void> | void;
  isRetrying?: boolean;
  language?: LanguageCode;
}

const MODAL_I18N: Record<string, Record<LanguageCode, string>> = {
  iphoneTab: {
    ja: '🍎 iPhone (Safari)',
    en: '🍎 iPhone (Safari)',
    vi: '🍎 iPhone (Safari)',
    id: '🍎 iPhone (Safari)',
    zh: '🍎 iPhone (Safari)',
    si: '🍎 iPhone (Safari)',
    km: '🍎 iPhone (Safari)'
  },
  androidTab: {
    ja: '🤖 Android (Chrome)',
    en: '🤖 Android (Chrome)',
    vi: '🤖 Android (Chrome)',
    id: '🤖 Android (Chrome)',
    zh: '🤖 Android (Chrome)',
    si: '🤖 Android (Chrome)',
    km: '🤖 Android (Chrome)'
  },
  iosStep1Title: {
    ja: 'アドレスバー左の「ぁあ」またはメニューをタップ',
    en: 'Tap "AA" or menu in the address bar',
    vi: 'Nhấn vào biểu tượng "aA" hoặc menu trên thanh địa chỉ',
    id: 'Ketuk "aA" atau menu di bilah alamat',
    zh: '点击地址栏左侧的“大小”或菜单图标',
    si: 'ලිපින තීරුවේ "AA" හෝ මෙනුව තට්ටු කරන්න',
    km: 'ចុច "AA" ឬ ម៉ឺនុយនៅក្នុងរបារអាសយដ្ឋាន'
  },
  iosStep1Desc: {
    ja: '画面下部または上部のアドレスバー左端にある文字をタップします。',
    en: 'Located at the bottom or top left of the address bar.',
    vi: 'Nằm ở phía dưới hoặc phía trên góc trái của thanh địa chỉ Safari.',
    id: 'Terletak di kiri bawah atau atas bilah alamat Safari.',
    zh: '位于Safari地址栏左侧。',
    si: 'Safari ලිපින තීරුවේ වම් පසින් පිහිටා ඇත.',
    km: 'មានទីតាំងនៅខាងឆ្វេងនៃរបារអាសយដ្ឋាន Safari។'
  },
  iosStep2Title: {
    ja: '「Webサイトの設定」をタップ',
    en: 'Tap "Website Settings"',
    vi: 'Nhấn vào "Cài đặt trang web"',
    id: 'Ketuk "Pengaturan Situs Web"',
    zh: '点击“网站设置”',
    si: '"වෙබ් අඩවි සැකසුම්" තට්ටු කරන්න',
    km: 'ចុច "ការកំណត់គេហទំព័រ"'
  },
  iosStep2Desc: {
    ja: '開いたメニュー内の歯車アイコン「Webサイトの設定」を選択します。',
    en: 'Select the gear icon "Website Settings" from the menu.',
    vi: 'Chọn biểu tượng bánh răng "Cài đặt trang web" trong menu mở ra.',
    id: 'Pilih ikon roda gigi "Pengaturan Situs Web" dari menu.',
    zh: '在弹出的菜单中选择齿轮图标“网站设置”。',
    si: 'මෙනුවෙන් "වෙබ් අඩවි සැකසුම්" තෝරන්න.',
    km: 'ជ្រើសរើសរូបតំណាង "ការកំណត់គេហទំព័រ" ពីម៉ឺនុយ។'
  },
  iosStep3Title: {
    ja: '「位置情報」を【許可】に変更',
    en: 'Change "Location" to [Allow]',
    vi: 'Đổi "Vị trí" thành 【Cho phép】',
    id: 'Ubah "Lokasi" menjadi 【Izinkan】',
    zh: '将“位置”更改为【允许】',
    si: '"ස්ථානය" 【ඉඩ දෙන්න】 ලෙස වෙනස් කරන්න',
    km: 'ប្តូរ "ទីតាំង" ទៅជា 【អនុញ្ញាត】'
  },
  iosStep3Desc: {
    ja: '「拒否」または「確認」から「許可」に変更して完了を押します。',
    en: 'Change from "Deny" to "Allow" and tap Done.',
    vi: 'Chuyển từ "Từ chối" sang "Cho phép" rồi nhấn Xong.',
    id: 'Ubah dari "Tolak" ke "Izinkan" lalu ketuk Selesai.',
    zh: '从“拒绝”更改为“允许”并点击完成。',
    si: '"ප්‍රතික්ෂේප කරන්න" වෙතින් "ඉඩ දෙන්න" වෙත වෙනස් කර සිදු විය තට්ටු කරන්න.',
    km: 'ប្តូរពី "បដិសេធ" ទៅ "អនុញ្ញាត" ហើយចុច រួចរាល់។'
  },
  iosTip: {
    ja: '💡 それでも動かない場合: iPhoneの「設定アプリ ➔ プライバシーとセキュリティ ➔ 位置情報サービス」がONになっているかご確認ください。',
    en: '💡 If still not working: Check iPhone "Settings ➔ Privacy & Security ➔ Location Services" is ON.',
    vi: '💡 Nếu vẫn không hoạt động: Hãy kiểm tra "Cài đặt máy iPhone ➔ Quyền riêng tư & Bảo mật ➔ Dịch vụ định vị" đã BẬT chưa.',
    id: '💡 Jika masih tidak berfungsi: Periksa iPhone "Pengaturan ➔ Privasi & Keamanan ➔ Layanan Lokasi" sudah AKTIF.',
    zh: '💡 若仍未生效：请检查 iPhone “设置 ➔ 隐私与安全性 ➔ 定位服务” 是否已开启。',
    si: '💡 තවමත් ක්‍රියා නොකරන්නේ නම්: iPhone "සැකසුම් ➔ පෞද්ගලිකත්වය ➔ ස්ථාන සේවා" සක්‍රිය දැයි පරීක්ෂා කරන්න.',
    km: '💡 ប្រសិនបើនៅតែមិនដំណើរការ៖ ពិនិត្យមើល "ការកំណត់ iPhone ➔ ភាពឯកជន ➔ សេវាកម្មទីតាំង" ត្រូវបានបើក។'
  },
  androidStep1Title: {
    ja: 'アドレスバー左の「🔒(南京錠)」または調整マークをタップ',
    en: 'Tap lock or tune icon in the address bar',
    vi: 'Nhấn vào biểu tượng 🔒 hoặc nút cài đặt bên trái thanh địa chỉ',
    id: 'Ketuk ikon gembok 🔒 atau pengaturan di bilah alamat',
    zh: '点击地址栏左侧的挂锁 🔒 或设置图标',
    si: 'ලිපින තීරුවේ අගුළු 🔒 අයිකනය තට්ටු කරන්න',
    km: 'ចុចរូបតំណាងសោ 🔒 នៅខាងឆ្វេងរបារអាសយដ្ឋាន'
  },
  androidStep1Desc: {
    ja: 'Chromeのアドレスバーの左端にあるアイコンをタップします。',
    en: 'Tap the icon on the far left of Chrome address bar.',
    vi: 'Nhấn vào biểu tượng ở góc bên trái thanh địa chỉ Chrome.',
    id: 'Ketuk ikon di paling kiri bilah alamat Chrome.',
    zh: '点击 Chrome 地址栏最左侧的图标。',
    si: 'Chrome ලිපින තීරුවේ වම් කෙළවරේ ඇති අයිකනය තට්ටු කරන්න.',
    km: 'ចុចរូបតំណាងនៅខាងឆ្វេងបំផុតនៃរបារអាសយដ្ឋាន Chrome។'
  },
  androidStep2Title: {
    ja: '「権限」または「サイトの設定」をタップ',
    en: 'Tap "Permissions" or "Site settings"',
    vi: 'Nhấn vào "Quyền" hoặc "Cài đặt trang web"',
    id: 'Ketuk "Izin" atau "Setelan situs"',
    zh: '点击“权限”或“网站设置”',
    si: '"අවසර" හෝ "අඩවි සැකසුම්" තට්ටු කරන්න',
    km: 'ចុច "ការអនុញ្ញាត" ឬ "ការកំណត់គេហទំព័រ"'
  },
  androidStep2Desc: {
    ja: 'メニューからサイトの権限設定を開きます。',
    en: 'Open the site permissions from the menu.',
    vi: 'Mở phần cài đặt quyền của trang web từ menu.',
    id: 'Buka pengaturan izin situs dari menu.',
    zh: '从菜单中打开网站权限设置。',
    si: 'මෙනුවෙන් අඩවි අවසර සැකසුම් විවෘත කරන්න.',
    km: 'បើកការកំណត់ការអនុញ្ញាតគេហទំព័រពីម៉ឺនុយ។'
  },
  androidStep3Title: {
    ja: '「位置情報」のアクセスを【許可】にする',
    en: 'Set "Location" permission to [Allow]',
    vi: 'Chuyển quyền "Vị trí" sang 【Cho phép】',
    id: 'Atur izin "Lokasi" ke 【Izinkan】',
    zh: '将“位置信息”权限设为【允许】',
    si: '"ස්ථාන" ප්‍රවේශය 【ඉඩ දෙන්න】 ලෙස සකසන්න',
    km: 'កំណត់ការអនុញ្ញាត "ទីតាំង" ទៅជា 【អនុញ្ញាត】'
  },
  androidStep3Desc: {
    ja: 'ブロックを解除し、「許可」に切り替えてページを再読み込みします。',
    en: 'Unblock location, change to "Allow", and reload the page.',
    vi: 'Bỏ chặn, chuyển sang "Cho phép" và tải lại trang.',
    id: 'Buka blokir, ubah ke "Izinkan", dan muat ulang halaman.',
    zh: '解除阻止，切换为“允许”并重新加载页面。',
    si: 'අවහිරය ඉවත් කර, "ඉඩ දෙන්න" වෙත මාරු කර පිටුව නැවත පූරණය කරන්න.',
    km: 'ដោះសោ ប្តូរទៅ "អនុញ្ញាត" ហើយផ្ទុកទំព័រឡើងវិញ។'
  },
  closeBtn: {
    ja: '閉じる',
    en: 'Close',
    vi: 'Đóng',
    id: 'Tutup',
    zh: '关闭',
    si: 'වසා දමන්න',
    km: 'បិទ'
  }
};

function getGuideText(key: string, lang: LanguageCode = 'ja'): string {
  if (MODAL_I18N[key] && MODAL_I18N[key][lang]) {
    return MODAL_I18N[key][lang];
  }
  return MODAL_I18N[key]?.['en'] || MODAL_I18N[key]?.['ja'] || key;
}

export function GpsGuideModal({ isOpen, onClose, onRetry, isRetrying = false, language = 'ja' }: GpsGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'iphone' | 'android'>('iphone');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[9999] overflow-y-auto p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="flex min-h-full items-center justify-center py-4">
        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-100 relative my-auto">
        
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-1.5">
              <span>{t('gpsGuideTitle', language)}</span>
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              {t('gpsGuideSub', language)}
            </p>
          </div>
        </div>

        {/* 注意バナー */}
        <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-xs space-y-1 text-amber-200">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{t('gpsGuideBlockedBanner', language)}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-200/90">
            {t('gpsGuideBlockedDesc', language)}
          </p>
        </div>

        {/* 機種切り替えタブ */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          <button
            type="button"
            onClick={() => setActiveTab('iphone')}
            className={`py-2 px-3 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'iphone'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>{getGuideText('iphoneTab', language)}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('android')}
            className={`py-2 px-3 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'android'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>{getGuideText('androidTab', language)}</span>
          </button>
        </div>

        {/* iPhone (Safari) の手順 */}
        {activeTab === 'iphone' && (
          <div className="space-y-2.5 text-xs font-medium text-slate-200">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">1</span>
              <div>
                <p className="font-bold text-white">{getGuideText('iosStep1Title', language)}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{getGuideText('iosStep1Desc', language)}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">2</span>
              <div>
                <p className="font-bold text-white">{getGuideText('iosStep2Title', language)}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{getGuideText('iosStep2Desc', language)}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">3</span>
              <div>
                <p className="font-bold text-white">{getGuideText('iosStep3Title', language)}</p>
                <p className="text-[11px] text-emerald-300 mt-0.5">{getGuideText('iosStep3Desc', language)}</p>
              </div>
            </div>

            <div className="p-2.5 bg-slate-800/40 rounded-xl border border-slate-700/40 text-[11px] text-slate-400 leading-relaxed">
              {getGuideText('iosTip', language)}
            </div>
          </div>
        )}

        {/* Android (Chrome) の手順 */}
        {activeTab === 'android' && (
          <div className="space-y-2.5 text-xs font-medium text-slate-200">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">1</span>
              <div>
                <p className="font-bold text-white">{getGuideText('androidStep1Title', language)}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{getGuideText('androidStep1Desc', language)}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">2</span>
              <div>
                <p className="font-bold text-white">{getGuideText('androidStep2Title', language)}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{getGuideText('androidStep2Desc', language)}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">3</span>
              <div>
                <p className="font-bold text-white">{getGuideText('androidStep3Title', language)}</p>
                <p className="text-[11px] text-emerald-300 mt-0.5">{getGuideText('androidStep3Desc', language)}</p>
              </div>
            </div>
          </div>
        )}

        {/* 再取得アクションボタン */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            disabled={isRetrying}
            onClick={async () => {
              await onRetry();
            }}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? t('gpsGuideRetrying', language) : t('gpsGuideRetryBtn', language)}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {getGuideText('closeBtn', language)}
          </button>
        </div>

      </div>
    </div>
  </div>,
  document.body
);
}
