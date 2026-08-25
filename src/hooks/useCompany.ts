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

const CACHE_KEY = 'agri_cached_company_name';

export function useCompany(): CompanyInfo {
  const [companyName, setCompanyName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(CACHE_KEY) || '';
    }
    return '';
  });
  const [postalCode, setPostalCode] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [bankInfo, setBankInfo] = useState<string>('');
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCompany = useCallback(async () => {
    try {
      // 1. テナントIDの取得
      let currentTenant = await getCurrentTenantId();

      // 現場スタッフのフォールバック
      if (!currentTenant && typeof window !== 'undefined') {
        currentTenant = localStorage.getItem('agri_owner_id');
        if (!currentTenant) {
          const savedWorker = localStorage.getItem('agri_current_worker');
          if (savedWorker) {
            try {
              const w = JSON.parse(savedWorker);
              if (w.user_id) currentTenant = w.user_id;
            } catch (e) {}
          }
        }
      }

      setTenantId(currentTenant);

      if (!currentTenant) {
        setIsLoading(false);
        return;
      }

      // 2. company_settings テーブルから取得
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .or(`user_id.eq.${currentTenant},id.eq.${currentTenant}`)
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
          localStorage.setItem(CACHE_KEY, name);
        }
      }
    } catch (err) {
      console.warn('useCompany fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
