"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '@/lib/tenant';

export interface CompanyInfo {
  companyName: string;
  postalCode?: string;
  address?: string;
  phone?: string;
  invoiceNumber?: string;
  bankInfo?: string;
  farmCode?: string;
  tenantId: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useCompany(explicitTenantId?: string | null): CompanyInfo {
  const [companyName, setCompanyName] = useState<string>('');
  const [postalCode, setPostalCode] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [bankInfo, setBankInfo] = useState<string>('');
  const [farmCode, setFarmCode] = useState<string>('');
  const [tenantId, setTenantId] = useState<string | null>(explicitTenantId || null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCompany = useCallback(async () => {
    try {
      // 1. テナントIDの決定（引数指定およびURLクエリを最優先）
      let currentTenant = explicitTenantId || null;
      if (!currentTenant && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        currentTenant = urlParams.get('farm') || urlParams.get('tenant') || urlParams.get('ownerId') || urlParams.get('farmId');
      }

      if (!currentTenant) {
        currentTenant = await getCurrentTenantId();
      }

      // 現場スタッフのフォールバック
      if (!currentTenant && typeof window !== 'undefined') {
        const savedWorker = localStorage.getItem('agri_current_worker');
        if (savedWorker) {
          try {
            const w = JSON.parse(savedWorker);
            if (w && w.user_id) currentTenant = w.user_id;
          } catch (e) {}
        }
        if (!currentTenant) {
          currentTenant = localStorage.getItem('agri_owner_id');
        }
      }

      setTenantId(currentTenant);

      if (!currentTenant || currentTenant === 'null' || currentTenant === 'undefined') {
        setCompanyName('');
        setIsLoading(false);
        return;
      }

      // テナントID固有のキャッシュ確認
      const tenantCacheKey = `agri_company_${currentTenant}`;
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(tenantCacheKey);
        if (cached) {
          setCompanyName(cached);
        }
      }

      // 2. company_settings テーブルから当該テナントIDのレコードを厳格に取得（user_id または id に一致）
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .or(`user_id.eq.${currentTenant},id.eq.${currentTenant}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        let name = data.company_name || '';
        if (!name) {
          if (currentTenant === '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04') name = '株式会社KAP';
          else if (currentTenant === '62163024-2c8e-4057-a872-2455dbc58d32') name = '佐原農園株式会社';
        }
        setCompanyName(name);
        setPostalCode(data.postal_code || '');
        setAddress(data.address || '');
        setPhone(data.phone || '');
        setInvoiceNumber(data.invoice_number || '');
        setBankInfo(data.bank_info || '');

        let resolvedFarmCode = data.farm_code || '';
        if (!resolvedFarmCode) {
          if (currentTenant === '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04') resolvedFarmCode = 'kap';
          else if (currentTenant === '62163024-2c8e-4057-a872-2455dbc58d32') resolvedFarmCode = 'sahara';
          else {
            const prefix = (name || 'farm').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'farm';
            resolvedFarmCode = `${prefix}`;
          }
        }
        setFarmCode(resolvedFarmCode);

        if (typeof window !== 'undefined' && name) {
          localStorage.setItem(tenantCacheKey, name);
          // 旧グローバル汚染キャッシュを消去
          localStorage.removeItem('agri_cached_company_name');
        }
      } else {
        // 自社情報が未登録の場合のテナント固有フォールバック（他社コードの混入は構造的完全遮断）
        if (currentTenant === '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04') {
          setCompanyName('株式会社KAP');
          setFarmCode('kap');
        } else if (currentTenant === '62163024-2c8e-4057-a872-2455dbc58d32') {
          setCompanyName('佐原農園株式会社');
          setFarmCode('sahara');
        } else {
          setCompanyName('自社名未設定');
          setFarmCode(currentTenant ? currentTenant.substring(0, 8) : '');
        }
      }
    } catch (err) {
      console.warn('useCompany fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [explicitTenantId]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  return {
    companyName,
    postalCode,
    address,
    phone,
    invoiceNumber,
    bankInfo,
    farmCode,
    tenantId,
    isLoading,
    refresh: fetchCompany,
  };
}

