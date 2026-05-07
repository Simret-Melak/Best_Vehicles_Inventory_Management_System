import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const TERMINAL_ORDER_STATUSES = ['confirmed', 'completed', 'cancelled'];

// ============================================
// HELPERS
// ============================================

const toNumber = (value: any) => {
  const numberValue = Number(value || 0);
  return Number.isNaN(numberValue) ? 0 : numberValue;
};

const cleanNullable = (value: any) => {
  if (value === undefined || value === null || value === '') return null;
  return value;
};

const getActor = (req: Request, fallbackName = 'Worker') => {
  const authReq = req as AuthenticatedRequest;

  return {
    id: cleanNullable(authReq.user?.id || req.body?.performed_by),
    name: cleanNullable(
      authReq.user?.full_name ||
        authReq.user?.email ||
        req.body?.performed_by_name ||
        fallbackName
    ),
    role: authReq.user?.role,
  };
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

async function generateUniqueOrderNumber() {
  const yearPrefix = new Date().getFullYear().toString().slice(-2);

  for (let attempt = 0; attempt < 20; attempt++) {
    const timestampPart = Date.now().toString().slice(-7);
    const randomPart = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');

    const candidate = `SO${yearPrefix}${timestampPart}${randomPart}`;

    const { data: existingOrder, error } = await supabase
      .from('sales_orders')
      .select('id')
      .eq('order_number', candidate)
      .maybeSingle();

    if (error) throw error;

    if (!existingOrder) {
      return candidate;
    }
  }

  throw new Error('Failed to generate unique order number');
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
          notes: 'Order cancelled - vehicle returned to inventory',
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
          notes: 'Order cancelled - reservation released',
        });

      if (transactionError) throw transactionError;
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
  } catch (error: any) {
    console.error('Error fetching sales orders:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch sales orders',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
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
  } catch (error: any) {
    console.error('Error fetching sales order:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch sales order',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

// ============================================
// CREATE SALES ORDER
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
      performed_by,
      performed_by_name,
      vehicle_id,
      part_id,
      chassis_number,
      part_number,
      quantity = 1,
      unit_price,
    } = req.body;

    const performedBy = cleanNullable(performed_by);
    const performedByName = cleanNullable(performed_by_name);
    const paymentAmount = Number(deposit_amount || 0);

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required',
      });
    }

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

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, full_name, phone')
      .eq('id', customer_id)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
        details: customerError?.message || null,
      });
    }

    const incomingItems =
      Array.isArray(items) && items.length > 0
        ? items
        : [
            {
              item_type: vehicle_id || chassis_number ? 'vehicle' : 'part',
              item_id: vehicle_id || part_id,
              vehicle_id,
              part_id,
              chassis_number,
              part_number,
              quantity,
              unit_price,
            },
          ];

    const orderItems: any[] = [];
    let vehicleInfo: any = null;
    let partInfo: any = null;

    for (const incomingItem of incomingItems) {
      const itemType = incomingItem.item_type;

      if (!itemType || !['vehicle', 'part'].includes(itemType)) {
        return res.status(400).json({
          success: false,
          error: 'Each item must have item_type vehicle or part',
        });
      }

      if (itemType === 'vehicle') {
        let vehicleId =
          incomingItem.vehicle_id ||
          incomingItem.item_id ||
          vehicle_id ||
          null;

        if (!vehicleId && (incomingItem.chassis_number || chassis_number)) {
          const { data: vehicleByChassis, error: chassisError } =
            await supabase
              .from('vehicles')
              .select('id')
              .eq(
                'chassis_number',
                incomingItem.chassis_number || chassis_number
              )
              .single();

          if (chassisError || !vehicleByChassis) {
            return res.status(404).json({
              success: false,
              error: 'Vehicle not found for provided chassis number',
              details: chassisError?.message || null,
            });
          }

          vehicleId = vehicleByChassis.id;
        }

        if (!vehicleId) {
          return res.status(400).json({
            success: false,
            error: 'vehicle_id is required for vehicle sales',
          });
        }

        const { data: vehicle, error: vehicleError } = await supabase
          .from('vehicles')
          .select('id, model, unit_price, status, chassis_number, specifications')
          .eq('id', vehicleId)
          .single();

        if (vehicleError || !vehicle) {
          return res.status(404).json({
            success: false,
            error: `Vehicle with ID ${vehicleId} not found`,
            details: vehicleError?.message || null,
          });
        }

        if (vehicle.status !== 'available') {
          return res.status(400).json({
            success: false,
            error: `Vehicle is not available. Current status: ${vehicle.status}`,
          });
        }

        const price = Number(
          incomingItem.unit_price || unit_price || vehicle.unit_price
        );

        orderItems.push({
          item_type: 'vehicle',
          vehicle_id: vehicle.id,
          part_id: null,
          quantity: 1,
          unit_price: price,
          subtotal: price,
        });

        vehicleInfo = vehicle;
      }

      if (itemType === 'part') {
        let partId =
          incomingItem.part_id || incomingItem.item_id || part_id || null;

        if (!partId && (incomingItem.part_number || part_number)) {
          const { data: partByNumber, error: partNumberError } = await supabase
            .from('parts')
            .select('id')
            .eq('part_number', incomingItem.part_number || part_number)
            .single();

          if (partNumberError || !partByNumber) {
            return res.status(404).json({
              success: false,
              error: 'Part not found for provided part number',
              details: partNumberError?.message || null,
            });
          }

          partId = partByNumber.id;
        }

        if (!partId) {
          return res.status(400).json({
            success: false,
            error: 'part_id is required for part sales',
          });
        }

        const { data: part, error: partError } = await supabase
          .from('parts')
          .select(
            'id, part_number, name, unit_price, quantity, reserved_quantity, specifications'
          )
          .eq('id', partId)
          .single();

        if (partError || !part) {
          return res.status(404).json({
            success: false,
            error: `Part with ID ${partId} not found`,
            details: partError?.message || null,
          });
        }

        const qty = Number(incomingItem.quantity || quantity || 1);
        const availableQty =
          Number(part.quantity || 0) - Number(part.reserved_quantity || 0);

        if (availableQty < qty) {
          return res.status(400).json({
            success: false,
            error: `Insufficient stock for part ${part.name}. Available: ${availableQty}, Requested: ${qty}`,
          });
        }

        const price = Number(
          incomingItem.unit_price || unit_price || part.unit_price
        );

        orderItems.push({
          item_type: 'part',
          vehicle_id: null,
          part_id: part.id,
          quantity: qty,
          unit_price: price,
          subtotal: price * qty,
        });

        partInfo = part;
      }
    }

    if (orderItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one valid item is required',
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

    const initialStatus =
      paymentAmount >= totalAmount ? 'pending_admin' : 'pending';

    let order: any = null;
    let orderError: any = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const orderNumber = await generateUniqueOrderNumber();

      const result = await supabase
        .from('sales_orders')
        .insert([
          {
            order_number: orderNumber,
            customer_id,
            total_amount: totalAmount,
            notes: notes || null,
            status: initialStatus,
            performed_by: performedBy,
            performed_by_name: performedByName,
            confirmed_by: null,
            confirmed_by_name: null,
          },
        ])
        .select()
        .single();

      order = result.data;
      orderError = result.error;

      if (!orderError && order) break;
      if (orderError?.code !== '23505') break;
    }

    if (orderError || !order) {
      return res.status(500).json({
        success: false,
        error: orderError?.message || 'Failed to create sales order',
        details: orderError?.details || null,
        code: orderError?.code || null,
        hint: orderError?.hint || null,
      });
    }

    const orderItemsWithOrderId = orderItems.map((item) => ({
      sales_order_id: order.id,
      item_type: item.item_type,
      vehicle_id: item.vehicle_id,
      part_id: item.part_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
    }));

    const { error: itemsError } = await supabase
      .from('sales_order_items')
      .insert(orderItemsWithOrderId);

    if (itemsError) {
      await supabase.from('sales_orders').delete().eq('id', order.id);

      return res.status(500).json({
        success: false,
        error: itemsError.message || 'Failed to create sales order items',
        details: itemsError.details || null,
        code: itemsError.code || null,
        hint: itemsError.hint || null,
      });
    }

    const { error: paymentError } = await supabase.from('payments').insert([
      {
        sales_order_id: order.id,
        payment_method: payment_method || 'cash',
        bank_name: payment_method === 'cash' ? null : bank_name || null,
        reference_number:
          payment_method === 'cash' ? null : reference_number || null,
        amount: paymentAmount,
        status: 'pending',
        performed_by: performedBy,
        performed_by_name: performedByName,
        confirmed_by: null,
        confirmed_by_name: null,
        notes: null,
      },
    ]);

    if (paymentError) {
      await supabase
        .from('sales_order_items')
        .delete()
        .eq('sales_order_id', order.id);

      await supabase.from('sales_orders').delete().eq('id', order.id);

      return res.status(500).json({
        success: false,
        error: paymentError.message || 'Failed to create payment record',
        details: paymentError.details || null,
        code: paymentError.code || null,
        hint: paymentError.hint || null,
      });
    }

    await reserveOrderItems(order.id, performedBy, performedByName, customer_id);

    const { error: historyError } = await supabase.from('order_history').insert([
      {
        sales_order_id: order.id,
        action: 'created',
        old_status: null,
        new_status: initialStatus,
        performed_by: performedBy,
        performed_by_name: performedByName,
        confirmed_by: null,
        confirmed_by_name: null,
        notes:
          initialStatus === 'pending_admin'
            ? 'Order created with full submitted payment, waiting for admin approval'
            : 'Order created with partial payment and inventory reserved',
      },
    ]);

    if (historyError) {
      console.error('Order history insert failed:', historyError);
    }

    const responseData: any = {
      id: order.id,
      order_number: order.order_number,
      customer_name: customer.full_name,
      reference_number: reference_number || null,
      quantity: orderItems[0]?.quantity || 1,
      unit_price: orderItems[0]?.unit_price || totalAmount,
      total_amount: totalAmount,
      deposit_bank: bank_name || null,
      deposit_amount: paymentAmount,
      submitted_amount: paymentAmount,
      remaining_amount: Math.max(0, totalAmount - paymentAmount),
      deposit_status: 'pending',
      notes: notes || null,
      created_at: order.created_at,
      status: initialStatus,
      performed_by: performedBy,
      performed_by_name: performedByName,
      confirmed_by: null,
      confirmed_by_name: null,
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

    return res.json({
      success: true,
      data: responseData,
      message:
        initialStatus === 'pending_admin'
          ? `Sales order ${responseData.order_number} fully paid and sent for admin approval.`
          : `Sales order ${responseData.order_number} partially paid and reserved. Remaining: ${
              totalAmount - paymentAmount
            }`,
    });
  } catch (error: any) {
    console.error('Error creating sales order:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create sales order',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

// ============================================
// UPDATE SALE REQUEST BEFORE ADMIN APPROVAL
// Worker can edit request while status is pending/pending_admin.
// ============================================

export const updateSaleRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actor = getActor(req, 'Worker');

    const {
      customer_id,
      notes,
      quantity,
      unit_price,
      item_type,
      vehicle_id,
      part_id,
      item_id,
      chassis_number,
      part_number,
      payment_method,
      bank_name,
      reference_number,
      deposit_amount,
    } = req.body;

    if (actor.role && !['worker', 'store_manager'].includes(actor.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only workers or store managers can edit sale requests',
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

    if (!['pending', 'pending_admin'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error:
          'This request can no longer be edited because it has already been approved, cancelled, or completed.',
      });
    }

    if (
      actor.role === 'worker' &&
      order.performed_by &&
      actor.id &&
      order.performed_by !== actor.id
    ) {
      return res.status(403).json({
        success: false,
        error: 'Workers can only edit their own sale requests',
      });
    }

    const { data: existingItem, error: itemError } = await supabase
      .from('sales_order_items')
      .select('*')
      .eq('sales_order_id', id)
      .limit(1)
      .single();

    if (itemError) throw itemError;

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        error: 'Sales order item not found',
      });
    }

    const oldStatus = order.status;
    const oldItemType = existingItem.item_type;
    const oldVehicleId = existingItem.vehicle_id;
    const oldPartId = existingItem.part_id;
    const oldQuantity = Number(existingItem.quantity || 1);

    let newItemType = item_type || oldItemType;
    let newVehicleId = oldVehicleId;
    let newPartId = oldPartId;

    if (vehicle_id || chassis_number) {
      newItemType = 'vehicle';
    }

    if (part_id || part_number) {
      newItemType = 'part';
    }

    if (!['vehicle', 'part'].includes(newItemType)) {
      return res.status(400).json({
        success: false,
        error: 'item_type must be vehicle or part',
      });
    }

    let vehicleInfo: any = null;
    let partInfo: any = null;

    if (newItemType === 'vehicle') {
      newPartId = null;

      if (vehicle_id || item_id) {
        newVehicleId = vehicle_id || item_id;
      }

      if (!newVehicleId && chassis_number) {
        const { data: vehicleByChassis, error: chassisError } = await supabase
          .from('vehicles')
          .select('id')
          .eq('chassis_number', chassis_number)
          .single();

        if (chassisError || !vehicleByChassis) {
          return res.status(404).json({
            success: false,
            error: 'Vehicle not found for provided chassis number',
            details: chassisError?.message || null,
          });
        }

        newVehicleId = vehicleByChassis.id;
      }

      if (!newVehicleId) {
        return res.status(400).json({
          success: false,
          error: 'vehicle_id is required for vehicle request',
        });
      }

      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, model, status, unit_price, chassis_number, specifications')
        .eq('id', newVehicleId)
        .single();

      if (vehicleError || !vehicle) {
        return res.status(404).json({
          success: false,
          error: 'Selected vehicle not found',
          details: vehicleError?.message || null,
        });
      }

      const isSameVehicle =
        oldItemType === 'vehicle' && oldVehicleId === newVehicleId;

      if (!isSameVehicle && vehicle.status !== 'available') {
        return res.status(400).json({
          success: false,
          error: `Vehicle is not available. Current status: ${vehicle.status}`,
        });
      }

      vehicleInfo = vehicle;
    }

    if (newItemType === 'part') {
      newVehicleId = null;

      if (part_id || item_id) {
        newPartId = part_id || item_id;
      }

      if (!newPartId && part_number) {
        const { data: partByNumber, error: partNumberError } = await supabase
          .from('parts')
          .select('id')
          .eq('part_number', part_number)
          .single();

        if (partNumberError || !partByNumber) {
          return res.status(404).json({
            success: false,
            error: 'Part not found for provided part number',
            details: partNumberError?.message || null,
          });
        }

        newPartId = partByNumber.id;
      }

      if (!newPartId) {
        return res.status(400).json({
          success: false,
          error: 'part_id is required for part request',
        });
      }

      const { data: part, error: partError } = await supabase
        .from('parts')
        .select(
          'id, part_number, name, unit_price, quantity, reserved_quantity, specifications'
        )
        .eq('id', newPartId)
        .single();

      if (partError || !part) {
        return res.status(404).json({
          success: false,
          error: 'Selected part not found',
          details: partError?.message || null,
        });
      }

      partInfo = part;
    }

    const newQuantity =
      newItemType === 'vehicle'
        ? 1
        : quantity !== undefined
        ? Number(quantity)
        : oldQuantity;

    if (!newQuantity || newQuantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be greater than 0',
      });
    }

    const defaultPrice =
      newItemType === 'vehicle'
        ? Number(vehicleInfo?.unit_price || existingItem.unit_price)
        : Number(partInfo?.unit_price || existingItem.unit_price);

    const newUnitPrice =
      unit_price !== undefined ? Number(unit_price) : defaultPrice;

    if (!newUnitPrice || newUnitPrice <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Unit price must be greater than 0',
      });
    }

    const newTotalAmount = newQuantity * newUnitPrice;

    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('sales_order_id', id)
      .order('created_at', { ascending: false });

    if (paymentsError) throw paymentsError;

    const latestPendingPayment =
      payments?.find((payment) => payment.status === 'pending') || null;

    const currentSubmittedTotal =
      payments
        ?.filter((payment) =>
          ['pending', 'confirmed'].includes(payment.status)
        )
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 0;

    let proposedSubmittedTotal = currentSubmittedTotal;

    if (deposit_amount !== undefined) {
      const proposedDepositAmount = Number(deposit_amount || 0);

      if (!proposedDepositAmount || proposedDepositAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Payment amount must be greater than 0',
        });
      }

      proposedSubmittedTotal =
        currentSubmittedTotal -
        Number(latestPendingPayment?.amount || 0) +
        proposedDepositAmount;
    }

    if (proposedSubmittedTotal > newTotalAmount) {
      return res.status(400).json({
        success: false,
        error: 'Submitted payment cannot be greater than total amount',
      });
    }

    const finalPaymentMethod =
      payment_method || latestPendingPayment?.payment_method || 'cash';

    if (
      finalPaymentMethod !== 'cash' &&
      (payment_method !== undefined ||
        bank_name !== undefined ||
        reference_number !== undefined ||
        deposit_amount !== undefined)
    ) {
      const finalBankName =
        bank_name !== undefined ? bank_name : latestPendingPayment?.bank_name;

      if (!finalBankName) {
        return res.status(400).json({
          success: false,
          error: 'Bank name is required for non-cash payments',
        });
      }
    }

    const isSameVehicle =
      oldItemType === 'vehicle' &&
      newItemType === 'vehicle' &&
      oldVehicleId === newVehicleId;

    const isSamePart =
      oldItemType === 'part' &&
      newItemType === 'part' &&
      oldPartId === newPartId;

    if (newItemType === 'part' && partInfo) {
      const totalStock = Number(partInfo.quantity || 0);
      const reservedStock = Number(partInfo.reserved_quantity || 0);

      const availableForThisRequest = isSamePart
        ? totalStock - reservedStock + oldQuantity
        : totalStock - reservedStock;

      if (newQuantity > availableForThisRequest) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock. Available: ${availableForThisRequest}, Requested: ${newQuantity}`,
        });
      }
    }

    if (!isSameVehicle && oldItemType === 'vehicle' && oldVehicleId) {
      await supabase
        .from('vehicles')
        .update({ status: 'available' })
        .eq('id', oldVehicleId);

      await supabase.from('vehicle_history').insert({
        vehicle_id: oldVehicleId,
        event_type: 'returned',
        sales_order_id: id,
        performed_by: actor.id,
        performed_by_name: actor.name,
        notes: 'Worker edited request and released previous vehicle reservation',
      });
    }

    if (!isSamePart && oldItemType === 'part' && oldPartId) {
      const { data: oldPart, error: oldPartError } = await supabase
        .from('parts')
        .select('reserved_quantity')
        .eq('id', oldPartId)
        .single();

      if (oldPartError) throw oldPartError;

      const newOldReserved = Math.max(
        0,
        Number(oldPart.reserved_quantity || 0) - oldQuantity
      );

      const { error: releaseOldPartError } = await supabase
        .from('parts')
        .update({ reserved_quantity: newOldReserved })
        .eq('id', oldPartId);

      if (releaseOldPartError) throw releaseOldPartError;

      await supabase.from('part_transactions').insert({
        part_id: oldPartId,
        transaction_type: 'returned',
        quantity_change: -oldQuantity,
        quantity_after: newOldReserved,
        sales_order_id: id,
        performed_by: actor.id,
        performed_by_name: actor.name,
        notes: 'Worker edited request and released previous part reservation',
      });
    }

    if (!isSameVehicle && newItemType === 'vehicle' && newVehicleId) {
      const { error: reserveVehicleError } = await supabase
        .from('vehicles')
        .update({ status: 'reserved' })
        .eq('id', newVehicleId);

      if (reserveVehicleError) throw reserveVehicleError;

      await supabase.from('vehicle_history').insert({
        vehicle_id: newVehicleId,
        event_type: 'reserved',
        customer_id: customer_id || order.customer_id,
        sales_order_id: id,
        performed_by: actor.id,
        performed_by_name: actor.name,
        notes: 'Worker edited request and reserved new vehicle',
      });
    }

    if (newItemType === 'part' && newPartId) {
      const { data: currentPart, error: currentPartError } = await supabase
        .from('parts')
        .select('reserved_quantity')
        .eq('id', newPartId)
        .single();

      if (currentPartError) throw currentPartError;

      let newReservedQuantity = Number(currentPart.reserved_quantity || 0);

      if (isSamePart) {
        newReservedQuantity =
          newReservedQuantity + (newQuantity - oldQuantity);
      } else {
        newReservedQuantity = newReservedQuantity + newQuantity;
      }

      newReservedQuantity = Math.max(0, newReservedQuantity);

      const { error: reservePartError } = await supabase
        .from('parts')
        .update({ reserved_quantity: newReservedQuantity })
        .eq('id', newPartId);

      if (reservePartError) throw reservePartError;

      if (isSamePart) {
        const { data: existingReservedTransaction } = await supabase
          .from('part_transactions')
          .select('id')
          .eq('part_id', newPartId)
          .eq('sales_order_id', id)
          .eq('transaction_type', 'reserved')
          .maybeSingle();

        if (existingReservedTransaction) {
          await supabase
            .from('part_transactions')
            .update({
              quantity_change: newQuantity,
              quantity_after: newReservedQuantity,
              performed_by: actor.id,
              performed_by_name: actor.name,
              notes: `Worker edited request quantity from ${oldQuantity} to ${newQuantity}`,
            })
            .eq('id', existingReservedTransaction.id);
        } else {
          await supabase.from('part_transactions').insert({
            part_id: newPartId,
            transaction_type: 'reserved',
            quantity_change: newQuantity,
            quantity_after: newReservedQuantity,
            sales_order_id: id,
            performed_by: actor.id,
            performed_by_name: actor.name,
            notes: 'Worker edited request and reserved part quantity',
          });
        }
      } else {
        await supabase.from('part_transactions').insert({
          part_id: newPartId,
          transaction_type: 'reserved',
          quantity_change: newQuantity,
          quantity_after: newReservedQuantity,
          sales_order_id: id,
          performed_by: actor.id,
          performed_by_name: actor.name,
          notes: 'Worker edited request and reserved new part',
        });
      }
    }

    const { error: updateItemError } = await supabase
      .from('sales_order_items')
      .update({
        item_type: newItemType,
        vehicle_id: newItemType === 'vehicle' ? newVehicleId : null,
        part_id: newItemType === 'part' ? newPartId : null,
        quantity: newQuantity,
        unit_price: newUnitPrice,
        subtotal: newTotalAmount,
      })
      .eq('id', existingItem.id);

    if (updateItemError) throw updateItemError;

    if (
      payment_method !== undefined ||
      bank_name !== undefined ||
      reference_number !== undefined ||
      deposit_amount !== undefined
    ) {
      if (!latestPendingPayment) {
        if (deposit_amount === undefined) {
          return res.status(400).json({
            success: false,
            error: 'No pending payment found to update',
          });
        }

        const { error: insertPaymentError } = await supabase
          .from('payments')
          .insert({
            sales_order_id: id,
            payment_method: finalPaymentMethod,
            bank_name:
              finalPaymentMethod === 'cash' ? null : bank_name || null,
            reference_number:
              finalPaymentMethod === 'cash' ? null : reference_number || null,
            amount: Number(deposit_amount),
            status: 'pending',
            performed_by: actor.id,
            performed_by_name: actor.name,
          });

        if (insertPaymentError) throw insertPaymentError;
      } else {
        const paymentUpdates: any = {
          performed_by: latestPendingPayment.performed_by || actor.id,
          performed_by_name: latestPendingPayment.performed_by_name || actor.name,
        };

        if (payment_method !== undefined) {
          paymentUpdates.payment_method = finalPaymentMethod;
        }

        if (bank_name !== undefined || payment_method !== undefined) {
          paymentUpdates.bank_name =
            finalPaymentMethod === 'cash'
              ? null
              : bank_name !== undefined
              ? bank_name || null
              : latestPendingPayment.bank_name || null;
        }

        if (reference_number !== undefined || payment_method !== undefined) {
          paymentUpdates.reference_number =
            finalPaymentMethod === 'cash'
              ? null
              : reference_number !== undefined
              ? reference_number || null
              : latestPendingPayment.reference_number || null;
        }

        if (deposit_amount !== undefined) {
          paymentUpdates.amount = Number(deposit_amount);
        }

        const { error: updatePaymentError } = await supabase
          .from('payments')
          .update(paymentUpdates)
          .eq('id', latestPendingPayment.id);

        if (updatePaymentError) throw updatePaymentError;
      }
    }

    const submittedAfterEdit = await getSubmittedPaymentTotal(id);
    const newStatus =
      submittedAfterEdit >= newTotalAmount ? 'pending_admin' : 'pending';

    const orderUpdates: any = {
      total_amount: newTotalAmount,
      status: newStatus,
      performed_by: order.performed_by || actor.id,
      performed_by_name: order.performed_by_name || actor.name,
    };

    if (customer_id !== undefined) orderUpdates.customer_id = customer_id;
    if (notes !== undefined) orderUpdates.notes = notes || null;

    const { data: updatedOrder, error: updateOrderError } = await supabase
      .from('sales_orders')
      .update(orderUpdates)
      .eq('id', id)
      .select()
      .single();

    if (updateOrderError) throw updateOrderError;

    await supabase.from('order_history').insert({
      sales_order_id: id,
      action: 'request_edited',
      old_status: oldStatus,
      new_status: newStatus,
      performed_by: actor.id,
      performed_by_name: actor.name,
      notes: 'Worker edited sale request before admin approval',
    });

    return res.json({
      success: true,
      data: {
        ...updatedOrder,
        submitted_amount: submittedAfterEdit,
        remaining_amount: Math.max(0, newTotalAmount - submittedAfterEdit),
      },
      message: 'Sale request updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating sale request:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update sale request',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

// ============================================
// UPDATE ORDER STATUS
// ============================================

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      status,
      confirmed_by,
      confirmed_by_name,
      performed_by,
      performed_by_name,
    } = req.body;

    const confirmedBy = cleanNullable(confirmed_by);
    const confirmedByName = cleanNullable(confirmed_by_name);

    const fallbackPerformedBy = cleanNullable(performed_by);
    const fallbackPerformedByName = cleanNullable(performed_by_name);

    const validStatuses = [
      'draft',
      'pending',
      'pending_admin',
      'confirmed',
      'completed',
      'cancelled',
    ];

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
      updateData.confirmed_by = confirmedBy;
      updateData.confirmed_by_name = confirmedByName;

      const { data: items, error: itemsError } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', id);

      if (itemsError) throw itemsError;

      for (const item of items || []) {
        if (item.item_type === 'vehicle') {
          const { error: vehicleUpdateError } = await supabase
            .from('vehicles')
            .update({ status: 'sold' })
            .eq('id', item.vehicle_id);

          if (vehicleUpdateError) throw vehicleUpdateError;

          const { data: existingReservedHistory, error: reservedHistoryError } =
            await supabase
              .from('vehicle_history')
              .select('id')
              .eq('vehicle_id', item.vehicle_id)
              .eq('sales_order_id', id)
              .eq('event_type', 'reserved')
              .maybeSingle();

          if (reservedHistoryError) throw reservedHistoryError;

          if (existingReservedHistory) {
            const { error: updateHistoryError } = await supabase
              .from('vehicle_history')
              .update({
                event_type: 'sold',
                confirmed_by: confirmedBy,
                confirmed_by_name: confirmedByName,
                notes: 'Sale confirmed by admin',
              })
              .eq('id', existingReservedHistory.id);

            if (updateHistoryError) throw updateHistoryError;
          } else {
            const { data: existingSoldHistory, error: existingSoldHistoryError } =
              await supabase
                .from('vehicle_history')
                .select('id')
                .eq('vehicle_id', item.vehicle_id)
                .eq('sales_order_id', id)
                .eq('event_type', 'sold')
                .maybeSingle();

            if (existingSoldHistoryError) throw existingSoldHistoryError;

            if (!existingSoldHistory) {
              const { error: insertHistoryError } = await supabase
                .from('vehicle_history')
                .insert({
                  vehicle_id: item.vehicle_id,
                  event_type: 'sold',
                  customer_id: order.customer_id || null,
                  sales_order_id: id,
                  performed_by: order.performed_by || fallbackPerformedBy,
                  performed_by_name:
                    order.performed_by_name || fallbackPerformedByName,
                  confirmed_by: confirmedBy,
                  confirmed_by_name: confirmedByName,
                  notes: 'Sale confirmed by admin',
                });

              if (insertHistoryError) throw insertHistoryError;
            }
          }
        }

        if (item.item_type === 'part') {
          const { data: part, error: partError } = await supabase
            .from('parts')
            .select('quantity, reserved_quantity')
            .eq('id', item.part_id)
            .single();

          if (partError) throw partError;

          const soldQty = Number(item.quantity || 0);
          const newQuantity = Math.max(0, Number(part.quantity || 0) - soldQty);
          const newReserved = Math.max(
            0,
            Number(part.reserved_quantity || 0) - soldQty
          );

          const { error: partUpdateError } = await supabase
            .from('parts')
            .update({
              quantity: newQuantity,
              reserved_quantity: newReserved,
            })
            .eq('id', item.part_id);

          if (partUpdateError) throw partUpdateError;

          const {
            data: existingReservedTransaction,
            error: reservedTransactionError,
          } = await supabase
            .from('part_transactions')
            .select('id')
            .eq('part_id', item.part_id)
            .eq('sales_order_id', id)
            .eq('transaction_type', 'reserved')
            .maybeSingle();

          if (reservedTransactionError) throw reservedTransactionError;

          if (existingReservedTransaction) {
            const { error: updateTransactionError } = await supabase
              .from('part_transactions')
              .update({
                transaction_type: 'sold',
                quantity_change: -soldQty,
                quantity_after: newQuantity,
                confirmed_by: confirmedBy,
                confirmed_by_name: confirmedByName,
                notes: 'Sale confirmed by admin',
              })
              .eq('id', existingReservedTransaction.id);

            if (updateTransactionError) throw updateTransactionError;
          } else {
            const {
              data: existingSoldTransaction,
              error: existingSoldTransactionError,
            } = await supabase
              .from('part_transactions')
              .select('id')
              .eq('part_id', item.part_id)
              .eq('sales_order_id', id)
              .eq('transaction_type', 'sold')
              .maybeSingle();

            if (existingSoldTransactionError) throw existingSoldTransactionError;

            if (!existingSoldTransaction) {
              const { error: insertTransactionError } = await supabase
                .from('part_transactions')
                .insert({
                  part_id: item.part_id,
                  transaction_type: 'sold',
                  quantity_change: -soldQty,
                  quantity_after: newQuantity,
                  sales_order_id: id,
                  performed_by: order.performed_by || fallbackPerformedBy,
                  performed_by_name:
                    order.performed_by_name || fallbackPerformedByName,
                  confirmed_by: confirmedBy,
                  confirmed_by_name: confirmedByName,
                  notes: 'Sale confirmed by admin',
                });

              if (insertTransactionError) throw insertTransactionError;
            }
          }
        }
      }
    }

    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      await releaseReservedItems(
        id,
        fallbackPerformedBy || confirmedBy || null,
        fallbackPerformedByName || confirmedByName || null
      );
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
        performed_by: order.performed_by || fallbackPerformedBy || null,
        performed_by_name:
          order.performed_by_name || fallbackPerformedByName || null,
        confirmed_by: status === 'confirmed' ? confirmedBy : null,
        confirmed_by_name: status === 'confirmed' ? confirmedByName : null,
        notes: `Status changed from ${oldStatus} to ${status}`,
      },
    ]);

    return res.json({
      success: true,
      data,
      message: `Order status updated to ${status} successfully`,
    });
  } catch (error: any) {
    console.error('Error updating order status:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update order status',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

// Kept for compatibility.
export const workerConfirmFullPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { performed_by, performed_by_name } = req.body || {};

    const newStatus = await updateOrderStatusFromSubmittedPayments(
      id,
      cleanNullable(performed_by),
      cleanNullable(performed_by_name)
    );

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
  } catch (error: any) {
    console.error('Error confirming full payment:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to confirm payment',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

// ============================================
// CANCEL ORDER
// ============================================

export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { performed_by, performed_by_name } = req.body || {};

    const performedBy = cleanNullable(performed_by);
    const performedByName = cleanNullable(performed_by_name);

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

    await releaseReservedItems(id, performedBy, performedByName);

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
        performed_by: performedBy,
        performed_by_name: performedByName,
        notes: 'Order cancelled and inventory restored',
      },
    ]);

    res.json({
      success: true,
      data,
      message: 'Order cancelled successfully and inventory restored',
    });
  } catch (error: any) {
    console.error('Error cancelling order:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel order',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
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
  } catch (error: any) {
    console.error('Error deleting order:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete order',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};