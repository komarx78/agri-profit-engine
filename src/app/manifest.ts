import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'アグリプロフィット - 農業収益エンジン',
    short_name: 'アグリ現場',
    description: '農業現場の作業記録・勤怠打刻・出荷管理・収益分析アプリ',
    start_url: '/portal',
    id: '/portal',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#059669',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any'
      },
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable'
      }
    ],
  };
}
