import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// ============================================
// HELPERS
// ============================================

const TERMINAL_ORDER_STATUSES = ['confirmed', 'completed', 'cancelled'];

async function getSubmittedPaymentTotal(orderId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('amount, status')
    .eq('sales_order_id', orderId)
    .in('status', ['pending', 'confirmed']);

  if (error) throw error;

  return (data || []).reduce((sum, payment) => {
    return sum + Number(payment.amount || 0);
  }, 0);
}

async function updateOrderStatusFromSubmittedPayments(orderId: string) {
  const { data: order, error: orderError } = await supabase
    .from('sales_orders')
    .select('id, total_amount, status')
    .eq('id', orderId)
    .single();

  if (orderError) throw orderError;
  if (!order) return null;

  if (TERMINAL_ORDER_STATUSES.includes(order.status)) {
    return order.status;
  }

  const submittedTotal = await getSubmittedPaymentTotal(orderId);
  const orderTotal = Number(order.total_amount || 0);

  const newStatus = submittedTotal >= orderTotal ? 'pending_admin' : 'pending';

  if (order.status !== newStatus) {
    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (updateError) throw updateError;

    await supabase.from('order_history').insert({
      sales_order_id: orderId,
      action: 'payment_progress_updated',
      old_status: order.status,
      new_status: newStatus,
      notes:
        newStatus === 'pending_admin'
          ? 'Full payment submitted by worker, waiting for admin approval'
          : 'Partial payment submitted, order remains pending',
    });
  }

  return newStatus;
}

async function reserveOrderItems(orderId: string, performedBy: string | null = null) {
  const { data: items, error: itemsError } = await supabase
    .from('sales_order_items')
    .select('*')
    .eq('sales_order_id', orderId);

  if (itemsError) throw itemsError;
  if (!items || items.length === 0) return;

  for (const item of items) {
    if (item.item_type === 'vehicle' && item.vehicle_id) {
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('status')
        .eq('id', item.vehicle_id)
        .single();

      if (vehicle?.status === 'available') {
        await supabase
          .from('vehicles')
          .update({ status: 'reserved' })
          .eq('id', item.vehicle_id);

        await supabase.from('vehicle_history').insert({
          vehicle_id: item.vehicle_id,
          event_type: 'reserved',
          sales_order_id: orderId,
          performed_by: performedBy,
          notes: 'Reserved after worker submitted payment',
        });
      }
    }

    if (item.item_type === 'part' && item.part_id) {
      const { data: part, error: partError } = await supabase
        .from('parts')
        .select('reserved_quantity')
        .eq('id', item.part_id)
        .single();

      if (partError) throw partError;

      const currentReserved = Number(part?.reserved_quantity || 0);

      // Avoid double-reserving the same order by checking existing transaction.
      const { data: existingReservation } = await supabase
        .from('part_transactions')
        .select('id')
        .eq('part_id', item.part_id)
        .eq('sales_order_id', orderId)
        .eq('transaction_type', 'reserved')
        .maybeSingle();

      if (!existingReservation) {
        const newReserved = currentReserved + Number(item.quantity || 0);

        await supabase
          .from('parts')
          .update({ reserved_quantity: newReserved })
          .eq('id', item.part_id);

        await supabase.from('part_transactions').insert({
          part_id: item.part_id,
          transaction_type: 'reserved',
          quantity_change: item.quantity,
          quantity_after: newReserved,
          sales_order_id: orderId,
          performed_by: performedBy,
          notes: 'Reserved after worker submitted payment',
        });
      }
    }
  }
}

async function releaseReservedItems(orderId: string, performedBy: string | null = null) {
  const { data: items, error: itemsError } = await supabase
    .from('sales_order_items')
    .select('*')
    .eq('sales_order_id', orderId);

  if (itemsError) throw itemsError;
  if (!items) return;

  for (const item of items) {
    if (item.item_type === 'vehicle' && item.vehicle_id) {
      await supabase
        .from('vehicles')
        .update({ status: 'available' })
        .eq('id', item.vehicle_id);

      await supabase.from('vehicle_history').insert({
        vehicle_id: item.vehicle_id,
        event_type: 'returned',
        sales_order_id: orderId,
        performed_by: performedBy,
        notes: 'Reservation released due to order cancellation',
      });
    }

    if (item.item_type === 'part' && item.part_id) {
      const { data: part, error: partError } = await supabase
        .from('parts')
        .select('reserved_quantity')
        .eq('id', item.part_id)
        .single();

      if (partError) throw partError;

      const newReserved = Math.max(
        0,
        Number(part?.reserved_quantity || 0) - Number(item.quantity || 0)
      );

      await supabase
        .from('parts')
        .update({ reserved_quantity: newReserved })
        .eq('id', item.part_id);

      await supabase.from('part_transactions').insert({
        part_id: item.part_id,
        transaction_type: 'returned',
        quantity_change: -Number(item.quantity || 0),
        quantity_after: newReserved,
        sales_order_id: orderId,
        performed_by: performedBy,
        notes: 'Reservation released due to order cancellation',
      });
    }
  }
}

// ============================================
// RECORD DEPOSIT
// Worker adds another payment.
// If total submitted reaches full amount, order becomes pending_admin.
// Otherwise it stays pending.
// ============================================
export const recordDeposit = async (req: Request, res: Response) => {
  try {
    const {
      sales_order_id,
      payment_method,
      bank_name,
      reference_number,
      amount,
      notes,
    } = req.body;

    if (!sales_order_id) {
      return res.status(400).json({
        success: false,
        error: 'Sales order ID is required',
      });
    }

    const paymentAmount = Number(amount || 0);

    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required',
      });
    }

    if (!payment_method) {
      return res.status(400).json({
        success: false,
        error: 'Payment method is required',
      });
    }

    if (payment_method !== 'cash' && !bank_name) {
      return res.status(400).json({
        success: false,
        error: 'Bank name is required for non-cash payments',
      });
    }

    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('id, order_number, total_amount, customer_id, status')
      .eq('id', sales_order_id)
      .single();

    if (orderError) throw orderError;

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Sales order not found',
      });
    }

    if (TERMINAL_ORDER_STATUSES.includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot add payment to an order that is ${order.status}`,
      });
    }

    const submittedBefore = await getSubmittedPaymentTotal(sales_order_id);
    const orderTotal = Number(order.total_amount || 0);
    const remainingBefore = Math.max(0, orderTotal - submittedBefore);

    if (paymentAmount > remainingBefore) {
      return res.status(400).json({
        success: false,
        error: `Payment amount cannot exceed remaining balance. Remaining: ${remainingBefore}`,
      });
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([
        {
          sales_order_id,
          payment_method,
          bank_name: bank_name || null,
          reference_number: reference_number || null,
          amount: paymentAmount,
          status: 'pending',
          notes: notes || null,
        },
      ])
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Make sure the inventory is reserved once payment exists.
    if (order.status !== 'pending' && order.status !== 'pending_admin') {
      await reserveOrderItems(sales_order_id, null);
    }

    const newOrderStatus = await updateOrderStatusFromSubmittedPayments(sales_order_id);

    const submittedTotal = await getSubmittedPaymentTotal(sales_order_id);
    const remainingAmount = Math.max(0, orderTotal - submittedTotal);

    const { data: customer } = await supabase
      .from('customers')
      .select('full_name')
      .eq('id', order.customer_id)
      .single();

    res.json({
      success: true,
      data: {
        id: payment.id,
        sales_order_id: payment.sales_order_id,
        order_number: order.order_number,
        customer_name: customer?.full_name,
        payment_method: payment.payment_method,
        bank_name: payment.bank_name,
        reference_number: payment.reference_number,
        amount: payment.amount,
        payment_status: payment.status,
        order_status: newOrderStatus,
        submitted_total: submittedTotal,
        order_total: orderTotal,
        remaining_amount: remainingAmount,
        is_fully_submitted: submittedTotal >= orderTotal,
        notes: payment.notes,
        created_at: payment.created_at,
      },
      message:
        submittedTotal >= orderTotal
          ? 'Full payment submitted. Order is now waiting for admin approval.'
          : `Payment submitted. Remaining amount: ${remainingAmount}`,
    });
  } catch (error) {
    console.error('Error recording deposit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record deposit',
    });
  }
};

// ============================================
// CONFIRM DEPOSIT
// Admin confirms a payment record.
// This does NOT decide pending_admin. Worker-submitted amount already does that.
// ============================================
export const confirmDeposit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { confirmed_by } = req.body;

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*, sales_order:sales_order_id (order_number, total_amount, customer_id, status)')
      .eq('id', id)
      .single();

    if (paymentError) throw paymentError;

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
      });
    }

    if (payment.status === 'confirmed') {
      return res.status(400).json({
        success: false,
        error: 'Payment already confirmed',
      });
    }

    const { data, error } = await supabase
      .from('payments')
      .update({
        status: 'confirmed',
        confirmed_by: confirmed_by || null,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const submittedTotal = await getSubmittedPaymentTotal(payment.sales_order_id);
    const orderTotal = Number(payment.sales_order?.total_amount || 0);
    const newOrderStatus = await updateOrderStatusFromSubmittedPayments(payment.sales_order_id);

    const { data: confirmedPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('sales_order_id', payment.sales_order_id)
      .eq('status', 'confirmed');

    const totalConfirmed =
      confirmedPayments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

    const { data: customer } = await supabase
      .from('customers')
      .select('full_name')
      .eq('id', payment.sales_order?.customer_id)
      .single();

    res.json({
      success: true,
      data: {
        id: data.id,
        sales_order_id: data.sales_order_id,
        order_number: payment.sales_order?.order_number,
        customer_name: customer?.full_name,
        amount: data.amount,
        payment_method: data.payment_method,
        bank_name: data.bank_name,
        reference_number: data.reference_number,
        payment_status: data.status,
        order_status: newOrderStatus,
        confirmed_at: data.confirmed_at,
        confirmed_by: data.confirmed_by,
        total_confirmed: totalConfirmed,
        total_submitted: submittedTotal,
        order_total: orderTotal,
        remaining_balance: Math.max(0, orderTotal - submittedTotal),
        is_fully_submitted: submittedTotal >= orderTotal,
      },
      message: `Deposit of ${payment.amount} confirmed successfully`,
    });
  } catch (error) {
    console.error('Error confirming deposit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm deposit',
    });
  }
};

// ============================================
// GET PENDING DEPOSITS
// ============================================
export const getPendingDeposits = async (req: Request, res: Response) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const from = parseInt(offset as string);
    const to = from + parseInt(limit as string) - 1;

    const { data, error, count } = await supabase
      .from('payments')
      .select(
        `
        *,
        sales_order:sales_order_id (
          order_number,
          total_amount,
          customer_id,
          status
        )
      `,
        { count: 'exact' }
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const paymentsWithCustomers = await Promise.all(
      (data || []).map(async (payment) => {
        const { data: customer } = await supabase
          .from('customers')
          .select('full_name, phone')
          .eq('id', payment.sales_order?.customer_id)
          .single();

        return {
          id: payment.id,
          sales_order_id: payment.sales_order_id,
          order_number: payment.sales_order?.order_number,
          order_status: payment.sales_order?.status,
          customer_name: customer?.full_name,
          customer_phone: customer?.phone,
          total_amount: payment.sales_order?.total_amount,
          payment_method: payment.payment_method,
          bank_name: payment.bank_name,
          reference_number: payment.reference_number,
          amount: payment.amount,
          status: payment.status,
          notes: payment.notes,
          created_at: payment.created_at,
        };
      })
    );

    res.json({
      success: true,
      data: paymentsWithCustomers,
      pagination: {
        total: count,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
      message: 'Pending deposits fetched successfully',
    });
  } catch (error) {
    console.error('Error fetching pending deposits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending deposits',
    });
  }
};

// ============================================
// REJECT DEPOSIT
// ============================================
export const rejectDeposit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*, sales_order:sales_order_id (order_number, status)')
      .eq('id', id)
      .single();

    if (paymentError) throw paymentError;

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
      });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot reject payment that is already ${payment.status}`,
      });
    }

    const { data, error } = await supabase
      .from('payments')
      .update({
        status: 'rejected',
        notes: notes || payment.notes,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const newOrderStatus = await updateOrderStatusFromSubmittedPayments(payment.sales_order_id);

    res.json({
      success: true,
      data: {
        ...data,
        order_status: newOrderStatus,
      },
      message: `Deposit of ${payment.amount} rejected`,
    });
  } catch (error) {
    console.error('Error rejecting deposit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject deposit',
    });
  }
};

// ============================================
// GET PAYMENT HISTORY FOR AN ORDER
// ============================================
export const getOrderPaymentHistory = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('id, order_number, total_amount, customer_id, status')
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Sales order not found',
      });
    }

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('sales_order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const confirmedPayments = data?.filter((p) => p.status === 'confirmed') || [];
    const pendingPayments = data?.filter((p) => p.status === 'pending') || [];
    const rejectedPayments = data?.filter((p) => p.status === 'rejected') || [];

    const totalConfirmed = confirmedPayments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );
    const totalPending = pendingPayments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );
    const totalRejected = rejectedPayments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );

    const totalSubmitted = totalConfirmed + totalPending;
    const orderTotal = Number(order.total_amount || 0);

    const { data: customer } = await supabase
      .from('customers')
      .select('full_name')
      .eq('id', order.customer_id)
      .single();

    res.json({
      success: true,
      data: {
        order: {
          id: order.id,
          order_number: order.order_number,
          customer_name: customer?.full_name,
          total_amount: orderTotal,
          total_confirmed: totalConfirmed,
          total_pending: totalPending,
          total_submitted: totalSubmitted,
          remaining_balance: Math.max(0, orderTotal - totalSubmitted),
          is_fully_submitted: totalSubmitted >= orderTotal,
          status: order.status,
        },
        payments: {
          confirmed: confirmedPayments,
          pending: pendingPayments,
          rejected: rejectedPayments,
        },
        summary: {
          total_confirmed: totalConfirmed,
          total_pending: totalPending,
          total_rejected: totalRejected,
          total_submitted: totalSubmitted,
          remaining_balance: Math.max(0, orderTotal - totalSubmitted),
          is_fully_submitted: totalSubmitted >= orderTotal,
          payment_count: data?.length || 0,
        },
      },
      message: 'Payment history fetched successfully',
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment history',
    });
  }
};

// ============================================
// CANCEL ORDER AND RELEASE RESERVATIONS
// ============================================
export const cancelOrderAndReleaseReservations = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { performed_by } = req.body;

    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (orderError) throw orderError;

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    if (order.status === 'confirmed' || order.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel confirmed or completed order',
      });
    }

    await releaseReservedItems(id, performed_by || null);

    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (updateError) throw updateError;

    await supabase.from('order_history').insert({
      sales_order_id: id,
      action: 'cancelled',
      old_status: order.status,
      new_status: 'cancelled',
      performed_by: performed_by || null,
      notes: 'Order cancelled and inventory reservations released',
    });

    res.json({
      success: true,
      message: 'Order cancelled and inventory reservations released',
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order',
    });
  }
};