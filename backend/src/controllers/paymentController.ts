import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// ============================================
// RECORD DEPOSIT (Add payment to an order)
// ============================================
export const recordDeposit = async (req: Request, res: Response) => {
  try {
    const { 
      sales_order_id, 
      payment_method, 
      bank_name, 
      reference_number, 
      amount, 
      notes 
    } = req.body;

    // Validation
    if (!sales_order_id) {
      return res.status(400).json({
        success: false,
        error: 'Sales order ID is required'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required'
      });
    }

    if (!payment_method) {
      return res.status(400).json({
        success: false,
        error: 'Payment method is required'
      });
    }

    // Check if sales order exists
    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('id, order_number, total_amount, customer_id, status')
      .eq('id', sales_order_id)
      .single();

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Sales order not found'
      });
    }

    // For non-cash payments, bank name is required
    if (payment_method !== 'cash' && !bank_name) {
      return res.status(400).json({
        success: false,
        error: 'Bank name is required for non-cash payments'
      });
    }

    // Create payment record
    const { data, error } = await supabase
      .from('payments')
      .insert([
        {
          sales_order_id,
          payment_method,
          bank_name: bank_name || null,
          reference_number: reference_number || null,
          amount,
          status: 'pending',
          notes: notes || null
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Get customer name for response
    const { data: customer } = await supabase
      .from('customers')
      .select('full_name')
      .eq('id', order.customer_id)
      .single();

    res.json({
      success: true,
      data: {
        id: data.id,
        sales_order_id: data.sales_order_id,
        order_number: order.order_number,
        customer_name: customer?.full_name,
        payment_method: data.payment_method,
        bank_name: data.bank_name,
        reference_number: data.reference_number,
        amount: data.amount,
        status: data.status,
        notes: data.notes,
        created_at: data.created_at
      },
      message: 'Deposit recorded successfully. Awaiting admin confirmation.'
    });
  } catch (error) {
    console.error('Error recording deposit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record deposit'
    });
  }
};

// ============================================
// CONFIRM DEPOSIT (Admin only) - UPDATED
// ============================================
export const confirmDeposit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { confirmed_by } = req.body;

    // Check if payment exists
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*, sales_order:sales_order_id (order_number, total_amount, customer_id, status)')
      .eq('id', id)
      .single();

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    // Check if already confirmed
    if (payment.status === 'confirmed') {
      return res.status(400).json({
        success: false,
        error: 'Payment already confirmed'
      });
    }

    // Update payment status
    const { data, error } = await supabase
      .from('payments')
      .update({
        status: 'confirmed',
        confirmed_by: confirmed_by || null,
        confirmed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Get all confirmed payments for this order
    const { data: allPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('sales_order_id', payment.sales_order_id)
      .eq('status', 'confirmed');

    const totalPaid = allPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const orderTotal = payment.sales_order?.total_amount || 0;
    const isFullyPaid = totalPaid >= orderTotal;

    // UPDATE ORDER STATUS BASED ON PAYMENT
    // If order was in 'draft' and now has first payment, change to 'pending'
    if (payment.sales_order?.status === 'draft' && totalPaid > 0) {
      await supabase
        .from('sales_orders')
        .update({ status: 'pending' })
        .eq('id', payment.sales_order_id);
      
      // Reserve items for this order
      await reserveOrderItems(payment.sales_order_id, confirmed_by);
    }

    // Get customer name
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
        status: data.status,
        confirmed_at: data.confirmed_at,
        confirmed_by: data.confirmed_by,
        total_paid: totalPaid,
        order_total: orderTotal,
        is_fully_paid: isFullyPaid,
        remaining_balance: orderTotal - totalPaid
      },
      message: `Deposit of ${payment.amount} confirmed successfully${isFullyPaid ? ' - Order is now fully paid!' : ''}`
    });
  } catch (error) {
    console.error('Error confirming deposit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm deposit'
    });
  }
};

// ============================================
// Helper function to reserve order items
// ============================================
async function reserveOrderItems(orderId: string, performedBy: string | null) {
  // Get all items in the order
  const { data: items } = await supabase
    .from('sales_order_items')
    .select('*')
    .eq('sales_order_id', orderId);

  if (!items) return;

  for (const item of items) {
    if (item.item_type === 'vehicle') {
      // Reserve the vehicle
      await supabase
        .from('vehicles')
        .update({ status: 'reserved' })
        .eq('id', item.vehicle_id);
      
      // Add to vehicle history
      await supabase
        .from('vehicle_history')
        .insert({
          vehicle_id: item.vehicle_id,
          event_type: 'reserved',
          sales_order_id: orderId,
          performed_by: performedBy,
          notes: 'Reserved due to payment confirmation'
        });
        
    } else if (item.item_type === 'part') {
      // Reserve part quantity
      const { data: part } = await supabase
        .from('parts')
        .select('reserved_quantity')
        .eq('id', item.part_id)
        .single();
      
      const newReserved = (part?.reserved_quantity || 0) + item.quantity;
      
      await supabase
        .from('parts')
        .update({ reserved_quantity: newReserved })
        .eq('id', item.part_id);
      
      // Add to part transactions
      await supabase
        .from('part_transactions')
        .insert({
          part_id: item.part_id,
          transaction_type: 'reserved',
          quantity_change: item.quantity,
          quantity_after: newReserved,
          sales_order_id: orderId,
          performed_by: performedBy,
          notes: 'Reserved due to payment confirmation'
        });
    }
  }
}

// ============================================
// Helper function to release reserved items (if order cancelled)
// ============================================
async function releaseReservedItems(orderId: string, performedBy: string | null) {
  // Get all items in the order
  const { data: items } = await supabase
    .from('sales_order_items')
    .select('*')
    .eq('sales_order_id', orderId);

  if (!items) return;

  for (const item of items) {
    if (item.item_type === 'vehicle') {
      // Release the vehicle back to available
      await supabase
        .from('vehicles')
        .update({ status: 'available' })
        .eq('id', item.vehicle_id);
      
      // Add to vehicle history
      await supabase
        .from('vehicle_history')
        .insert({
          vehicle_id: item.vehicle_id,
          event_type: 'returned',
          sales_order_id: orderId,
          performed_by: performedBy,
          notes: 'Reservation released due to order cancellation'
        });
        
    } else if (item.item_type === 'part') {
      // Release reserved part quantity
      const { data: part } = await supabase
        .from('parts')
        .select('reserved_quantity')
        .eq('id', item.part_id)
        .single();
      
      const newReserved = Math.max(0, (part?.reserved_quantity || 0) - item.quantity);
      
      await supabase
        .from('parts')
        .update({ reserved_quantity: newReserved })
        .eq('id', item.part_id);
      
      // Add to part transactions
      await supabase
        .from('part_transactions')
        .insert({
          part_id: item.part_id,
          transaction_type: 'returned',
          quantity_change: -item.quantity,
          quantity_after: newReserved,
          sales_order_id: orderId,
          performed_by: performedBy,
          notes: 'Reservation released due to order cancellation'
        });
    }
  }
}

// ============================================
// GET PENDING DEPOSITS
// ============================================
export const getPendingDeposits = async (req: Request, res: Response) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const { data, error, count } = await supabase
      .from('payments')
      .select(`
        *,
        sales_order:sales_order_id (
          order_number,
          total_amount,
          customer_id,
          status
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

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
          created_at: payment.created_at
        };
      })
    );

    res.json({
      success: true,
      data: paymentsWithCustomers,
      pagination: {
        total: count,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      },
      message: 'Pending deposits fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching pending deposits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending deposits'
    });
  }
};

// ============================================
// REJECT DEPOSIT - Updated to handle order status
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

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot reject payment that is already ${payment.status}`
      });
    }

    const { data, error } = await supabase
      .from('payments')
      .update({
        status: 'rejected',
        notes: notes || payment.notes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: `Deposit of ${payment.amount} rejected`
    });
  } catch (error) {
    console.error('Error rejecting deposit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject deposit'
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

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Sales order not found'
      });
    }

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('sales_order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const confirmedPayments = data?.filter(p => p.status === 'confirmed') || [];
    const pendingPayments = data?.filter(p => p.status === 'pending') || [];
    const rejectedPayments = data?.filter(p => p.status === 'rejected') || [];

    const totalConfirmed = confirmedPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalRejected = rejectedPayments.reduce((sum, p) => sum + p.amount, 0);

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
          total_amount: order.total_amount,
          total_paid: totalConfirmed,
          remaining_balance: order.total_amount - totalConfirmed,
          is_fully_paid: totalConfirmed >= order.total_amount,
          status: order.status
        },
        payments: {
          confirmed: confirmedPayments,
          pending: pendingPayments,
          rejected: rejectedPayments
        },
        summary: {
          total_confirmed: totalConfirmed,
          total_pending: totalPending,
          total_rejected: totalRejected,
          payment_count: data?.length || 0
        }
      },
      message: 'Payment history fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment history'
    });
  }
};

// ============================================
// NEW: Cancel order and release reservations
// ============================================
export const cancelOrderAndReleaseReservations = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { performed_by } = req.body;

    // Get order with items
    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Release reserved items
    await releaseReservedItems(id, performed_by);

    // Update order status to cancelled
    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Order cancelled and inventory reservations released'
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order'
    });
  }
};