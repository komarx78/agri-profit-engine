import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cocotte.agriprofit',
  appName: 'アグリ現場',
  webDir: 'public',
  server: {
    url: 'https://agri-profit-engine.vercel.app/portal',
    cleartext: true,
    androidScheme: 'https'
  }
};

export default config;
