import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function RootPage() {
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || '';
  const isMobile = /iphone|ipad|ipod|android|mobile/i.test(userAgent);

  // スマホ・タブレットからのアクセス時は、現場ポータル (/portal) へ即時リダイレクト
  if (isMobile) {
    redirect('/portal');
  }

  // PCからのアクセス時はポータルまたは管理画面へリダイレクト
  redirect('/portal');
}

