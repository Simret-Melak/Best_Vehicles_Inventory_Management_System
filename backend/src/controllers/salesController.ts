import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

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
    
    const { data, error, count } = await query
      .order('order_date', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);
    
    if (error) throw error;
    
    const ordersWithCustomers = await Promise.all(
      (data || []).map(async (order) => {
        const { data: customer } = await supabase
          .from('customers')
          .select('full_name, phone')
          .eq('id', order.customer_id)
          .single();
        
        return {
          ...order,
          customer: customer || null
        };
      })
    );
    
    res.json({
      success: true,
      data: ordersWithCustomers,
      pagination: {
        total: count,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      },
      message: 'Sales orders fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales orders'
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
          error: 'Sales order not found'
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
      .select(`
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
          name,
          specifications,
          unit_price
        )
      `)
      .eq('sales_order_id', id);
    
    if (itemsError) throw itemsError;
    
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('sales_order_id', id)
      .order('created_at', { ascending: false });
    
    const formattedItems = items?.map((item: any) => ({
      id: item.id,
      item_type: item.item_type,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
      ...(item.item_type === 'vehicle' && item.vehicle && {
        vehicle_id: item.vehicle.id,
        model: item.vehicle.model,
        chassis_number: item.vehicle.chassis_number,
        specifications: item.vehicle.specifications
      }),
      ...(item.item_type === 'part' && item.part && {
        part_id: item.part.id,
        name: item.part.name,
        specifications: item.part.specifications
      })
    })) || [];
    
    res.json({
      success: true,
      data: {
        ...order,
        customer,
        items: formattedItems,
        payments: payments || [],
        total_paid: payments?.reduce((sum, p) => 
          p.status === 'confirmed' ? sum + p.amount : sum, 0
        ) || 0,
        remaining_balance: order.total_amount - (payments?.reduce((sum, p) => 
          p.status === 'confirmed' ? sum + p.amount : sum, 0
        ) || 0)
      },
      message: 'Sales order fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching sales order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales order'
    });
  }
};

// ============================================
// CREATE SALES ORDER (UPDATED with draft status)
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
      unit_price
    } = req.body;
    
    let orderItems = [];
    let customerId = customer_id;
    let vehicleInfo = null;
    let partInfo = null;
    
    // Case 1: Selling a vehicle by chassis number
    if (chassis_number) {
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, model, unit_price, status, chassis_number, specifications')
        .eq('chassis_number', chassis_number)
        .single();
      
      if (vehicleError) {
        return res.status(404).json({
          success: false,
          error: `Vehicle with chassis number ${chassis_number} not found`
        });
      }
      
      if (vehicle.status !== 'available') {
        return res.status(400).json({
          success: false,
          error: `Vehicle is not available (status: ${vehicle.status})`
        });
      }
      
      const price = unit_price || vehicle.unit_price;
      
      orderItems.push({
        item_type: 'vehicle',
        vehicle_id: vehicle.id,
        quantity: quantity || 1,
        unit_price: price,
        subtotal: price * (quantity || 1)
      });
      
      vehicleInfo = vehicle;
    } 
    // Case 2: Selling a part by part number
    else if (part_number) {
      const { data: part, error: partError } = await supabase
        .from('parts')
        .select('id, name, unit_price, quantity, part_number, specifications')
        .eq('part_number', part_number)
        .single();
      
      if (partError) {
        return res.status(404).json({
          success: false,
          error: `Part with part number ${part_number} not found`
        });
      }
      
      if (part.quantity < (quantity || 1)) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for part. Available: ${part.quantity}, Requested: ${quantity || 1}`
        });
      }
      
      const price = unit_price || part.unit_price;
      
      orderItems.push({
        item_type: 'part',
        part_id: part.id,
        quantity: quantity || 1,
        unit_price: price,
        subtotal: price * (quantity || 1)
      });
      
      partInfo = part;
    }
    // Case 3: Selling by items array
    else if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const { item_type, item_id, part_number: itemPartNumber, chassis_number: itemChassisNumber, quantity: itemQty, unit_price: itemPrice } = item;
        
        if (item_type === 'vehicle') {
          let vehicleId = item_id;
          
          if (itemChassisNumber && !item_id) {
            const { data: vehicle } = await supabase
              .from('vehicles')
              .select('id')
              .eq('chassis_number', itemChassisNumber)
              .single();
            if (vehicle) vehicleId = vehicle.id;
          }
          
          const { data: vehicle, error: vehicleError } = await supabase
            .from('vehicles')
            .select('id, unit_price, status, model, chassis_number')
            .eq('id', vehicleId)
            .single();
          
          if (!vehicle) {
            return res.status(404).json({
              success: false,
              error: `Vehicle with ID ${vehicleId} not found`
            });
          }
          
          if (vehicle.status !== 'available') {
            return res.status(400).json({
              success: false,
              error: `Vehicle is not available (status: ${vehicle.status})`
            });
          }
          
          const price = itemPrice || vehicle.unit_price;
          orderItems.push({
            item_type: 'vehicle',
            vehicle_id: vehicle.id,
            quantity: itemQty || 1,
            unit_price: price,
            subtotal: price * (itemQty || 1)
          });
        } 
        else if (item_type === 'part') {
          let partId = item_id;
          
          if (itemPartNumber && !item_id) {
            const { data: part } = await supabase
              .from('parts')
              .select('id')
              .eq('part_number', itemPartNumber)
              .single();
            if (part) partId = part.id;
          }
          
          const { data: part, error: partError } = await supabase
            .from('parts')
            .select('id, unit_price, quantity, name, part_number')
            .eq('id', partId)
            .single();
          
          if (!part) {
            return res.status(404).json({
              success: false,
              error: `Part with ID ${partId} not found`
            });
          }
          
          if (part.quantity < (itemQty || 1)) {
            return res.status(400).json({
              success: false,
              error: `Insufficient stock for part ${part.name}. Available: ${part.quantity}, Requested: ${itemQty || 1}`
            });
          }
          
          const price = itemPrice || part.unit_price;
          orderItems.push({
            item_type: 'part',
            part_id: part.id,
            quantity: itemQty || 1,
            unit_price: price,
            subtotal: price * (itemQty || 1)
          });
        }
      }
    } 
    else {
      return res.status(400).json({
        success: false,
        error: 'Either chassis_number, part_number, or items array is required'
      });
    }
    
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required'
      });
    }
    
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, full_name, phone')
      .eq('id', customerId)
      .single();
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    const total_amount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    
    // NEW: Determine initial status based on payment
    const hasPayment = deposit_amount && deposit_amount > 0;
    const initialStatus = hasPayment ? 'pending' : 'draft';
    
    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .insert([
        {
          customer_id: customerId,
          total_amount,
          notes: notes || null,
          status: initialStatus
        }
      ])
      .select()
      .single();
    
    if (orderError) throw orderError;
    
    const orderItemsWithOrderId = orderItems.map(item => ({
      ...item,
      sales_order_id: order.id
    }));
    
    const { error: itemsError } = await supabase
      .from('sales_order_items')
      .insert(orderItemsWithOrderId);
    
    if (itemsError) throw itemsError;
    
    // Create payment if deposit was made
    if (deposit_amount && deposit_amount > 0) {
      const { error: paymentError } = await supabase
        .from('payments')
        .insert([
          {
            sales_order_id: order.id,
            payment_method: payment_method || 'bank_deposit',
            bank_name: bank_name || null,
            reference_number: reference_number || null,
            amount: deposit_amount,
            status: 'pending'
          }
        ]);
      
      if (paymentError) throw paymentError;
    }
    
    await supabase
      .from('order_history')
      .insert([
        {
          sales_order_id: order.id,
          action: 'created',
          new_status: initialStatus,
          notes: notes || 'Sales order created'
        }
      ]);
    
    let responseData: any = {
      id: order.id,
      order_number: order.order_number,
      customer_name: customer.full_name,
      reference_number: reference_number || null,
      quantity: quantity || orderItems[0]?.quantity || 1,
      unit_price: unit_price || orderItems[0]?.unit_price || total_amount,
      deposit_bank: bank_name,
      deposit_amount: deposit_amount || 0,
      deposit_status: deposit_amount ? 'pending' : null,
      notes: notes || null,
      created_at: order.created_at,
      status: order.status,
      requires_payment: !hasPayment
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
      message: hasPayment 
        ? `Sales order created successfully. Order number: ${order.order_number} (pending payment confirmation)`
        : `Sales order created as draft. Add payment to reserve items. Order number: ${order.order_number}`
    });
  } catch (error) {
    console.error('Error creating sales order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create sales order'
    });
  }
};

// ============================================
// UPDATE ORDER STATUS (UPDATED with new statuses)
// ============================================
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, confirmed_by } = req.body;
    
    const validStatuses = ['draft', 'pending', 'pending_admin', 'confirmed', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', id)
      .single();
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Sales order not found'
      });
    }
    
    const oldStatus = order.status;
    const updateData: any = { status };
    
    if (status === 'confirmed') {
      updateData.confirmed_at = new Date().toISOString();
      updateData.confirmed_by = confirmed_by || null;
    }
    
    // If confirming from pending_admin, mark items as sold
    if (status === 'confirmed' && oldStatus === 'pending_admin') {
      const { data: items } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', id);
      
      for (const item of items || []) {
        if (item.item_type === 'vehicle') {
          await supabase
            .from('vehicles')
            .update({ status: 'sold' })
            .eq('id', item.vehicle_id);
          
          await supabase
            .from('vehicle_history')
            .insert({
              vehicle_id: item.vehicle_id,
              event_type: 'sold',
              sales_order_id: id,
              performed_by: confirmed_by,
              notes: 'Sale confirmed by admin'
            });
        } else if (item.item_type === 'part') {
          const { data: part } = await supabase
            .from('parts')
            .select('quantity, reserved_quantity')
            .eq('id', item.part_id)
            .single();
          
          if (part) {
            const newQuantity = part.quantity - item.quantity;
            const newReserved = Math.max(0, (part.reserved_quantity || 0) - item.quantity);
            
            await supabase
              .from('parts')
              .update({ 
                quantity: newQuantity,
                reserved_quantity: newReserved
              })
              .eq('id', item.part_id);
            
            await supabase
              .from('part_transactions')
              .insert({
                part_id: item.part_id,
                transaction_type: 'sold',
                quantity_change: -item.quantity,
                quantity_after: newQuantity,
                sales_order_id: id,
                performed_by: confirmed_by,
                notes: 'Sale confirmed by admin'
              });
          }
        }
      }
    }
    
    // If cancelling, restore inventory
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      const { data: items } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', id);
      
      for (const item of items || []) {
        if (item.item_type === 'vehicle') {
          await supabase
            .from('vehicles')
            .update({ status: 'available' })
            .eq('id', item.vehicle_id);
          
          await supabase
            .from('vehicle_history')
            .insert({
              vehicle_id: item.vehicle_id,
              event_type: 'returned',
              sales_order_id: id,
              notes: 'Order cancelled - vehicle returned to inventory'
            });
        } else if (item.item_type === 'part') {
          const { data: part } = await supabase
            .from('parts')
            .select('quantity, reserved_quantity')
            .eq('id', item.part_id)
            .single();
          
          if (part) {
            const newReserved = Math.max(0, (part.reserved_quantity || 0) - item.quantity);
            
            await supabase
              .from('parts')
              .update({ reserved_quantity: newReserved })
              .eq('id', item.part_id);
            
            await supabase
              .from('part_transactions')
              .insert({
                part_id: item.part_id,
                transaction_type: 'returned',
                quantity_change: 0,
                quantity_after: part.quantity,
                sales_order_id: id,
                notes: 'Order cancelled - reservation released'
              });
          }
        }
      }
    }
    
    const { data, error } = await supabase
      .from('sales_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    await supabase
      .from('order_history')
      .insert([
        {
          sales_order_id: id,
          action: 'status_changed',
          old_status: oldStatus,
          new_status: status,
          notes: `Status changed from ${oldStatus} to ${status}`
        }
      ]);
    
    res.json({
      success: true,
      data,
      message: `Order status updated to ${status} successfully`
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status'
    });
  }
};

// ============================================
// WORKER CONFIRMS FULL PAYMENT (Send to Admin)
// ============================================
export const workerConfirmFullPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { performed_by } = req.body;

    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('*, payments(*)')
      .eq('id', id)
      .single();

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const totalPaid = order.payments
      ?.filter((p: any) => p.status === 'confirmed')
      .reduce((sum: number, p: any) => sum + p.amount, 0) || 0;

    if (totalPaid < order.total_amount) {
      return res.status(400).json({
        success: false,
        error: `Full payment not collected yet. Required: ${order.total_amount}, Paid: ${totalPaid}`
      });
    }

    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({ status: 'pending_admin' })
      .eq('id', id);

    if (updateError) throw updateError;

    await supabase
      .from('order_history')
      .insert([
        {
          sales_order_id: id,
          action: 'worker_confirmed_payment',
          old_status: order.status,
          new_status: 'pending_admin',
          notes: 'Worker confirmed full payment, awaiting admin approval'
        }
      ]);

    res.json({
      success: true,
      message: 'Full payment confirmed. Order sent to admin for final approval.'
    });
  } catch (error) {
    console.error('Error confirming full payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm payment'
    });
  }
};

// ============================================
// CANCEL ORDER (RESTORES INVENTORY)
// ============================================
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', id)
      .single();
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Sales order not found'
      });
    }
    
    if (order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Order is already cancelled'
      });
    }
    
    if (order.status === 'confirmed' || order.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a confirmed or completed order'
      });
    }
    
    const { data: items, error: itemsError } = await supabase
      .from('sales_order_items')
      .select('*')
      .eq('sales_order_id', id);
    
    if (itemsError) throw itemsError;
    
    for (const item of items || []) {
      if (item.item_type === 'vehicle') {
        await supabase
          .from('vehicles')
          .update({ status: 'available' })
          .eq('id', item.vehicle_id);
          
        await supabase
          .from('vehicle_history')
          .insert([
            {
              vehicle_id: item.vehicle_id,
              event_type: 'returned',
              sales_order_id: id,
              notes: 'Order cancelled - vehicle returned to inventory'
            }
          ]);
          
      } else if (item.item_type === 'part') {
        const { data: part } = await supabase
          .from('parts')
          .select('reserved_quantity')
          .eq('id', item.part_id)
          .single();
        
        if (part) {
          const newReserved = Math.max(0, (part.reserved_quantity || 0) - item.quantity);
          
          await supabase
            .from('parts')
            .update({ reserved_quantity: newReserved })
            .eq('id', item.part_id);
            
          await supabase
            .from('part_transactions')
            .insert([
              {
                part_id: item.part_id,
                transaction_type: 'returned',
                quantity_change: 0,
                quantity_after: newReserved,
                sales_order_id: id,
                notes: 'Order cancelled - reservation released'
              }
            ]);
        }
      }
    }
    
    const { data, error } = await supabase
      .from('sales_orders')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    await supabase
      .from('order_history')
      .insert([
        {
          sales_order_id: id,
          action: 'cancelled',
          old_status: order.status,
          new_status: 'cancelled',
          notes: 'Order cancelled and inventory restored'
        }
      ]);
    
    res.json({
      success: true,
      data,
      message: 'Order cancelled successfully and inventory restored'
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order'
    });
  }
};

// ============================================
// DELETE ORDER (HARD DELETE - USE WITH CAUTION)
// ============================================
export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('status')
      .eq('id', id)
      .single();
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Sales order not found'
      });
    }
    
    if (order.status !== 'draft' && order.status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Only draft or cancelled orders can be deleted'
      });
    }
    
    await supabase
      .from('sales_order_items')
      .delete()
      .eq('sales_order_id', id);
    
    await supabase
      .from('payments')
      .delete()
      .eq('sales_order_id', id);
    
    await supabase
      .from('order_history')
      .delete()
      .eq('sales_order_id', id);
    
    const { error } = await supabase
      .from('sales_orders')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete order'
    });
  }
};