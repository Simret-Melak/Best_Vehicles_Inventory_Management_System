import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// ============================================
// HELPERS
// ============================================

const TERMINAL_ORDER_STATUSES = ['confirmed', 'completed', 'cancelled'];

const cleanNullable = (value: any) => {
  if (value === undefined || value === null || value === '') return null;
  return value;
};

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

async function updateOrderStatusFromSubmittedPayments(
  orderId: string,
  performedBy: string | null = null,
  performedByName: string | null = null
) {
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
      performed_by: performedBy,
      performed_by_name: performedByName,
      confirmed_by: null,
      confirmed_by_name: null,
      notes:
        newStatus === 'pending_admin'
          ? 'Full payment submitted by worker, waiting for admin approval'
          : 'Partial payment submitted, order remains pending',
    });
  }

  return newStatus;
}

async function reserveOrderItems(
  orderId: string,
  performedBy: string | null = null,
  performedByName: string | null = null,
  customerId: string | null = null
) {
  const { data: items, error: itemsError } = await supabase
    .from('sales_order_items')
    .select('*')
    .eq('sales_order_id', orderId);

  if (itemsError) throw itemsError;
  if (!items || items.length === 0) return;

  for (const item of items) {
    if (item.item_type === 'vehicle' && item.vehicle_id) {
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('status')
        .eq('id', item.vehicle_id)
        .single();

      if (vehicleError) throw vehicleError;

      if (vehicle?.status === 'available') {
        const { error: updateVehicleError } = await supabase
          .from('vehicles')
          .update({ status: 'reserved' })
          .eq('id', item.vehicle_id);

        if (updateVehicleError) throw updateVehicleError;

        const { data: existingReservedHistory, error: existingHistoryError } =
          await supabase
            .from('vehicle_history')
            .select('id')
            .eq('vehicle_id', item.vehicle_id)
            .eq('sales_order_id', orderId)
            .eq('event_type', 'reserved')
            .maybeSingle();

        if (existingHistoryError) throw existingHistoryError;

        if (!existingReservedHistory) {
          const { error: historyError } = await supabase
            .from('vehicle_history')
            .insert({
              vehicle_id: item.vehicle_id,
              event_type: 'reserved',
              customer_id: customerId,
              sales_order_id: orderId,
              performed_by: performedBy,
              performed_by_name: performedByName,
              confirmed_by: null,
              confirmed_by_name: null,
              notes: 'Reserved after worker submitted payment',
            });

          if (historyError) throw historyError;
        }
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

      const { data: existingReservation, error: existingReservationError } =
        await supabase
          .from('part_transactions')
          .select('id')
          .eq('part_id', item.part_id)
          .eq('sales_order_id', orderId)
          .eq('transaction_type', 'reserved')
          .maybeSingle();

      if (existingReservationError) throw existingReservationError;

      if (!existingReservation) {
        const newReserved = currentReserved + Number(item.quantity || 0);

        const { error: updatePartError } = await supabase
          .from('parts')
          .update({ reserved_quantity: newReserved })
          .eq('id', item.part_id);

        if (updatePartError) throw updatePartError;

        const { error: transactionError } = await supabase
          .from('part_transactions')
          .insert({
            part_id: item.part_id,
            transaction_type: 'reserved',
            quantity_change: item.quantity,
            quantity_after: newReserved,
            sales_order_id: orderId,
            performed_by: performedBy,
            performed_by_name: performedByName,
            confirmed_by: null,
            confirmed_by_name: null,
            notes: 'Reserved after worker submitted payment',
          });

        if (transactionError) throw transactionError;
      }
    }
  }
}

async function releaseReservedItems(
  orderId: string,
  performedBy: string | null = null,
  performedByName: string | null = null
) {
  const { data: items, error: itemsError } = await supabase
    .from('sales_order_items')
    .select('*')
    .eq('sales_order_id', orderId);

  if (itemsError) throw itemsError;
  if (!items) return;

  for (const item of items) {
    if (item.item_type === 'vehicle' && item.vehicle_id) {
      const { error: updateVehicleError } = await supabase
        .from('vehicles')
        .update({ status: 'available' })
        .eq('id', item.vehicle_id);

      if (updateVehicleError) throw updateVehicleError;

      const { error: historyError } = await supabase
        .from('vehicle_history')
        .insert({
          vehicle_id: item.vehicle_id,
          event_type: 'returned',
          sales_order_id: orderId,
          performed_by: performedBy,
          performed_by_name: performedByName,
          notes: 'Reservation released due to order cancellation',
        });

      if (historyError) throw historyError;
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

      const { error: updatePartError } = await supabase
        .from('parts')
        .update({ reserved_quantity: newReserved })
        .eq('id', item.part_id);

      if (updatePartError) throw updatePartError;

      const { error: transactionError } = await supabase
        .from('part_transactions')
        .insert({
          part_id: item.part_id,
          transaction_type: 'returned',
          quantity_change: -Number(item.quantity || 0),
          quantity_after: newReserved,
          sales_order_id: orderId,
          performed_by: performedBy,
          performed_by_name: performedByName,
          notes: 'Reservation released due to order cancellation',
        });

      if (transactionError) throw transactionError;
    }
  }
}

// ============================================
// RECORD DEPOSIT
// Worker adds another payment.
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
      performed_by,
      performed_by_name,
    } = req.body;

    const performedBy = cleanNullable(performed_by);
    const performedByName = cleanNullable(performed_by_name);

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
          bank_name: payment_method === 'cash' ? null : bank_name || null,
          reference_number:
            payment_method === 'cash' ? null : reference_number || null,
          amount: paymentAmount,
          status: 'pending',
          performed_by: performedBy,
          performed_by_name: performedByName,
          confirmed_by: null,
          confirmed_by_name: null,
          notes: notes || null,
        },
      ])
      .select()
      .single();

    if (paymentError) throw paymentError;

    if (order.status !== 'pending' && order.status !== 'pending_admin') {
      await reserveOrderItems(
        sales_order_id,
        performedBy,
        performedByName,
        order.customer_id
      );
    }

    const newOrderStatus = await updateOrderStatusFromSubmittedPayments(
      sales_order_id,
      performedBy,
      performedByName
    );

    const submittedTotal = await getSubmittedPaymentTotal(sales_order_id);
    const remainingAmount = Math.max(0, orderTotal - submittedTotal);

    const { data: customer } = await supabase
      .from('customers')
      .select('full_name')
      .eq('id', order.customer_id)
      .single();

    return res.json({
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
        performed_by: payment.performed_by,
        performed_by_name: payment.performed_by_name,
        notes: payment.notes,
        created_at: payment.created_at,
      },
      message:
        submittedTotal >= orderTotal
          ? 'Full payment submitted. Order is now waiting for admin approval.'
          : `Payment submitted. Remaining amount: ${remainingAmount}`,
    });
  } catch (error: any) {
    console.error('Error recording deposit:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to record deposit',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

// ============================================
// CONFIRM DEPOSIT
// Admin confirms a payment record.
// ============================================
export const confirmDeposit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { confirmed_by, confirmed_by_name } = req.body;

    const confirmedBy = cleanNullable(confirmed_by);
    const confirmedByName = cleanNullable(confirmed_by_name);

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select(
        `
        *,
        sales_order:sales_order_id (
          id,
          order_number,
          total_amount,
          customer_id,
          status
        )
      `
      )
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

    if (payment.status === 'rejected') {
      return res.status(400).json({
        success: false,
        error: 'Cannot confirm a rejected payment',
      });
    }

    const { data, error } = await supabase
      .from('payments')
      .update({
        status: 'confirmed',
        confirmed_by: confirmedBy,
        confirmed_by_name: confirmedByName,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const submittedTotal = await getSubmittedPaymentTotal(payment.sales_order_id);
    const orderTotal = Number(payment.sales_order?.total_amount || 0);

    const newOrderStatus = await updateOrderStatusFromSubmittedPayments(
      payment.sales_order_id,
      payment.performed_by || null,
      payment.performed_by_name || null
    );

    const { data: confirmedPayments, error: confirmedPaymentsError } =
      await supabase
        .from('payments')
        .select('amount')
        .eq('sales_order_id', payment.sales_order_id)
        .eq('status', 'confirmed');

    if (confirmedPaymentsError) throw confirmedPaymentsError;

    const totalConfirmed =
      confirmedPayments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

    const { data: customer } = await supabase
      .from('customers')
      .select('full_name')
      .eq('id', payment.sales_order?.customer_id)
      .single();

    return res.json({
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
        confirmed_by_name: data.confirmed_by_name,
        performed_by: data.performed_by,
        performed_by_name: data.performed_by_name,
        total_confirmed: totalConfirmed,
        total_submitted: submittedTotal,
        order_total: orderTotal,
        remaining_balance: Math.max(0, orderTotal - submittedTotal),
        is_fully_submitted: submittedTotal >= orderTotal,
      },
      message: `Deposit of ${payment.amount} confirmed successfully`,
    });
  } catch (error: any) {
    console.error('Error confirming deposit:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to confirm deposit',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
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
          performed_by: payment.performed_by,
          performed_by_name: payment.performed_by_name,
          confirmed_by: payment.confirmed_by,
          confirmed_by_name: payment.confirmed_by_name,
          notes: payment.notes,
          created_at: payment.created_at,
        };
      })
    );

    return res.json({
      success: true,
      data: paymentsWithCustomers,
      pagination: {
        total: count,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
      message: 'Pending deposits fetched successfully',
    });
  } catch (error: any) {
    console.error('Error fetching pending deposits:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch pending deposits',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

// ============================================
// REJECT DEPOSIT
// ============================================
export const rejectDeposit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes, rejected_by, rejected_by_name } = req.body;

    const rejectedBy = cleanNullable(rejected_by);
    const rejectedByName = cleanNullable(rejected_by_name);

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
        confirmed_by: rejectedBy,
        confirmed_by_name: rejectedByName,
        notes: notes || payment.notes,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const newOrderStatus = await updateOrderStatusFromSubmittedPayments(
      payment.sales_order_id,
      payment.performed_by || null,
      payment.performed_by_name || null
    );

    return res.json({
      success: true,
      data: {
        ...data,
        order_status: newOrderStatus,
      },
      message: `Deposit of ${payment.amount} rejected`,
    });
  } catch (error: any) {
    console.error('Error rejecting deposit:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to reject deposit',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
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
      .select(
        `
        id,
        order_number,
        total_amount,
        customer_id,
        status,
        performed_by,
        performed_by_name,
        confirmed_by,
        confirmed_by_name
      `
      )
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

    return res.json({
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
          performed_by: order.performed_by,
          performed_by_name: order.performed_by_name,
          confirmed_by: order.confirmed_by,
          confirmed_by_name: order.confirmed_by_name,
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
  } catch (error: any) {
    console.error('Error fetching payment history:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch payment history',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

// ============================================
// CANCEL ORDER AND RELEASE RESERVATIONS
// ============================================
export const cancelOrderAndReleaseReservations = async (
  req: Request,
  res: Response
) => {
  try {
    const orderId = req.params.orderId || req.params.id;
    const { performed_by, performed_by_name } = req.body;

    const performedBy = cleanNullable(performed_by);
    const performedByName = cleanNullable(performed_by_name);

    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', orderId)
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

    await releaseReservedItems(orderId, performedBy, performedByName);

    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId);

    if (updateError) throw updateError;

    await supabase.from('order_history').insert({
      sales_order_id: orderId,
      action: 'cancelled',
      old_status: order.status,
      new_status: 'cancelled',
      performed_by: performedBy,
      performed_by_name: performedByName,
      notes: 'Order cancelled and inventory reservations released',
    });

    return res.json({
      success: true,
      message: 'Order cancelled and inventory reservations released',
    });
  } catch (error: any) {
    console.error('Error cancelling order:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel order',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};