"use client";

import React, { useEffect, use } from 'react';
import PortalPage from '../page';

export default function DedicatedFarmPortalPage({ params }: { params: Promise<{ farmId: string }> }) {
  const unwrappedParams = use(params);
  const farmId = unwrappedParams.farmId;

  useEffect(() => {
    if (farmId && typeof window !== 'undefined') {
      try {
        localStorage.setItem('agri_owner_id', farmId);
      } catch (e) {
        console.warn('Storage set failed in DedicatedFarmPortalPage:', e);
      }
    }
  }, [farmId]);

  return <PortalPage requestedFarmId={farmId} />;
}
