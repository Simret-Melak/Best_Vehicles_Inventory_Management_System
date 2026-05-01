import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// ============================================
// VEHICLE FUNCTIONS
// ============================================

export const getVehicles = async (req: Request, res: Response) => {
  try {
    const { status, model } = req.query;
    let query = supabase.from('vehicles').select('*');
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (model) {
      query = query.ilike('model', `%${model}%`);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      message: 'Vehicles fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicles'
    });
  }
};

// Get available vehicles (not reserved or sold)
export const getAvailableVehicles = async (req: Request, res: Response) => {
  try {
    // Get reserved vehicle IDs from pending and pending_admin orders
    const { data: pendingOrders } = await supabase
      .from('sales_orders')
      .select('id')
      .in('status', ['pending', 'pending_admin']);
    
    const pendingOrderIds = pendingOrders?.map(o => o.id) || [];
    const reservedIds = new Set();
    
    if (pendingOrderIds.length > 0) {
      const { data: reservedItems } = await supabase
        .from('sales_order_items')
        .select('vehicle_id')
        .eq('item_type', 'vehicle')
        .in('sales_order_id', pendingOrderIds);
      
      reservedItems?.forEach((item: any) => {
        if (item.vehicle_id) reservedIds.add(item.vehicle_id);
      });
    }
    
    // Get vehicles that are available
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('status', 'available');
    
    if (error) throw error;
    
    // Filter out reserved vehicles
    const availableVehicles = data?.filter(v => !reservedIds.has(v.id)) || [];
    
    res.json({
      success: true,
      data: availableVehicles,
      message: 'Available vehicles fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching available vehicles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available vehicles'
    });
  }
};

export const createVehicle = async (req: Request, res: Response) => {
  try {
    const { model, chassis_number, specifications, unit_price } = req.body;

    if (!model || !chassis_number || !unit_price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: model, chassis_number, unit_price'
      });
    }

    const { data: existing, error: checkError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('chassis_number', chassis_number)
      .single();

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle with this chassis number already exists'
      });
    }

    const { data, error } = await supabase
      .from('vehicles')
      .insert([
        {
          model,
          chassis_number,
          specifications: specifications || null,
          unit_price,
          status: 'available'
        }
      ])
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from('vehicle_history')
      .insert({
        vehicle_id: data.id,
        event_type: 'received',
        notes: 'Vehicle added to inventory'
      });

    res.json({
      success: true,
      data,
      message: 'Vehicle created successfully'
    });
  } catch (error) {
    console.error('Error creating vehicle:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create vehicle'
    });
  }
};

export const getVehicleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found'
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data,
      message: 'Vehicle fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicle'
    });
  }
};

export const updateVehicle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { model, chassis_number, specifications, unit_price, status } = req.body;

    const { data: existing, error: findError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    if (chassis_number && chassis_number !== existing.chassis_number) {
      const { data: duplicate } = await supabase
        .from('vehicles')
        .select('id')
        .eq('chassis_number', chassis_number)
        .neq('id', id)
        .single();

      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: 'Chassis number already exists on another vehicle'
        });
      }
    }

    const updates: any = {};
    if (model !== undefined) updates.model = model;
    if (chassis_number !== undefined) updates.chassis_number = chassis_number;
    if (specifications !== undefined) updates.specifications = specifications;
    if (unit_price !== undefined) updates.unit_price = unit_price;
    if (status !== undefined) updates.status = status;

    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (status && status !== existing.status) {
      await supabase
        .from('vehicle_history')
        .insert({
          vehicle_id: id,
          event_type: status === 'sold' ? 'sold' : status === 'reserved' ? 'reserved' : 'received',
          notes: `Status changed from ${existing.status} to ${status}`
        });
    }

    res.json({
      success: true,
      data,
      message: 'Vehicle updated successfully'
    });
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update vehicle'
    });
  }
};

export const deleteVehicle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    if (existing.status === 'sold') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete sold vehicles for audit purposes'
      });
    }

    await supabase
      .from('vehicle_history')
      .delete()
      .eq('vehicle_id', id);

    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete vehicle'
    });
  }
};

export const getVehicleHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id, model, chassis_number')
      .eq('id', id)
      .single();

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    const { data, error } = await supabase
      .from('vehicle_history')
      .select(`
        *,
        customer:customer_id (full_name, phone),
        sales_order:sales_order_id (order_number)
      `)
      .eq('vehicle_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: {
        vehicle,
        history: data || []
      },
      message: 'Vehicle history fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching vehicle history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicle history'
    });
  }
};

// ============================================
// PARTS FUNCTIONS
// ============================================

// Get all parts
export const getParts = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    
    let query = supabase.from('parts').select('*');
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,specifications.ilike.%${search}%`);
    }
    
    const { data, error } = await query.order('name', { ascending: true });
    
    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      message: 'Parts fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching parts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch parts'
    });
  }
};

// Get available parts (with available quantity calculation)
export const getAvailableParts = async (req: Request, res: Response) => {
  try {
    const { data: parts, error } = await supabase
      .from('parts')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    
    // Get pending order IDs
    const { data: pendingOrders } = await supabase
      .from('sales_orders')
      .select('id')
      .in('status', ['pending', 'pending_admin']);
    
    const pendingOrderIds = pendingOrders?.map(o => o.id) || [];
    const reservedMap = new Map();
    
    if (pendingOrderIds.length > 0) {
      const { data: reservedItems } = await supabase
        .from('sales_order_items')
        .select('part_id, quantity')
        .eq('item_type', 'part')
        .in('sales_order_id', pendingOrderIds);
      
      reservedItems?.forEach((item: any) => {
        reservedMap.set(item.part_id, (reservedMap.get(item.part_id) || 0) + item.quantity);
      });
    }
    
    const partsWithAvailability = parts?.map(part => ({
      ...part,
      reserved_quantity: reservedMap.get(part.id) || 0,
      available_quantity: part.quantity - (reservedMap.get(part.id) || 0)
    })) || [];
    
    res.json({
      success: true,
      data: partsWithAvailability,
      message: 'Available parts fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching available parts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available parts'
    });
  }
};

// Get low stock parts (based on available quantity)
export const getLowStockParts = async (req: Request, res: Response) => {
  try {
    const { data: parts, error } = await supabase
      .from('parts')
      .select('*')
      .order('quantity', { ascending: true });
    
    if (error) throw error;
    
    // Get pending order IDs
    const { data: pendingOrders } = await supabase
      .from('sales_orders')
      .select('id')
      .in('status', ['pending', 'pending_admin']);
    
    const pendingOrderIds = pendingOrders?.map(o => o.id) || [];
    const reservedMap = new Map();
    
    if (pendingOrderIds.length > 0) {
      const { data: reservedItems } = await supabase
        .from('sales_order_items')
        .select('part_id, quantity')
        .eq('item_type', 'part')
        .in('sales_order_id', pendingOrderIds);
      
      reservedItems?.forEach((item: any) => {
        reservedMap.set(item.part_id, (reservedMap.get(item.part_id) || 0) + item.quantity);
      });
    }
    
    // Calculate available quantity and filter low stock
    const lowStockParts = parts?.filter(part => {
      const reserved = reservedMap.get(part.id) || 0;
      const available = part.quantity - reserved;
      return available < part.min_stock_alert;
    }) || [];

    res.json({
      success: true,
      data: lowStockParts,
      message: 'Low stock parts fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching low stock parts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch low stock parts'
    });
  }
};

// Get single part by ID
export const getPartById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Part not found'
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data,
      message: 'Part fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching part:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch part'
    });
  }
};

// Create new part (with reserved_quantity)
export const createPart = async (req: Request, res: Response) => {
  try {
    const { name, specifications, quantity, unit_price, min_stock_alert } = req.body;

    if (!name || unit_price === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, unit_price'
      });
    }

    const { data, error } = await supabase
      .from('parts')
      .insert([
        {
          name,
          specifications: specifications || null,
          quantity: quantity || 0,
          reserved_quantity: 0,
          unit_price,
          min_stock_alert: min_stock_alert || 5
        }
      ])
      .select()
      .single();

    if (error) throw error;

    if (quantity && quantity > 0) {
      await supabase
        .from('part_transactions')
        .insert({
          part_id: data.id,
          transaction_type: 'stock_in',
          quantity_change: quantity,
          quantity_after: quantity,
          notes: 'Initial stock'
        });
    }

    res.json({
      success: true,
      data,
      message: 'Part created successfully'
    });
  } catch (error) {
    console.error('Error creating part:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create part'
    });
  }
};

// Update part
export const updatePart = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, specifications, unit_price, min_stock_alert } = req.body;

    const { data: existing, error: findError } = await supabase
      .from('parts')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Part not found'
      });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (specifications !== undefined) updates.specifications = specifications;
    if (unit_price !== undefined) updates.unit_price = unit_price;
    if (min_stock_alert !== undefined) updates.min_stock_alert = min_stock_alert;

    const { data, error } = await supabase
      .from('parts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: 'Part updated successfully'
    });
  } catch (error) {
    console.error('Error updating part:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update part'
    });
  }
};

// Add part stock
export const addPartStock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity, notes } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be greater than 0'
      });
    }

    const { data: existing, error: findError } = await supabase
      .from('parts')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Part not found'
      });
    }

    const newQuantity = existing.quantity + quantity;

    const { data, error } = await supabase
      .from('parts')
      .update({ quantity: newQuantity })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from('part_transactions')
      .insert({
        part_id: id,
        transaction_type: 'stock_in',
        quantity_change: quantity,
        quantity_after: newQuantity,
        notes: notes || 'Stock added'
      });

    res.json({
      success: true,
      data,
      message: `Added ${quantity} units to ${existing.name}. New quantity: ${newQuantity}`
    });
  } catch (error) {
    console.error('Error adding part stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add stock'
    });
  }
};

// Get part transactions history
export const getPartTransactions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: part, error: partError } = await supabase
      .from('parts')
      .select('id, name, quantity, reserved_quantity, unit_price')
      .eq('id', id)
      .single();

    if (!part) {
      return res.status(404).json({
        success: false,
        error: 'Part not found'
      });
    }

    const { data, error } = await supabase
      .from('part_transactions')
      .select(`
        *,
        sales_order:sales_order_id (order_number)
      `)
      .eq('part_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: {
        part,
        transactions: data || []
      },
      message: 'Part transactions fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching part transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch part transactions'
    });
  }
};

// Delete part
export const deletePart = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabase
      .from('parts')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Part not found'
      });
    }

    const { data: transactions } = await supabase
      .from('part_transactions')
      .select('id')
      .eq('part_id', id)
      .limit(1);

    if (transactions && transactions.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete part with transaction history for audit purposes'
      });
    }

    const { error } = await supabase
      .from('parts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Part deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting part:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete part'
    });
  }
};