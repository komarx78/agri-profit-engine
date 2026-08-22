"use server";

import { supabase } from '@/lib/supabase';

// ---------------------------
// Customers
// ---------------------------
export async function getB2BCustomers(tenantId: string | null) {
  try {
    let query = supabase.from('b2b_customers').select('*').order('created_at', { ascending: false });
    if (tenantId) {
      // In a real app, you would filter by farm_id = tenantId.
      // Currently using a mocked tenant for prototyping if needed.
    }
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, customers: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createB2BCustomer(data: any) {
  try {
    const { error } = await supabase.from('b2b_customers').insert([data]);
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
    let query = supabase
      .from('b2b_orders')
      .select(`
        *,
        customer:b2b_customers(*),
        items:b2b_order_items(*, crop:crops(*))
      `)
      .order('delivery_date', { ascending: true });
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, orders: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createB2BOrder(orderData: any, orderItems: any[]) {
  try {
    // 1. Create Order
    const { data: newOrder, error: orderError } = await supabase
      .from('b2b_orders')
      .insert([orderData])
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

// ---------------------------
// Invoices
// ---------------------------
export async function getB2BInvoices(tenantId: string | null) {
  try {
    const { data, error } = await supabase
      .from('b2b_invoices')
      .select('*, customer:b2b_customers(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { success: true, invoices: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function generateInvoicesForMonth(targetMonth: string) {
  // Mock logic to find 'delivered' orders in the month and create invoices
  try {
    // 1. Fetch delivered orders not yet invoiced for this month
    const { data: orders, error: ordersError } = await supabase
      .from('b2b_orders')
      .select('*')
      .eq('status', 'delivered')
      // .like('delivery_date', `${targetMonth}%`); // simplified

    if (ordersError) throw ordersError;
    if (!orders || orders.length === 0) return { success: true, count: 0 };

    // Group by customer
    const grouped: any = {};
    orders.forEach(o => {
      if(o.delivery_date.startsWith(targetMonth)) {
        if (!grouped[o.customer_id]) grouped[o.customer_id] = 0;
        grouped[o.customer_id] += Number(o.total_amount || 0);
      }
    });

    // Create invoices
    let count = 0;
    for (const customerId of Object.keys(grouped)) {
      if (grouped[customerId] > 0) {
        // Fetch customer to get terms
        const { data: customer } = await supabase.from('b2b_customers').select('*').eq('id', customerId).single();
        
        let dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + 1);
        dueDate.setDate(customer?.payment_day || 31); // simplifed
        
        await supabase.from('b2b_invoices').insert([{
          customer_id: customerId,
          target_month: targetMonth,
          total_amount: grouped[customerId],
          issue_date: new Date().toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          status: 'unpaid'
        }]);
        
        // Mark orders as invoiced
        await supabase.from('b2b_orders').update({ status: 'invoiced' }).eq('customer_id', customerId).eq('status', 'delivered').like('delivery_date', `${targetMonth}%`);
        
        count++;
      }
    }

    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
