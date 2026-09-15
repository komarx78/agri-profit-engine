import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function RootPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const queryString = new URLSearchParams();
  if (sp) {
    Object.entries(sp).forEach(([key, val]) => {
      if (typeof val === 'string') {
        queryString.set(key, val);
      } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
        queryString.set(key, val[0]);
      }
    });
  }

  const qs = queryString.toString();
  const target = qs ? `/portal?${qs}` : '/portal';
  redirect(target);
}

