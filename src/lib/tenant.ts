import { createBrowserClient } from '@supabase/ssr';

/**
 * クライアントサイドで現在のログインユーザー（テナントID）を取得する
 */
export async function getCurrentTenantId(): Promise<string | null> {
  try {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1. Supabase Auth のセッションから取得
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id) {
      return user.id;
    }

    // 2. localStorage のフォールバック（現場作業者モード等の場合）
    if (typeof window !== 'undefined') {
      const savedTenant = localStorage.getItem('current_tenant_id') || localStorage.getItem('tenant_id');
      if (savedTenant) return savedTenant;

      const workerData = localStorage.getItem('current_worker');
      if (workerData) {
        try {
          const w = JSON.parse(workerData);
          if (w.user_id) return w.user_id;
        } catch (e) {}
      }
    }

    // 3. company_settings から最新の単一テナント（開発環境・フォールバック用）
    const { data: comp } = await supabase
      .from('company_settings')
      .select('user_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (comp && comp.user_id) {
      return comp.user_id;
    }

    return null;
  } catch (error) {
    console.error('getCurrentTenantId error:', error);
    return null;
  }
}

/**
 * 指定テナントに所属する作業者IDの一覧を取得する
 */
export async function getTenantWorkerIds(tenantId: string): Promise<string[]> {
  try {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: workers } = await supabase
      .from('workers')
      .select('id')
      .eq('user_id', tenantId);

    return (workers || []).map(w => w.id);
  } catch (error) {
    console.error('getTenantWorkerIds error:', error);
    return [];
  }
}
