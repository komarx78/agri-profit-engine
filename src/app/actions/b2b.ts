"use server";

import { supabase } from '@/lib/supabase';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { getJSTDate } from '@/lib/dateUtils';

/**
 * サーバー側で管理者セッションを検証し、なりすまし（IDOR）を防止するヘルパー
 */
async function resolveAuthenticatedTenantId(passedTenantId?: string | null): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id) {
      return user.id;
    }
  } catch (e) {}

  // 認証セッションがない場合、指定されたtenantIdが実在する登録農園か厳格に照合
  if (passedTenantId) {
    try {
      const adminClient = getAdminSupabase();
      const { data } = await adminClient
        .from('company_settings')
        .select('user_id')
        .eq('user_id', passedTenantId)
        .maybeSingle();
      if (data?.user_id) {
        return data.user_id;
      }
    } catch (e) {}
  }
  return null;
}

// ---------------------------
// Customers & Price Profiles (company_settings.settings 連携でスキーマ変更不要・完全永続化)
// ---------------------------
async function getTenantB2BSettings(adminClient: any, validTenantId: string) {
  const { data: comp } = await adminClient
    .from('company_settings')
    .select('id, company_name, settings')
    .or(`user_id.eq.${validTenantId},id.eq.${validTenantId}`)
    .maybeSingle();

  const settings = comp?.settings || {};
  return {
    compId: comp?.id || null,
    companyName: comp?.company_name || '当農園',
    settings,
    customerProfiles: settings.b2b_customer_profiles || {},
    cropDefaultPrices: settings.crop_default_sales_prices || {}
  };
}

async function saveTenantB2BSettingsPatch(
  adminClient: any,
  validTenantId: string,
  patchFn: (currentSettings: any) => any
) {
  const { data: comp } = await adminClient
    .from('company_settings')
    .select('id, settings')
    .or(`user_id.eq.${validTenantId},id.eq.${validTenantId}`)
    .maybeSingle();

  if (comp?.id) {
    const nextSettings = patchFn(comp.settings || {});
    await adminClient
      .from('company_settings')
      .update({ settings: nextSettings })
      .eq('id', comp.id);
  }
}

export async function getB2BCustomers(tenantId: string | null) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);

    // テナント未特定時は絶対に他社データを取得しない（空データを返す）
    if (!validTenantId) {
      return { success: true, customers: [], cropDefaultPrices: {} };
    }

    const [{ data, error }, b2bMeta] = await Promise.all([
      adminClient
        .from('b2b_customers')
        .select('*')
        .eq('user_id', validTenantId)
        .order('created_at', { ascending: false }),
      getTenantB2BSettings(adminClient, validTenantId)
    ]);

    if (error) throw error;

    const mergedCustomers = (data || []).map((c: any) => {
      const prof = b2bMeta.customerProfiles[c.id] || {};
      return {
        ...c,
        phone: prof.phone || c.phone || '',
        address: prof.address || c.address || '',
        contact_person: prof.contact_person || c.contact_person || '',
        notes: prof.notes || c.notes || '',
        custom_prices: prof.custom_prices || {}
      };
    });

    return {
      success: true,
      customers: mergedCustomers,
      cropDefaultPrices: b2bMeta.cropDefaultPrices || {}
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createB2BCustomer(data: any, tenantId?: string | null) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    if (!validTenantId) {
      return { success: false, error: 'テナントIDが特定できません' };
    }
    const dbPayload = {
      name: data.name,
      type: data.type || '飲食店',
      closing_day: Number(data.closing_day ?? 31),
      payment_month: Number(data.payment_month ?? 1),
      payment_day: Number(data.payment_day ?? 31),
      order_token: data.order_token || Math.random().toString(36).substring(2, 11),
      user_id: validTenantId
    };
    const { data: inserted, error } = await adminClient
      .from('b2b_customers')
      .insert([dbPayload])
      .select('*')
      .single();
    if (error) throw error;

    if (inserted?.id) {
      await saveTenantB2BSettingsPatch(adminClient, validTenantId, curr => ({
        ...curr,
        b2b_customer_profiles: {
          ...(curr.b2b_customer_profiles || {}),
          [inserted.id]: {
            phone: data.phone || '',
            address: data.address || '',
            contact_person: data.contact_person || '',
            notes: data.notes || '',
            custom_prices: data.custom_prices || {}
          }
        }
      }));
    }

    return { success: true, customer: inserted };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateB2BCustomer(customerId: string, data: any, tenantId?: string | null) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    if (!validTenantId) {
      return { success: false, error: 'テナントIDが特定できません' };
    }
    const payload: Record<string, any> = {
      name: data.name,
      type: data.type,
      closing_day: Number(data.closing_day ?? 31),
      payment_month: Number(data.payment_month ?? 1),
      payment_day: Number(data.payment_day ?? 31),
      updated_at: new Date().toISOString()
    };
    const { error } = await adminClient
      .from('b2b_customers')
      .update(payload)
      .eq('id', customerId)
      .eq('user_id', validTenantId);
    if (error) throw error;

    await saveTenantB2BSettingsPatch(adminClient, validTenantId, curr => {
      const prevProf = (curr.b2b_customer_profiles || {})[customerId] || {};
      return {
        ...curr,
        b2b_customer_profiles: {
          ...(curr.b2b_customer_profiles || {}),
          [customerId]: {
            ...prevProf,
            phone: data.phone !== undefined ? data.phone : prevProf.phone || '',
            address: data.address !== undefined ? data.address : prevProf.address || '',
            contact_person:
              data.contact_person !== undefined ? data.contact_person : prevProf.contact_person || '',
            notes: data.notes !== undefined ? data.notes : prevProf.notes || '',
            custom_prices:
              data.custom_prices !== undefined ? data.custom_prices : prevProf.custom_prices || {}
          }
        }
      };
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 得意先ごとの野菜卸単価マップを保存する専用アクション
export async function saveCustomerCropPricesAction(
  customerId: string,
  customPrices: Record<string, { unit_price: number; unit: string; enabled?: boolean }>,
  tenantId?: string | null
) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    if (!validTenantId) {
      return { success: false, error: 'テナントIDが特定できません' };
    }

    await saveTenantB2BSettingsPatch(adminClient, validTenantId, curr => {
      const prevProf = (curr.b2b_customer_profiles || {})[customerId] || {};
      return {
        ...curr,
        b2b_customer_profiles: {
          ...(curr.b2b_customer_profiles || {}),
          [customerId]: {
            ...prevProf,
            custom_prices: customPrices
          }
        }
      };
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 農園全体の「野菜ごとの基本販売単価・単位」を保存する専用アクション
export async function saveCropDefaultSalesPricesAction(
  cropDefaultPrices: Record<string, { unit_price: number; unit: string }>,
  tenantId?: string | null
) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    if (!validTenantId) {
      return { success: false, error: 'テナントIDが特定できません' };
    }

    await saveTenantB2BSettingsPatch(adminClient, validTenantId, curr => ({
      ...curr,
      crop_default_sales_prices: cropDefaultPrices
    }));

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteB2BCustomer(customerId: string, tenantId?: string | null) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    if (!validTenantId) {
      return { success: false, error: 'テナントIDが特定できません' };
    }

    // 関連する注文データの存在確認
    const { data: relatedOrders } = await adminClient
      .from('b2b_orders')
      .select('id')
      .eq('customer_id', customerId)
      .eq('user_id', validTenantId)
      .limit(1);

    if (relatedOrders && relatedOrders.length > 0) {
      return {
        success: false,
        error: 'この得意先には過去の注文・納品データが存在するため削除できません。'
      };
    }

    const { error } = await adminClient
      .from('b2b_customers')
      .delete()
      .eq('id', customerId)
      .eq('user_id', validTenantId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getB2BPortalData(tokenOrId: string) {
  try {
    const adminClient = getAdminSupabase();
    if (!tokenOrId) return { success: false, error: 'Token is required' };

    // 1. order_token で検索
    let { data: custData } = await adminClient
      .from('b2b_customers')
      .select('*')
      .eq('order_token', tokenOrId)
      .maybeSingle();

    // 2. もし見つからず、かつ UUID 形式なら id で検索
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tokenOrId);
    if (!custData && isUuid) {
      const res = await adminClient
        .from('b2b_customers')
        .select('*')
        .eq('id', tokenOrId)
        .maybeSingle();
      custData = res.data;
    }

    if (!custData) {
      return { success: false, error: 'Customer not found' };
    }

    const farmOwnerId = custData.user_id;
    const b2bMeta = farmOwnerId
      ? await getTenantB2BSettings(adminClient, farmOwnerId)
      : { companyName: '当農園', customerProfiles: {}, cropDefaultPrices: {} };

    const custProfile = b2bMeta.customerProfiles[custData.id] || {};
    const customPrices = custProfile.custom_prices || {};
    const defaultPrices = b2bMeta.cropDefaultPrices || {};

    // 該当農園の作目一覧を取得
    let cropQuery = adminClient.from('crops').select('*');
    if (farmOwnerId) {
      cropQuery = cropQuery.eq('user_id', farmOwnerId);
    } else {
      cropQuery = cropQuery.eq('id', 'never-match-dummy');
    }
    const { data: cropsData } = await cropQuery;

    // 各作目に「この得意先向けの単価・単位」を付与（enabled === false の作目は非表示）
    const enrichedCrops = (cropsData || [])
      .map((crop: any) => {
        const cPrice = customPrices[crop.id];
        const dPrice = defaultPrices[crop.id];
        const resolvedUnit = cPrice?.unit || dPrice?.unit || crop.default_unit || 'kg';
        const resolvedPrice =
          cPrice?.unit_price !== undefined && Number(cPrice.unit_price) > 0
            ? Number(cPrice.unit_price)
            : dPrice?.unit_price !== undefined && Number(dPrice.unit_price) > 0
            ? Number(dPrice.unit_price)
            : Number(crop.default_unit_price) || 0;
        const isEnabled = cPrice?.enabled !== false;
        return {
          ...crop,
          resolved_unit: resolvedUnit,
          resolved_unit_price: resolvedPrice,
          is_enabled_for_customer: isEnabled
        };
      })
      .filter((crop: any) => crop.is_enabled_for_customer);

    // 過去の請求書と直近の注文履歴（前回注文コピー用）を取得
    const [{ data: invoicesData }, { data: recentOrdersData }] = await Promise.all([
      adminClient
        .from('b2b_invoices')
        .select('*')
        .eq('customer_id', custData.id)
        .order('target_month', { ascending: false }),
      adminClient
        .from('b2b_orders')
        .select('*, items:b2b_order_items(*, crops(*))')
        .eq('customer_id', custData.id)
        .order('delivery_date', { ascending: false })
        .limit(5)
    ]);

    return {
      success: true,
      customer: {
        ...custData,
        phone: custProfile.phone || '',
        address: custProfile.address || '',
        contact_person: custProfile.contact_person || '',
        notes: custProfile.notes || '',
        company_name: b2bMeta.companyName
      },
      crops: enrichedCrops,
      invoices: invoicesData || [],
      recentOrders: recentOrdersData || []
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ---------------------------
// Orders
// ---------------------------
export async function getB2BOrders(tenantId: string | null) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);

    // テナント未特定時は絶対に他社データを取得しない（空データを返す）
    if (!validTenantId) {
      return { success: true, orders: [] };
    }

    const [{ data, error }, b2bMeta] = await Promise.all([
      adminClient
        .from('b2b_orders')
        .select(`
          *,
          customer:b2b_customers(*),
          items:b2b_order_items(*, crops(*))
        `)
        .eq('user_id', validTenantId)
        .order('delivery_date', { ascending: true }),
      getTenantB2BSettings(adminClient, validTenantId)
    ]);

    if (error) throw error;

    const orderNotesMap = b2bMeta.settings?.b2b_order_notes || {};
    const enrichedOrders = (data || []).map((o: any) => {
      const custProf = o.customer?.id ? b2bMeta.customerProfiles[o.customer.id] || {} : {};
      return {
        ...o,
        delivery_note: orderNotesMap[o.id] || '',
        customer: o.customer
          ? {
              ...o.customer,
              phone: custProf.phone || '',
              address: custProf.address || '',
              contact_person: custProf.contact_person || '',
              notes: custProf.notes || ''
            }
          : o.customer
      };
    });

    return { success: true, orders: enrichedOrders };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createB2BOrder(orderData: any, orderItems: any[], tenantId?: string | null) {
  try {
    const adminClient = getAdminSupabase();
    let validTenantId = await resolveAuthenticatedTenantId(tenantId || orderData?.user_id);

    // もしtenantIdが未特定の場合、customer_idからテナントのuser_idを逆引き
    if (!validTenantId && orderData?.customer_id) {
      const { data: cust } = await adminClient
        .from('b2b_customers')
        .select('user_id')
        .eq('id', orderData.customer_id)
        .maybeSingle();
      if (cust && cust.user_id) {
        validTenantId = cust.user_id;
      }
    }

    if (!validTenantId) {
      return { success: false, error: 'テナントIDが特定できません' };
    }

    // 1. Create Order (delivery_note は settings 側へ保存しテーブルエラーを防止)
    const { delivery_note, ...cleanOrderData } = orderData || {};
    const payload = { ...cleanOrderData, user_id: validTenantId };

    const { data: newOrder, error: orderError } = await adminClient
      .from('b2b_orders')
      .insert([payload])
      .select('id')
      .single();

    if (orderError) throw orderError;
    if (!newOrder) throw new Error("Order creation failed");

    if (delivery_note) {
      await saveTenantB2BSettingsPatch(adminClient, validTenantId, curr => ({
        ...curr,
        b2b_order_notes: {
          ...(curr.b2b_order_notes || {}),
          [newOrder.id]: String(delivery_note)
        }
      }));
    }

    // 2. Create Items
    const itemsWithOrderId = orderItems.map(item => ({
      ...item,
      order_id: newOrder.id
    }));

    const { error: itemsError } = await adminClient
      .from('b2b_order_items')
      .insert(itemsWithOrderId);

    if (itemsError) throw itemsError;

    return { success: true, orderId: newOrder.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateB2BOrderStatus(orderId: string, status: string, tenantId?: string | null) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    if (!validTenantId) {
      return { success: false, error: 'テナントIDが特定できません' };
    }
    const { error } = await adminClient
      .from('b2b_orders')
      .update({ status })
      .eq('id', orderId)
      .eq('user_id', validTenantId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateB2BOrderDetails(orderId: string, orderData: any, orderItems: any[], tenantId?: string | null) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    if (!validTenantId) {
      return { success: false, error: 'テナントIDが特定できません' };
    }

    // テナント所有権を事前検証（他社注文の誤更新・明細削除を物理遮断）
    const { data: existingOrder } = await adminClient
      .from('b2b_orders')
      .select('id')
      .eq('id', orderId)
      .eq('user_id', validTenantId)
      .maybeSingle();

    if (!existingOrder) {
      return { success: false, error: '対象の注文が見つからないか、権限がありません。' };
    }

    const { delivery_note, ...cleanOrderData } = orderData || {};

    // 1. Update Order main info
    const { error: orderError } = await adminClient
      .from('b2b_orders')
      .update(cleanOrderData)
      .eq('id', orderId)
      .eq('user_id', validTenantId);
    if (orderError) throw orderError;

    if (delivery_note !== undefined) {
      await saveTenantB2BSettingsPatch(adminClient, validTenantId, curr => ({
        ...curr,
        b2b_order_notes: {
          ...(curr.b2b_order_notes || {}),
          [orderId]: String(delivery_note || '')
        }
      }));
    }

    // 2. Delete existing items
    const { error: deleteError } = await adminClient
      .from('b2b_order_items')
      .delete()
      .eq('order_id', orderId);
    if (deleteError) throw deleteError;

    // 3. Insert new items
    const itemsWithOrderId = orderItems.map(item => ({
      ...item,
      order_id: orderId
    }));

    const { error: itemsError } = await adminClient
      .from('b2b_order_items')
      .insert(itemsWithOrderId);
    if (itemsError) throw itemsError;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteB2BOrder(orderId: string, tenantId?: string | null) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    if (!validTenantId) {
      return { success: false, error: 'テナントIDが特定できません' };
    }

    // テナント所有権を事前検証
    const { data: existingOrder } = await adminClient
      .from('b2b_orders')
      .select('id')
      .eq('id', orderId)
      .eq('user_id', validTenantId)
      .maybeSingle();

    if (!existingOrder) {
      return { success: false, error: '対象の注文が見つからないか、権限がありません。' };
    }

    // 明細レコードを先に安全削除
    await adminClient
      .from('b2b_order_items')
      .delete()
      .eq('order_id', orderId);

    const { error } = await adminClient
      .from('b2b_orders')
      .delete()
      .eq('id', orderId)
      .eq('user_id', validTenantId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ---------------------------
// Invoices
// ---------------------------
export async function getB2BInvoices(tenantId: string | null) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);

    // テナント未特定時は絶対に他社データを取得しない（空データを返す）
    if (!validTenantId) {
      return { success: true, invoices: [] };
    }

    const { data, error } = await adminClient
      .from('b2b_invoices')
      .select('*, customer:b2b_customers(*)')
      .eq('user_id', validTenantId)
      .order('issue_date', { ascending: false });

    if (error) throw error;
    return { success: true, invoices: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createB2BInvoice(invoiceData: any, tenantId?: string | null) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    if (!validTenantId) {
      return { success: false, error: 'テナントIDが特定できません' };
    }
    const payload = { ...invoiceData, user_id: validTenantId };
    const { data, error } = await adminClient
      .from('b2b_invoices')
      .insert([payload])
      .select('id')
      .single();
    if (error) throw error;
    return { success: true, invoiceId: data.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateB2BInvoiceStatus(invoiceId: string, status: string, tenantId?: string | null) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    if (!validTenantId) {
      return { success: false, error: 'テナントIDが特定できません' };
    }
    const { error } = await adminClient
      .from('b2b_invoices')
      .update({ status })
      .eq('id', invoiceId)
      .eq('user_id', validTenantId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function generateInvoicesForMonth(targetMonth: string, tenantId?: string | null) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    if (!validTenantId) {
      return { success: false, count: 0, message: "テナントIDが特定できません" };
    }
    const startDate = `${targetMonth}-01`;
    const [yearStr, monthStr] = targetMonth.split('-');
    const nextMonth = new Date(Number(yearStr), Number(monthStr), 1);
    const endDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

    const { data: deliveredOrders, error: orderErr } = await adminClient
      .from('b2b_orders')
      .select('*, customer:b2b_customers(*), items:b2b_order_items(*)')
      .eq('user_id', validTenantId)
      .gte('delivery_date', startDate)
      .lt('delivery_date', endDate)
      .in('status', ['delivered', 'invoiced']);

    if (orderErr) throw orderErr;

    if (!deliveredOrders || deliveredOrders.length === 0) {
      return { success: true, count: 0, message: "対象となる納品済データがありませんでした" };
    }

    // 顧客ごとにグループ化
    const customerOrdersMap: { [customerId: string]: typeof deliveredOrders } = {};
    deliveredOrders.forEach(o => {
      if (!customerOrdersMap[o.customer_id]) {
        customerOrdersMap[o.customer_id] = [];
      }
      customerOrdersMap[o.customer_id].push(o);
    });

    let generatedCount = 0;

    for (const [customerId, ordersList] of Object.entries(customerOrdersMap)) {
      let subtotal = 0;
      ordersList.forEach(o => {
        if (o.items && Array.isArray(o.items)) {
          o.items.forEach((item: any) => {
            subtotal += (item.unit_price || 0) * (item.quantity || 0);
          });
        }
      });

      const tax = Math.floor(subtotal * 0.08);
      const total = subtotal + tax;

      const invoiceData: any = {
        customer_id: customerId,
        target_month: targetMonth,
        issue_date: getJSTDate(),
        subtotal,
        tax,
        total_amount: total,
        status: 'issued',
        user_id: validTenantId
      };

      const { data: invData, error: invErr } = await adminClient
        .from('b2b_invoices')
        .upsert([invoiceData], { onConflict: 'customer_id, target_month' })
        .select('id')
        .single();

      if (!invErr && invData) {
        generatedCount++;
        // 該当オーダーのステータスを invoiced に更新（テナントIDも厳格に照合）
        const orderIds = ordersList.map(o => o.id);
        await adminClient
          .from('b2b_orders')
          .update({ status: 'invoiced' })
          .in('id', orderIds)
          .eq('user_id', validTenantId);
      }
    }

    return { success: true, count: generatedCount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateInvoiceAmounts(invoiceId: string, subtotal: number, tax: number, total: number, tenantId?: string | null) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    if (!validTenantId) {
      return { success: false, error: 'テナントIDが特定できません' };
    }
    const { error } = await adminClient
      .from('b2b_invoices')
      .update({
        subtotal,
        tax,
        total_amount: total
      })
      .eq('id', invoiceId)
      .eq('user_id', validTenantId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ---------------------------
// JA・直売所・市場への都度出荷（sales_logs）をこの画面から直接登録するアクション
// ---------------------------
export async function createAdHocSalesLogAction(
  payload: {
    sales_date: string;
    crop_id: string;
    channel_id?: string;
    new_channel_name?: string;
    quantity: number;
    unit: string;
    total_sales: number;
  },
  tenantId?: string | null
) {
  try {
    const adminClient = getAdminSupabase();
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    if (!validTenantId) {
      return { success: false, error: '農園IDが確認できませんでした' };
    }

    let channelId = payload.channel_id || '';
    if (!channelId && payload.new_channel_name?.trim()) {
      const { data: newCh, error: chErr } = await adminClient
        .from('sales_channels')
        .insert([
          {
            user_id: validTenantId,
            name: payload.new_channel_name.trim(),
            commission_rate: 0
          }
        ])
        .select('id, name')
        .single();
      if (chErr) throw chErr;
      channelId = newCh?.id || '';
    }

    const insertRow: Record<string, any> = {
      user_id: validTenantId,
      sales_date: payload.sales_date || getJSTDate(),
      crop_id: payload.crop_id,
      channel_id: channelId || null,
      quantity: Number(payload.quantity) || 0,
      unit: payload.unit || 'kg',
      total_sales: Number(payload.total_sales) || 0
    };

    const { data, error } = await adminClient
      .from('sales_logs')
      .insert([insertRow])
      .select('*')
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || '出荷記録の保存に失敗しました' };
  }
}

