import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// ============================================
// GET ALL CUSTOMERS
// ============================================
export const getCustomers = async (req: Request, res: Response) => {
  try {
    const { search, limit = 100, offset = 0 } = req.query;
    
    let query = supabase.from('customers').select('*', { count: 'exact' });
    
    // Apply search filter if provided
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
      );
    }
    
    const { data, error, count } = await query
      .order('full_name', { ascending: true })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: data || [],
      pagination: {
        total: count,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      },
      message: 'Customers fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customers'
    });
  }
};

// ============================================
// GET CUSTOMER BY ID
// ============================================
export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }
      throw error;
    }
    
    res.json({
      success: true,
      data,
      message: 'Customer fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer'
    });
  }
};

// ============================================
// CREATE NEW CUSTOMER
// ============================================
export const createCustomer = async (req: Request, res: Response) => {
  try {
    const { full_name, phone, email, address } = req.body;
    
    // Validation
    if (!full_name || full_name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Customer name is required'
      });
    }
    
    // Check if customer with same email already exists
    if (email) {
      const { data: existingEmail } = await supabase
        .from('customers')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          error: 'Customer with this email already exists'
        });
      }
    }
    
    // Check if customer with same phone already exists
    if (phone) {
      const { data: existingPhone } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();
      
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          error: 'Customer with this phone number already exists'
        });
      }
    }
    
    // Create customer
    const { data, error } = await supabase
      .from('customers')
      .insert([
        {
          full_name: full_name.trim(),
          phone: phone || null,
          email: email || null,
          address: address || null
        }
      ])
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      message: 'Customer created successfully'
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create customer'
    });
  }
};

// ============================================
// UPDATE CUSTOMER
// ============================================
export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { full_name, phone, email, address } = req.body;
    
    // Check if customer exists
    const { data: existing, error: findError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Check email uniqueness if being updated
    if (email && email !== existing.email) {
      const { data: emailExists } = await supabase
        .from('customers')
        .select('id')
        .eq('email', email)
        .neq('id', id)
        .maybeSingle();
      
      if (emailExists) {
        return res.status(400).json({
          success: false,
          error: 'Another customer already has this email'
        });
      }
    }
    
    // Check phone uniqueness if being updated
    if (phone && phone !== existing.phone) {
      const { data: phoneExists } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phone)
        .neq('id', id)
        .maybeSingle();
      
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          error: 'Another customer already has this phone number'
        });
      }
    }
    
    // Build update object
    const updates: any = {};
    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (phone !== undefined) updates.phone = phone || null;
    if (email !== undefined) updates.email = email || null;
    if (address !== undefined) updates.address = address || null;
    
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      message: 'Customer updated successfully'
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update customer'
    });
  }
};

// ============================================
// DELETE CUSTOMER
// ============================================
export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if customer exists
    const { data: existing, error: findError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Check if customer has any orders
    const { data: orders, error: ordersError } = await supabase
      .from('sales_orders')
      .select('id')
      .eq('customer_id', id)
      .limit(1);
    
    if (orders && orders.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete customer with existing orders'
      });
    }
    
    // Delete customer
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete customer'
    });
  }
};

// ============================================
// SEARCH CUSTOMERS
// ============================================
export const searchCustomers = async (req: Request, res: Response) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || (q as string).trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
      .order('full_name', { ascending: true })
      .limit(parseInt(limit as string));
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: data || [],
      message: 'Search completed successfully'
    });
  } catch (error) {
    console.error('Error searching customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search customers'
    });
  }
};

// ============================================
// GET CUSTOMER ORDERS
// ============================================
export const getCustomerOrders = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, full_name')
      .eq('id', id)
      .single();
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Get all orders with their items
    const { data: orders, error: ordersError } = await supabase
      .from('sales_orders')
      .select(`
        id,
        order_number,
        order_date,
        status,
        total_amount,
        notes,
        created_at,
        sales_order_items (
          id,
          item_type,
          quantity,
          unit_price,
          subtotal,
          vehicle:vehicle_id (
            model,
            chassis_number,
            specifications
          ),
          part:part_id (
            name,
            specifications
          )
        )
      `)
      .eq('customer_id', id)
      .order('order_date', { ascending: false });
    
    if (ordersError) throw ordersError;
    
    // Format the response to be more readable
    const formattedOrders = orders?.map(order => ({
      id: order.id,
      order_number: order.order_number,
      order_date: order.order_date,
      status: order.status,
      total_amount: order.total_amount,
      notes: order.notes,
      items: order.sales_order_items?.map((item: any) => ({
        item_type: item.item_type,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        ...(item.item_type === 'vehicle' && item.vehicle && {
          vehicle_model: item.vehicle.model,
          chassis_number: item.vehicle.chassis_number,
          specifications: item.vehicle.specifications
        }),
        ...(item.item_type === 'part' && item.part && {
          part_name: item.part.name,
          part_specifications: item.part.specifications
        })
      })) || []
    })) || [];
    
    res.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          full_name: customer.full_name
        },
        orders: formattedOrders,
        total_orders: formattedOrders.length
      },
      message: 'Customer orders fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer orders'
    });
  }
};