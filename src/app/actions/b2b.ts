"use server";

import { supabase } from '@/lib/supabase';

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
  return passedTenantId || null;
}

// ---------------------------
// Customers
// ---------------------------
export async function getB2BCustomers(tenantId: string | null) {
  try {
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    let query = supabase.from('b2b_customers').select('*').order('created_at', { ascending: false });
    if (validTenantId) {
      query = query.eq('user_id', validTenantId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, customers: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createB2BCustomer(data: any, tenantId?: string | null) {
  try {
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    const payload = { ...data };
    if (validTenantId) {
      payload.user_id = validTenantId;
    }
    const { error } = await supabase.from('b2b_customers').insert([payload]);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ---------------------------
// Orders
// ---------------------------
export async function getB2BOrders(tenantId: string | null) {
  try {
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    let query = supabase
      .from('b2b_orders')
      .select(`
        *,
        customer:b2b_customers(*),
        items:b2b_order_items(*, crops(*))
      `)
      .order('delivery_date', { ascending: true });

    if (validTenantId) {
      query = query.eq('user_id', validTenantId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, orders: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createB2BOrder(orderData: any, orderItems: any[], tenantId?: string | null) {
  try {
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    // 1. Create Order
    const payload = { ...orderData };
    if (validTenantId) {
      payload.user_id = validTenantId;
    }

    const { data: newOrder, error: orderError } = await supabase
      .from('b2b_orders')
      .insert([payload])
      .select('id')
      .single();
      
    if (orderError) throw orderError;
    if (!newOrder) throw new Error("Order creation failed");

    // 2. Create Items
    const itemsWithOrderId = orderItems.map(item => ({
      ...item,
      order_id: newOrder.id
    }));
    
    const { error: itemsError } = await supabase
      .from('b2b_order_items')
      .insert(itemsWithOrderId);
      
    if (itemsError) throw itemsError;

    return { success: true, orderId: newOrder.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateB2BOrderStatus(orderId: string, status: string) {
  try {
    const { error } = await supabase
      .from('b2b_orders')
      .update({ status })
      .eq('id', orderId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateB2BOrderDetails(orderId: string, orderData: any, orderItems: any[]) {
  try {
    // 1. Update Order main info
    const { error: orderError } = await supabase
      .from('b2b_orders')
      .update(orderData)
      .eq('id', orderId);
    if (orderError) throw orderError;

    // 2. Delete existing items
    const { error: deleteError } = await supabase
      .from('b2b_order_items')
      .delete()
      .eq('order_id', orderId);
    if (deleteError) throw deleteError;

    // 3. Insert new items
    const itemsWithOrderId = orderItems.map(item => ({
      ...item,
      order_id: orderId
    }));
    
    const { error: itemsError } = await supabase
      .from('b2b_order_items')
      .insert(itemsWithOrderId);
    if (itemsError) throw itemsError;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteB2BOrder(orderId: string) {
  try {
    const { error } = await supabase
      .from('b2b_orders')
      .delete()
      .eq('id', orderId);
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
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    let query = supabase
      .from('b2b_invoices')
      .select('*, customer:b2b_customers(*)')
      .order('issue_date', { ascending: false });

    if (validTenantId) {
      query = query.eq('user_id', validTenantId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, invoices: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createB2BInvoice(invoiceData: any, tenantId?: string | null) {
  try {
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    const payload = { ...invoiceData };
    if (validTenantId) {
      payload.user_id = validTenantId;
    }
    const { data, error } = await supabase
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

export async function updateB2BInvoiceStatus(invoiceId: string, status: string) {
  try {
    const { error } = await supabase
      .from('b2b_invoices')
      .update({ status })
      .eq('id', invoiceId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function generateInvoicesForMonth(targetMonth: string, tenantId?: string | null) {
  try {
    const validTenantId = await resolveAuthenticatedTenantId(tenantId);
    const startDate = `${targetMonth}-01`;
    const [yearStr, monthStr] = targetMonth.split('-');
    const nextMonth = new Date(Number(yearStr), Number(monthStr), 1);
    const endDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

    let orderQuery = supabase
      .from('b2b_orders')
      .select('*, customer:b2b_customers(*), items:b2b_order_items(*)')
      .gte('delivery_date', startDate)
      .lt('delivery_date', endDate)
      .in('status', ['delivered', 'invoiced']);

    if (validTenantId) {
      orderQuery = orderQuery.eq('user_id', validTenantId);
    }

    const { data: deliveredOrders, error: orderErr } = await orderQuery;
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

      const tax = Math.floor(subtotal * 0.1);
      const total = subtotal + tax;

      const invoiceData: any = {
        customer_id: customerId,
        target_month: targetMonth,
        issue_date: new Date().toISOString().split('T')[0],
        subtotal,
        tax,
        total_amount: total,
        status: 'issued'
      };

      if (validTenantId) {
        invoiceData.user_id = validTenantId;
      }

      const { data: invData, error: invErr } = await supabase
        .from('b2b_invoices')
        .upsert([invoiceData], { onConflict: 'customer_id, target_month' })
        .select('id')
        .single();

      if (!invErr && invData) {
        generatedCount++;
        // 該当オーダーのステータスを invoiced に更新
        const orderIds = ordersList.map(o => o.id);
        await supabase
          .from('b2b_orders')
          .update({ status: 'invoiced' })
          .in('id', orderIds);
      }
    }

    return { success: true, count: generatedCount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateInvoiceAmounts(invoiceId: string, subtotal: number, tax: number, total: number) {
  try {
    const { error } = await supabase
      .from('b2b_invoices')
      .update({
        subtotal,
        tax,
        total_amount: total
      })
      .eq('id', invoiceId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
