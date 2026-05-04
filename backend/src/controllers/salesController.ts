import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

const TERMINAL_ORDER_STATUSES = ['confirmed', 'completed', 'cancelled'];

// ============================================
// HELPERS
// ============================================

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
        notes: 'Order cancelled - vehicle returned to inventory',
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
        notes: 'Order cancelled - reservation released',
      });
    }
  }
}

// ============================================
// GET ALL SALES ORDERS
// ============================================
export const getSalesOrders = async (req: Request, res: Response) => {
  try {
    const { status, customer_id, limit = 100, offset = 0 } = req.query;

    let query = supabase.from('sales_orders').select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    if (customer_id) {
      query = query.eq('customer_id', customer_id);
    }

    const from = parseInt(offset as string);
    const to = from + parseInt(limit as string) - 1;

    const { data, error, count } = await query
      .order('order_date', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const ordersWithCustomers = await Promise.all(
      (data || []).map(async (order) => {
        const { data: customer } = await supabase
          .from('customers')
          .select('full_name, phone')
          .eq('id', order.customer_id)
          .single();

        const submittedTotal = await getSubmittedPaymentTotal(order.id);

        return {
          ...order,
          submitted_amount: submittedTotal,
          remaining_amount: Math.max(
            0,
            Number(order.total_amount || 0) - submittedTotal
          ),
          customer: customer || null,
        };
      })
    );

    res.json({
      success: true,
      data: ordersWithCustomers,
      pagination: {
        total: count,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
      message: 'Sales orders fetched successfully',
    });
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales orders',
    });
  }
};

// ============================================
// GET SINGLE SALES ORDER BY ID
// ============================================
export const getSalesOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Sales order not found',
        });
      }

      throw orderError;
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id, full_name, phone, email, address')
      .eq('id', order.customer_id)
      .single();

    const { data: items, error: itemsError } = await supabase
      .from('sales_order_items')
      .select(
        `
        id,
        item_type,
        quantity,
        unit_price,
        subtotal,
        vehicle:vehicle_id (
          id,
          model,
          chassis_number,
          specifications,
          unit_price
        ),
        part:part_id (
          id,
          part_number,
          name,
          specifications,
          unit_price
        )
      `
      )
      .eq('sales_order_id', id);

    if (itemsError) throw itemsError;

    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('sales_order_id', id)
      .order('created_at', { ascending: false });

    const totalConfirmed =
      payments
        ?.filter((p) => p.status === 'confirmed')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

    const totalPending =
      payments
        ?.filter((p) => p.status === 'pending')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

    const submittedTotal = totalConfirmed + totalPending;

    const formattedItems =
      items?.map((item: any) => ({
        id: item.id,
        item_type: item.item_type,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        ...(item.item_type === 'vehicle' &&
          item.vehicle && {
            vehicle_id: item.vehicle.id,
            model: item.vehicle.model,
            chassis_number: item.vehicle.chassis_number,
            specifications: item.vehicle.specifications,
          }),
        ...(item.item_type === 'part' &&
          item.part && {
            part_id: item.part.id,
            part_number: item.part.part_number,
            name: item.part.name,
            specifications: item.part.specifications,
          }),
      })) || [];

    res.json({
      success: true,
      data: {
        ...order,
        customer,
        items: formattedItems,
        payments: payments || [],
        total_confirmed: totalConfirmed,
        total_pending: totalPending,
        submitted_amount: submittedTotal,
        remaining_balance: Math.max(
          0,
          Number(order.total_amount || 0) - submittedTotal
        ),
        is_fully_submitted: submittedTotal >= Number(order.total_amount || 0),
      },
      message: 'Sales order fetched successfully',
    });
  } catch (error) {
    console.error('Error fetching sales order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales order',
    });
  }
};

// ============================================
// CREATE SALES ORDER
// Partial payment => pending
// Full payment => pending_admin
// Both reserve inventory immediately.
// ============================================
export const createSalesOrder = async (req: Request, res: Response) => {
  try {
    const {
      customer_id,
      items,
      notes,
      payment_method,
      bank_name,
      reference_number,
      deposit_amount,
      chassis_number,
      part_number,
      quantity = 1,
      unit_price,
    } = req.body;

    const paymentAmount = Number(deposit_amount || 0);

    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount is required to create a sale request',
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

    let orderItems: any[] = [];
    const customerId = customer_id;
    let vehicleInfo: any = null;
    let partInfo: any = null;

    if (chassis_number) {
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, model, unit_price, status, chassis_number, specifications')
        .eq('chassis_number', chassis_number)
        .single();

      if (vehicleError || !vehicle) {
        return res.status(404).json({
          success: false,
          error: `Vehicle with chassis number ${chassis_number} not found`,
        });
      }

      if (vehicle.status !== 'available') {
        return res.status(400).json({
          success: false,
          error: `Vehicle is not available. Current status: ${vehicle.status}`,
        });
      }

      const qty = Number(quantity || 1);
      const price = Number(unit_price || vehicle.unit_price);

      orderItems.push({
        item_type: 'vehicle',
        vehicle_id: vehicle.id,
        quantity: qty,
        unit_price: price,
        subtotal: price * qty,
      });

      vehicleInfo = vehicle;
    } else if (part_number) {
      const { data: part, error: partError } = await supabase
        .from('parts')
        .select('id, part_number, name, unit_price, quantity, reserved_quantity, specifications')
        .eq('part_number', part_number)
        .single();

      if (partError || !part) {
        return res.status(404).json({
          success: false,
          error: `Part with part number ${part_number} not found`,
        });
      }

      const qty = Number(quantity || 1);
      const availableQty =
        Number(part.quantity || 0) - Number(part.reserved_quantity || 0);

      if (availableQty < qty) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for part. Available: ${availableQty}, Requested: ${qty}`,
        });
      }

      const price = Number(unit_price || part.unit_price);

      orderItems.push({
        item_type: 'part',
        part_id: part.id,
        quantity: qty,
        unit_price: price,
        subtotal: price * qty,
      });

      partInfo = part;
    } else if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const {
          item_type,
          item_id,
          part_number: itemPartNumber,
          chassis_number: itemChassisNumber,
          quantity: itemQty,
          unit_price: itemPrice,
        } = item;

        if (item_type === 'vehicle') {
          let vehicleId = item_id;

          if (itemChassisNumber && !vehicleId) {
            const { data: vehicleByChassis } = await supabase
              .from('vehicles')
              .select('id')
              .eq('chassis_number', itemChassisNumber)
              .single();

            if (vehicleByChassis) vehicleId = vehicleByChassis.id;
          }

          const { data: vehicle, error: vehicleError } = await supabase
            .from('vehicles')
            .select('id, unit_price, status, model, chassis_number, specifications')
            .eq('id', vehicleId)
            .single();

          if (vehicleError || !vehicle) {
            return res.status(404).json({
              success: false,
              error: `Vehicle with ID ${vehicleId} not found`,
            });
          }

          if (vehicle.status !== 'available') {
            return res.status(400).json({
              success: false,
              error: `Vehicle is not available. Current status: ${vehicle.status}`,
            });
          }

          const qty = Number(itemQty || 1);
          const price = Number(itemPrice || vehicle.unit_price);

          orderItems.push({
            item_type: 'vehicle',
            vehicle_id: vehicle.id,
            quantity: qty,
            unit_price: price,
            subtotal: price * qty,
          });

          vehicleInfo = vehicle;
        }

        if (item_type === 'part') {
          let part: any = null;

          if (item_id) {
            const { data, error } = await supabase
              .from('parts')
              .select('id, part_number, unit_price, quantity, reserved_quantity, name, specifications')
              .eq('id', item_id)
              .maybeSingle();

            if (error) throw error;
            part = data;
          }

          if (!part && itemPartNumber) {
            const { data, error } = await supabase
              .from('parts')
              .select('id, part_number, unit_price, quantity, reserved_quantity, name, specifications')
              .eq('part_number', itemPartNumber)
              .maybeSingle();

            if (error) throw error;
            part = data;
          }

          if (!part) {
            return res.status(404).json({
              success: false,
              error: 'Part not found',
              debug: {
                searched_id: item_id || null,
                searched_part_number: itemPartNumber || null,
              },
            });
          }

          const qty = Number(itemQty || 1);
          const availableQty =
            Number(part.quantity || 0) - Number(part.reserved_quantity || 0);

          if (availableQty < qty) {
            return res.status(400).json({
              success: false,
              error: `Insufficient stock for part ${part.name}. Available: ${availableQty}, Requested: ${qty}`,
            });
          }

          const price = Number(itemPrice || part.unit_price);

          orderItems.push({
            item_type: 'part',
            part_id: part.id,
            quantity: qty,
            unit_price: price,
            subtotal: price * qty,
          });

          partInfo = part;
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either chassis_number, part_number, or items array is required',
      });
    }

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required',
      });
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, full_name, phone')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    const totalAmount = orderItems.reduce(
      (sum, item) => sum + Number(item.subtotal || 0),
      0
    );

    if (paymentAmount > totalAmount) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount cannot be greater than total amount',
      });
    }

    const initialStatus = paymentAmount >= totalAmount ? 'pending_admin' : 'pending';

    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .insert([
        {
          customer_id: customerId,
          total_amount: totalAmount,
          notes: notes || null,
          status: initialStatus,
        },
      ])
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItemsWithOrderId = orderItems.map((item) => ({
      ...item,
      sales_order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from('sales_order_items')
      .insert(orderItemsWithOrderId);

    if (itemsError) throw itemsError;

    const { error: paymentError } = await supabase.from('payments').insert([
      {
        sales_order_id: order.id,
        payment_method: payment_method || 'bank_deposit',
        bank_name: bank_name || null,
        reference_number: reference_number || null,
        amount: paymentAmount,
        status: 'pending',
        notes: null,
      },
    ]);

    if (paymentError) throw paymentError;

    await reserveOrderItems(order.id, null);

    await supabase.from('order_history').insert([
      {
        sales_order_id: order.id,
        action: 'created',
        new_status: initialStatus,
        notes:
          initialStatus === 'pending_admin'
            ? 'Order created with full submitted payment, waiting for admin approval'
            : 'Order created with partial payment and inventory reserved',
      },
    ]);

    const responseData: any = {
      id: order.id,
      order_number: order.order_number,
      customer_name: customer.full_name,
      reference_number: reference_number || null,
      quantity: quantity || orderItems[0]?.quantity || 1,
      unit_price: unit_price || orderItems[0]?.unit_price || totalAmount,
      total_amount: totalAmount,
      deposit_bank: bank_name,
      deposit_amount: paymentAmount,
      submitted_amount: paymentAmount,
      remaining_amount: Math.max(0, totalAmount - paymentAmount),
      deposit_status: 'pending',
      notes: notes || null,
      created_at: order.created_at,
      status: initialStatus,
      is_fully_submitted: paymentAmount >= totalAmount,
    };

    if (vehicleInfo) {
      responseData.chassis_number = vehicleInfo.chassis_number;
      responseData.sales_type = vehicleInfo.model;
      responseData.specifications = vehicleInfo.specifications;
    }

    if (partInfo) {
      responseData.part_number = partInfo.part_number;
      responseData.sales_type = partInfo.name;
      responseData.specifications = partInfo.specifications;
    }

    res.json({
      success: true,
      data: responseData,
      message:
        initialStatus === 'pending_admin'
          ? `Sales order ${order.order_number} fully paid and sent for admin approval.`
          : `Sales order ${order.order_number} partially paid and reserved. Remaining: ${
              totalAmount - paymentAmount
            }`,
    });
  } catch (error) {
    console.error('Error creating sales order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create sales order',
    });
  }
};

// ============================================
// UPDATE ORDER STATUS
// Admin confirms pending_admin order.
// Confirmed means inventory is sold/deducted.
// ============================================
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, confirmed_by } = req.body;

    const validStatuses = ['pending', 'pending_admin', 'confirmed', 'completed', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (orderError) throw orderError;

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Sales order not found',
      });
    }

    const oldStatus = order.status;

    if (status === 'confirmed' && oldStatus !== 'pending_admin') {
      return res.status(400).json({
        success: false,
        error: 'Only orders waiting for admin approval can be confirmed',
      });
    }

    const updateData: any = { status };

    if (status === 'confirmed') {
      updateData.confirmed_at = new Date().toISOString();
      updateData.confirmed_by = confirmed_by || null;

      const { data: items, error: itemsError } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', id);

      if (itemsError) throw itemsError;

      for (const item of items || []) {
        if (item.item_type === 'vehicle') {
          await supabase
            .from('vehicles')
            .update({ status: 'sold' })
            .eq('id', item.vehicle_id);

          await supabase.from('vehicle_history').insert({
            vehicle_id: item.vehicle_id,
            event_type: 'sold',
            sales_order_id: id,
            performed_by: confirmed_by || null,
            notes: 'Sale confirmed by admin',
          });
        }

        if (item.item_type === 'part') {
          const { data: part, error: partError } = await supabase
            .from('parts')
            .select('quantity, reserved_quantity')
            .eq('id', item.part_id)
            .single();

          if (partError) throw partError;

          if (part) {
            const soldQty = Number(item.quantity || 0);
            const newQuantity = Math.max(0, Number(part.quantity || 0) - soldQty);
            const newReserved = Math.max(
              0,
              Number(part.reserved_quantity || 0) - soldQty
            );

            await supabase
              .from('parts')
              .update({
                quantity: newQuantity,
                reserved_quantity: newReserved,
              })
              .eq('id', item.part_id);

            await supabase.from('part_transactions').insert({
              part_id: item.part_id,
              transaction_type: 'sold',
              quantity_change: -soldQty,
              quantity_after: newQuantity,
              sales_order_id: id,
              performed_by: confirmed_by || null,
              notes: 'Sale confirmed by admin',
            });
          }
        }
      }
    }

    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      await releaseReservedItems(id, confirmed_by || null);
    }

    const { data, error } = await supabase
      .from('sales_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('order_history').insert([
      {
        sales_order_id: id,
        action: 'status_changed',
        old_status: oldStatus,
        new_status: status,
        performed_by: confirmed_by || null,
        notes: `Status changed from ${oldStatus} to ${status}`,
      },
    ]);

    res.json({
      success: true,
      data,
      message: `Order status updated to ${status} successfully`,
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status',
    });
  }
};

// Kept for compatibility, but frontend no longer needs to call it.
export const workerConfirmFullPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const newStatus = await updateOrderStatusFromSubmittedPayments(id);

    res.json({
      success: true,
      data: {
        order_status: newStatus,
      },
      message:
        newStatus === 'pending_admin'
          ? 'Full payment submitted. Order sent to admin for final approval.'
          : 'Order still has remaining balance.',
    });
  } catch (error) {
    console.error('Error confirming full payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm payment',
    });
  }
};

// ============================================
// CANCEL ORDER
// ============================================
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { performed_by } = req.body || {};

    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (orderError) throw orderError;

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Sales order not found',
      });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Order is already cancelled',
      });
    }

    if (order.status === 'confirmed' || order.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a confirmed or completed order',
      });
    }

    await releaseReservedItems(id, performed_by || null);

    const { data, error } = await supabase
      .from('sales_orders')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('order_history').insert([
      {
        sales_order_id: id,
        action: 'cancelled',
        old_status: order.status,
        new_status: 'cancelled',
        performed_by: performed_by || null,
        notes: 'Order cancelled and inventory restored',
      },
    ]);

    res.json({
      success: true,
      data,
      message: 'Order cancelled successfully and inventory restored',
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order',
    });
  }
};

// ============================================
// DELETE ORDER
// ============================================
export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('status')
      .eq('id', id)
      .single();

    if (orderError) throw orderError;

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Sales order not found',
      });
    }

    if (order.status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Only cancelled orders can be deleted',
      });
    }

    await supabase.from('sales_order_items').delete().eq('sales_order_id', id);
    await supabase.from('payments').delete().eq('sales_order_id', id);
    await supabase.from('order_history').delete().eq('sales_order_id', id);

    const { error } = await supabase.from('sales_orders').delete().eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete order',
    });
  }
};