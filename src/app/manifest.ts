import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/portal',
    name: 'アグリプロフィット - 農業収益エンジン',
    short_name: 'アグリ現場',
    description: '農業現場の作業記録・勤怠打刻・出荷管理・収益分析アプリ',
    lang: 'ja',
    dir: 'ltr',
    start_url: '/portal',
    scope: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#059669',
    orientation: 'portrait',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/icons/screenshot-mobile.png',
        sizes: '1080x1920',
        type: 'image/png',
        // @ts-ignore
        form_factor: 'narrow',
        label: 'アグリ現場 モバイル画面',
      },
      {
        src: '/icons/screenshot-wide.png',
        sizes: '1920x1080',
        type: 'image/png',
        // @ts-ignore
        form_factor: 'wide',
        label: 'アグリプロフィット 管理画面',
      },
    ],
  };
}
