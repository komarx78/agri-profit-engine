import { createBrowserClient } from '@supabase/ssr';

const KNOWN_FARM_CODE_MAP: Record<string, string> = {
  'kap': '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04',
  'kap-101': '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04',
  'sahara': '62163024-2c8e-4057-a872-2455dbc58d32',
  'sahara-789': '62163024-2c8e-4057-a872-2455dbc58d32',
};

export function normalizeTenantId(raw: string | null | undefined): string | null {
  if (!raw || raw === 'null' || raw === 'undefined') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const noHyphen = lower.replace(/-/g, '');
  const mapped = KNOWN_FARM_CODE_MAP[lower] || KNOWN_FARM_CODE_MAP[noHyphen];
  return mapped || trimmed;
}

export async function resolveTenantUuid(raw: string | null | undefined): Promise<string | null> {
  const normalized = normalizeTenantId(raw);
  if (!normalized) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) {
    return normalized;
  }
  try {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from('company_settings')
      .select('user_id')
      .ilike('farm_code', normalized)
      .limit(1)
      .maybeSingle();
    if (data?.user_id) return data.user_id;
  } catch (e) {}
  return normalized;
}

/**
 * クライアントサイドで現在のログインユーザー（テナントID）を取得する
 */
export async function getCurrentTenantId(): Promise<string | null> {
  try {
    // 0. 🚨【最高絶対憲法3条・URL優先SSOT】URLクエリまたはURLパスから農園IDを最優先で取得！
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const rawUrlFarm = urlParams.get('farm') || urlParams.get('tenant') || urlParams.get('ownerId') || urlParams.get('farmId');
        const urlFarm = await resolveTenantUuid(rawUrlFarm);
        if (urlFarm) {
          try { localStorage.setItem('agri_owner_id', urlFarm); } catch (e) {}
          return urlFarm;
        }

        const match = window.location.pathname.match(/\/(?:portal|work|farm)\/([a-zA-Z0-9_-]+)/);
        const pathFarm = await resolveTenantUuid(match?.[1]);
        if (pathFarm) {
          try { localStorage.setItem('agri_owner_id', pathFarm); } catch (e) {}
          return pathFarm;
        }
      } catch (urlE) {}
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1. localStorage の現場作業者・テナント情報を即時取得（0ms・通信不要）
    if (typeof window !== 'undefined') {
      // 現場作業員データからの user_id（所属農園オーナーID）取得
      const savedWorker = localStorage.getItem('agri_current_worker') || localStorage.getItem('current_worker');
      if (savedWorker) {
        try {
          const w = JSON.parse(savedWorker);
          const workerUid = normalizeTenantId(w?.user_id);
          if (workerUid) return workerUid;
        } catch (e) {}
      }

      // オーナーID / テナントIDストレージからの取得
      const ownerId = normalizeTenantId(localStorage.getItem('agri_owner_id'));
      if (ownerId) {
        return ownerId;
      }

      // テナント別の作業員キー（agri_worker_*）からの解決
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('agri_worker_')) {
            const val = localStorage.getItem(key);
            if (val) {
              const parsed = JSON.parse(val);
              const uid = normalizeTenantId(parsed?.user_id || key.replace('agri_worker_', ''));
              if (uid) return uid;
            }
          }
        }
      } catch (e) {}

      const savedTenant = normalizeTenantId(localStorage.getItem('current_tenant_id') || localStorage.getItem('tenant_id'));
      if (savedTenant) {
        return savedTenant;
      }
    }

    // 2. Supabase Auth のローカルセッションから即時取得（通信不要・数ms）
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUserId = sessionData?.session?.user?.id;
      if (sessionUserId) {
        if (typeof window !== 'undefined') {
          try { localStorage.setItem('agri_owner_id', sessionUserId); } catch (e) {}
        }
        return sessionUserId;
      }
    } catch (e) {}

    // 3. フォールバック: Supabase Auth サーバーから取得（1.5秒タイムアウト保護付き）
    const userPromise = supabase.auth.getUser();
    const timeoutPromise = new Promise<{ data: { user: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { user: null } }), 1500)
    );
    const res: any = await Promise.race([userPromise, timeoutPromise]);
    const user = res?.data?.user;
    if (user && user.id) {
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('agri_owner_id', user.id); } catch (e) {}
      }
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
