// 🚨 現場エラートレース＆管理者アラートユーティリティ
export interface ErrorReportParams {
  category: 'attendance' | 'login' | 'sync' | 'api' | 'general';
  message: string;
  error?: any;
  tenantId?: string;
  companyName?: string;
  workerId?: string;
  workerName?: string;
  level?: 'error' | 'warning' | 'info';
}

/**
 * 現場エラーを販売管理者（スーパー管理者）へ自動報告する
 * ※画面の動作や打刻処理を一切ブロックせず、裏側で安全に送信します
 */
export async function reportSystemError(params: ErrorReportParams): Promise<void> {
  try {
    if (typeof window === 'undefined') return;

    // ローカルストレージから直前の作業者・農園情報を自動補完
    const cachedWorker = localStorage.getItem('agri_current_worker');
    let parsedWorker: any = null;
    if (cachedWorker) {
      try { parsedWorker = JSON.parse(cachedWorker); } catch (e) {}
    }

    const payload = {
      tenant_id: params.tenantId || localStorage.getItem('agri_owner_id') || parsedWorker?.user_id || null,
      company_name: params.companyName || localStorage.getItem('agri_cached_company_name') || null,
      worker_id: params.workerId || parsedWorker?.id || null,
      worker_name: params.workerName || parsedWorker?.name || null,
      error_level: params.level || 'error',
      error_category: params.category,
      error_message: params.message || (params.error?.message || '不明なエラー'),
      error_stack: params.error?.stack || (typeof params.error === 'string' ? params.error : JSON.stringify(params.error || '')),
      device_info: navigator.userAgent,
      page_url: window.location.href,
      created_at: new Date().toISOString()
    };

    // 1. sendBeacon が使える場合は最優先（画面遷移時でも確実に送信）
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/system-error', blob);
      if (sent) return;
    }

    // 2. フォールバック: fetch で非同期送信
    fetch('/api/system-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(err => {
      console.warn('Failed to send error report:', err);
    });
  } catch (reporterErr) {
    console.warn('reportSystemError internal error:', reporterErr);
  }
}
