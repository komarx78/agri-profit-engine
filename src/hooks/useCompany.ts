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
  const [tenantId, setTenantId] = useState<string | null>(explicitTenantId || null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCompany = useCallback(async () => {
    try {
      // 1. テナントIDの決定（引数指定を最優先）
      let currentTenant = explicitTenantId || null;

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

      // 2. company_settings テーブルから当該テナントIDのレコードのみを厳格に取得
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', currentTenant)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const name = data.company_name || '';
        setCompanyName(name);
        setPostalCode(data.postal_code || '');
        setAddress(data.address || '');
        setPhone(data.phone || '');
        setInvoiceNumber(data.invoice_number || '');
        setBankInfo(data.bank_info || '');

        if (typeof window !== 'undefined' && name) {
          localStorage.setItem(tenantCacheKey, name);
          // 旧グローバル汚染キャッシュを消去
          localStorage.removeItem('agri_cached_company_name');
        }
      } else {
        // 自社情報が未登録の場合
        setCompanyName('');
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
    tenantId,
    isLoading,
    refresh: fetchCompany,
  };
}

