import { createClient } from '@supabase/supabase-js';

// Server Actions などのバックエンドでのみ使用する、権限チェックをバイパスする強力なクライアント
// 🚨 クライアントコンポーネント（ブラウザ側）では絶対に使用しないでください
export const createAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // serviceKey が有効なJWT（ey...で始まる文字列）であれば使い、そうでなければanonKeyを使用
  const key = (serviceKey && serviceKey.startsWith('ey') && serviceKey.length > 50) 
    ? serviceKey 
    : anonKey;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

export const getAdminSupabase = createAdminClient;
