import { createClient } from '@supabase/supabase-js';

// Server Actions などのバックエンドでのみ使用する、権限チェックをバイパスする強力なクライアント
// 🚨 クライアントコンポーネント（ブラウザ側）では絶対に使用しないでください
export const createAdminClient = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase Admin environment variables');
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};
