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

    // 2. localStorage の現場作業者・テナント情報から厳格に取得
    if (typeof window !== 'undefined') {
      // 現場作業員データからの user_id（所属農園オーナーID）取得
      const savedWorker = localStorage.getItem('agri_current_worker') || localStorage.getItem('current_worker');
      if (savedWorker) {
        try {
          const w = JSON.parse(savedWorker);
          if (w && w.user_id) return w.user_id;
        } catch (e) {}
      }

      // オーナーID / テナントIDストレージからの取得
      const ownerId = localStorage.getItem('agri_owner_id');
      if (ownerId && ownerId !== 'null' && ownerId !== 'undefined') {
        return ownerId;
      }

      const savedTenant = localStorage.getItem('current_tenant_id') || localStorage.getItem('tenant_id');
      if (savedTenant && savedTenant !== 'null' && savedTenant !== 'undefined') {
        return savedTenant;
      }
    }

    // セッションも所属テナントも特定できない場合は絶対に null を返し、他社データを誤取得しない
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
