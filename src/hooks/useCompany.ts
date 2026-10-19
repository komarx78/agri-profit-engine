"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenantId, normalizeTenantId } from '@/lib/tenant';
import { getCompanySettings } from '@/app/actions/farm';

export interface CompanyInfo {
  companyName: string;
  postalCode?: string;
  address?: string;
  phone?: string;
  invoiceNumber?: string;
  bankInfo?: string;
  farmCode?: string;
  planType?: 'trial' | 'premium';
  trialDays?: number;
  trialEndsAt?: string;
  trialDaysLeft?: number;
  campaignName?: string;
  tenantId: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

function computeTrialMeta(data: any): {
  planType: 'trial' | 'premium';
  trialDays: number;
  trialEndsAt: string;
  trialDaysLeft: number;
  campaignName: string;
} {
  const planType: 'trial' | 'premium' =
    data?.plan_type === 'premium' ? 'premium' : 'trial';
  const settings = data?.settings || {};
  const trialDays = Number(settings.trial_days || 30);

  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowJst.toISOString().substring(0, 10);

  let createdStr = todayStr;
  if (data?.created_at) {
    const cDate = new Date(data.created_at);
    if (!isNaN(cDate.getTime())) {
      createdStr = new Date(cDate.getTime() + 9 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10);
    }
  }

  let trialEndsAt = settings.trial_ends_at || '';
  if (!trialEndsAt || !/^\d{4}-\d{2}-\d{2}$/.test(trialEndsAt)) {
    const base = new Date(`${createdStr}T00:00:00+09:00`);
    base.setDate(base.getDate() + trialDays);
    trialEndsAt = new Date(base.getTime() + 9 * 60 * 60 * 1000)
      .toISOString()
      .substring(0, 10);
  }

  const todayMs = new Date(`${todayStr}T00:00:00+09:00`).getTime();
  const endMs = new Date(`${trialEndsAt}T00:00:00+09:00`).getTime();
  const diffDays = isNaN(endMs)
    ? 30
    : Math.ceil((endMs - todayMs) / (1000 * 60 * 60 * 24));

  const campaignName =
    settings.campaign_name ||
    (trialDays >= 180
      ? '🌸 半年無料キャンペーン'
      : trialDays >= 90
      ? '🎉 3ヶ月無料キャンペーン'
      : trialDays >= 60
      ? '🎁 2ヶ月無料キャンペーン'
      : '1ヶ月無料お試し');

  return {
    planType,
    trialDays,
    trialEndsAt,
    trialDaysLeft: Math.max(0, diffDays),
    campaignName,
  };
}

export function useCompany(explicitTenantId?: string | null): CompanyInfo {
  const [companyName, setCompanyName] = useState<string>('');
  const [postalCode, setPostalCode] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [bankInfo, setBankInfo] = useState<string>('');
  const [farmCode, setFarmCode] = useState<string>('');
  const [planType, setPlanType] = useState<'trial' | 'premium'>('premium');
  const [trialDays, setTrialDays] = useState<number>(30);
  const [trialEndsAt, setTrialEndsAt] = useState<string>('');
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(30);
  const [campaignName, setCampaignName] = useState<string>('');
  const [tenantId, setTenantId] = useState<string | null>(
    normalizeTenantId(explicitTenantId)
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCompany = useCallback(async () => {
    try {
      // 1. テナントIDの決定（引数指定およびURLクエリを最優先）
      let currentTenant = normalizeTenantId(explicitTenantId);
      if (!currentTenant && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        currentTenant = normalizeTenantId(
          urlParams.get('farm') ||
            urlParams.get('tenant') ||
            urlParams.get('ownerId') ||
            urlParams.get('farmId')
        );
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
            if (w && w.user_id) currentTenant = normalizeTenantId(w.user_id);
          } catch (e) {}
        }
        if (!currentTenant) {
          currentTenant = normalizeTenantId(localStorage.getItem('agri_owner_id'));
        }
      }

      setTenantId(currentTenant);

      if (!currentTenant || currentTenant === 'null' || currentTenant === 'undefined') {
        setCompanyName('');
        setIsLoading(false);
        return;
      }

      // テナントID固有のキャッシュを即時反映しつつ、バックグラウンドで最新DB情報を同期する
      const tenantCacheKey = `agri_company_${currentTenant}`;
      const tenantObjCacheKey = `agri_company_obj_${currentTenant}`;
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(tenantCacheKey);
        if (cached) {
          setCompanyName(cached);
        }
        try {
          const cachedObjStr = localStorage.getItem(tenantObjCacheKey);
          if (cachedObjStr) {
            const cachedObj = JSON.parse(cachedObjStr);
            if (cachedObj && cachedObj.company_name) {
              setCompanyName(cachedObj.company_name);
              setPostalCode(cachedObj.postal_code || '');
              setAddress(cachedObj.address || '');
              setPhone(cachedObj.phone || '');
              setInvoiceNumber(cachedObj.invoice_number || '');
              setBankInfo(cachedObj.bank_info || '');
              if (cachedObj.farm_code) setFarmCode(cachedObj.farm_code);
              if (cachedObj.plan_type) setPlanType(cachedObj.plan_type);
              if (cachedObj.trial_days) setTrialDays(cachedObj.trial_days);
              if (cachedObj.trial_ends_at) setTrialEndsAt(cachedObj.trial_ends_at);
              if (cachedObj.trial_days_left !== undefined)
                setTrialDaysLeft(cachedObj.trial_days_left);
              if (cachedObj.campaign_name) setCampaignName(cachedObj.campaign_name);
              setIsLoading(false);
            }
          }
        } catch (e) {}
      }

      // 2. company_settings テーブルから当該テナントIDの最新レコードを取得
      let data: any = null;
      const { data: clientData } = await supabase
        .from('company_settings')
        .select('*')
        .or(`user_id.eq.${currentTenant},id.eq.${currentTenant}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (clientData) {
        data = clientData;
      } else {
        const srvRes = await getCompanySettings(currentTenant);
        if (srvRes?.success && srvRes.data) {
          data = srvRes.data;
        }
      }

      if (data) {
        let name = data.company_name || '';
        if (!name) {
          if (currentTenant === '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04')
            name = '株式会社KAP';
          else if (currentTenant === '62163024-2c8e-4057-a872-2455dbc58d32')
            name = '佐原農園株式会社';
        }
        setCompanyName(name);
        setPostalCode(data.postal_code || '');
        setAddress(data.address || '');
        setPhone(data.phone || '');
        setInvoiceNumber(data.invoice_number || '');
        setBankInfo(data.bank_info || '');

        let resolvedFarmCode = data.farm_code || '';
        if (!resolvedFarmCode) {
          if (currentTenant === '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04')
            resolvedFarmCode = 'kap';
          else if (currentTenant === '62163024-2c8e-4057-a872-2455dbc58d32')
            resolvedFarmCode = 'sahara';
          else {
            const prefix =
              (name || 'farm').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'farm';
            resolvedFarmCode = `${prefix}`;
          }
        }
        setFarmCode(resolvedFarmCode);

        const trialMeta = computeTrialMeta(data);
        setPlanType(trialMeta.planType);
        setTrialDays(trialMeta.trialDays);
        setTrialEndsAt(trialMeta.trialEndsAt);
        setTrialDaysLeft(trialMeta.trialDaysLeft);
        setCampaignName(trialMeta.campaignName);

        if (typeof window !== 'undefined' && name) {
          localStorage.setItem(tenantCacheKey, name);
          try {
            localStorage.setItem(
              tenantObjCacheKey,
              JSON.stringify({
                company_name: name,
                postal_code: data.postal_code || '',
                address: data.address || '',
                phone: data.phone || '',
                invoice_number: data.invoice_number || '',
                bank_info: data.bank_info || '',
                farm_code: resolvedFarmCode,
                plan_type: trialMeta.planType,
                trial_days: trialMeta.trialDays,
                trial_ends_at: trialMeta.trialEndsAt,
                trial_days_left: trialMeta.trialDaysLeft,
                campaign_name: trialMeta.campaignName,
              })
            );
          } catch (e) {}
          localStorage.removeItem('agri_cached_company_name');
        }
      } else {
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
    planType,
    trialDays,
    trialEndsAt,
    trialDaysLeft,
    campaignName,
    tenantId,
    isLoading,
    refresh: fetchCompany,
  };
}
