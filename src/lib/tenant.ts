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

    // 1. localStorage の現場作業者・テナント情報を最優先で即時取得（0ms・通信不要）
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

    // 2. Supabase Auth のセッションから取得（1.5秒タイムアウト保護付き）
    const userPromise = supabase.auth.getUser();
    const timeoutPromise = new Promise<{ data: { user: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { user: null } }), 1500)
    );
    const res: any = await Promise.race([userPromise, timeoutPromise]);
    const user = res?.data?.user;
    if (user && user.id) {
      return user.id;
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
