import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const toNumber = (value: any) => {
  const numberValue = Number(value || 0);
  return Number.isNaN(numberValue) ? 0 : numberValue;
};

const getActor = (req: Request) => {
  const authReq = req as AuthenticatedRequest;

  const performedBy =
    authReq.user?.id ||
    req.body?.performed_by ||
    null;

  const performedByName =
    authReq.user?.full_name ||
    authReq.user?.email ||
    req.body?.performed_by_name ||
    null;

  return {
    performed_by: performedBy,
    performed_by_name: performedByName,
  };
};

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

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) throw error;

    return res.json({
      success: true,
      data: data || [],
      message: 'Vehicles fetched successfully',
    });
  } catch (error: any) {
    console.error('Error fetching vehicles:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch vehicles',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const getAvailableVehicles = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('status', 'available')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      data: data || [],
      message: 'Available vehicles fetched successfully',
    });
  } catch (error: any) {
    console.error('Error fetching available vehicles:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch available vehicles',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const createVehicle = async (req: Request, res: Response) => {
  try {
    const { model, chassis_number, specifications, unit_price } = req.body;
    const actor = getActor(req);

    if (!model || !chassis_number || unit_price === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: model, chassis_number, unit_price',
      });
    }

    const { data: duplicate, error: duplicateError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('chassis_number', chassis_number)
      .maybeSingle();

    if (duplicateError) throw duplicateError;

    if (duplicate) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle with this chassis number already exists',
      });
    }

    const { data, error } = await supabase
      .from('vehicles')
      .insert([
        {
          model,
          chassis_number,
          specifications: specifications || null,
          unit_price: toNumber(unit_price),
          status: 'available',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    const { error: historyError } = await supabase
      .from('vehicle_history')
      .insert({
        vehicle_id: data.id,
        event_type: 'received',
        performed_by: actor.performed_by,
        performed_by_name: actor.performed_by_name,
        notes: 'Vehicle added to inventory',
      });

    if (historyError) throw historyError;

    return res.json({
      success: true,
      data,
      message: 'Vehicle created successfully',
    });
  } catch (error: any) {
    console.error('Error creating vehicle:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create vehicle',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
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
          error: 'Vehicle not found',
        });
      }

      throw error;
    }

    return res.json({
      success: true,
      data,
      message: 'Vehicle fetched successfully',
    });
  } catch (error: any) {
    console.error('Error fetching vehicle:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch vehicle',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const updateVehicle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { model, chassis_number, specifications, unit_price, status } =
      req.body;
    const actor = getActor(req);

    const { data: existing, error: findError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();

    if (findError) throw findError;

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found',
      });
    }

    if (chassis_number && chassis_number !== existing.chassis_number) {
      const { data: duplicate, error: duplicateError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('chassis_number', chassis_number)
        .neq('id', id)
        .maybeSingle();

      if (duplicateError) throw duplicateError;

      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: 'Chassis number already exists on another vehicle',
        });
      }
    }

    const updates: any = {};

    if (model !== undefined) updates.model = model;
    if (chassis_number !== undefined) updates.chassis_number = chassis_number;
    if (specifications !== undefined) updates.specifications = specifications;
    if (unit_price !== undefined) updates.unit_price = toNumber(unit_price);
    if (status !== undefined) updates.status = status;

    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (status && status !== existing.status) {
      const eventType =
        status === 'sold'
          ? 'sold'
          : status === 'reserved'
          ? 'reserved'
          : status === 'available'
          ? 'returned'
          : 'received';

      const { error: historyError } = await supabase
        .from('vehicle_history')
        .insert({
          vehicle_id: id,
          event_type: eventType,
          performed_by: actor.performed_by,
          performed_by_name: actor.performed_by_name,
          notes: `Status changed from ${existing.status} to ${status}`,
        });

      if (historyError) throw historyError;
    }

    return res.json({
      success: true,
      data,
      message: 'Vehicle updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating vehicle:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update vehicle',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
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

    if (findError) throw findError;

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found',
      });
    }

    if (existing.status === 'sold') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete sold vehicles for audit purposes',
      });
    }

    const { error: historyDeleteError } = await supabase
      .from('vehicle_history')
      .delete()
      .eq('vehicle_id', id);

    if (historyDeleteError) throw historyDeleteError;

    const { error } = await supabase.from('vehicles').delete().eq('id', id);

    if (error) throw error;

    return res.json({
      success: true,
      message: 'Vehicle deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting vehicle:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete vehicle',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const getVehicleHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id, model, chassis_number, status, unit_price')
      .eq('id', id)
      .single();

    if (vehicleError) throw vehicleError;

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found',
      });
    }

    const { data, error } = await supabase
      .from('vehicle_history')
      .select(
        `
        *,
        customer:customer_id (full_name, phone),
        sales_order:sales_order_id (order_number)
      `
      )
      .eq('vehicle_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      data: {
        vehicle,
        history: data || [],
      },
      message: 'Vehicle history fetched successfully',
    });
  } catch (error: any) {
    console.error('Error fetching vehicle history:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch vehicle history',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

// ============================================
// PARTS FUNCTIONS
// ============================================

export const getParts = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;

    let query = supabase.from('parts').select('*');

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,specifications.ilike.%${search}%,part_number.ilike.%${search}%`
      );
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) throw error;

    const partsWithAvailability =
      data?.map((part) => ({
        ...part,
        available_quantity:
          toNumber(part.quantity) - toNumber(part.reserved_quantity),
      })) || [];

    return res.json({
      success: true,
      data: partsWithAvailability,
      message: 'Parts fetched successfully',
    });
  } catch (error: any) {
    console.error('Error fetching parts:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch parts',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const getAvailableParts = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    const partsWithAvailability =
      data
        ?.map((part) => ({
          ...part,
          available_quantity:
            toNumber(part.quantity) - toNumber(part.reserved_quantity),
        }))
        .filter((part) => part.available_quantity > 0) || [];

    return res.json({
      success: true,
      data: partsWithAvailability,
      message: 'Available parts fetched successfully',
    });
  } catch (error: any) {
    console.error('Error fetching available parts:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch available parts',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const getLowStockParts = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .order('quantity', { ascending: true });

    if (error) throw error;

    const lowStockParts =
      data
        ?.map((part) => ({
          ...part,
          available_quantity:
            toNumber(part.quantity) - toNumber(part.reserved_quantity),
        }))
        .filter(
          (part) =>
            toNumber(part.available_quantity) < toNumber(part.min_stock_alert)
        ) || [];

    return res.json({
      success: true,
      data: lowStockParts,
      message: 'Low stock parts fetched successfully',
    });
  } catch (error: any) {
    console.error('Error fetching low stock parts:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch low stock parts',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

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
          error: 'Part not found',
        });
      }

      throw error;
    }

    return res.json({
      success: true,
      data: {
        ...data,
        available_quantity:
          toNumber(data.quantity) - toNumber(data.reserved_quantity),
      },
      message: 'Part fetched successfully',
    });
  } catch (error: any) {
    console.error('Error fetching part:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch part',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const createPart = async (req: Request, res: Response) => {
  try {
    const { name, specifications, quantity, unit_price, min_stock_alert } =
      req.body;
    const actor = getActor(req);

    const initialQuantity = toNumber(quantity);

    if (!name || unit_price === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, unit_price',
      });
    }

    const { data, error } = await supabase
      .from('parts')
      .insert([
        {
          name,
          specifications: specifications || null,
          quantity: initialQuantity,
          reserved_quantity: 0,
          unit_price: toNumber(unit_price),
          min_stock_alert: min_stock_alert ?? 5,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    if (initialQuantity > 0) {
      const { error: transactionError } = await supabase
        .from('part_transactions')
        .insert({
          part_id: data.id,
          transaction_type: 'stock_in',
          quantity_change: initialQuantity,
          quantity_after: initialQuantity,
          performed_by: actor.performed_by,
          performed_by_name: actor.performed_by_name,
          notes: 'Initial stock',
        });

      if (transactionError) throw transactionError;
    }

    return res.json({
      success: true,
      data,
      message: 'Part created successfully',
    });
  } catch (error: any) {
    console.error('Error creating part:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create part',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const updatePart = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, specifications, unit_price, min_stock_alert } = req.body;

    const { data: existing, error: findError } = await supabase
      .from('parts')
      .select('*')
      .eq('id', id)
      .single();

    if (findError) throw findError;

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Part not found',
      });
    }

    const updates: any = {};

    if (name !== undefined) updates.name = name;
    if (specifications !== undefined) updates.specifications = specifications;
    if (unit_price !== undefined) updates.unit_price = toNumber(unit_price);
    if (min_stock_alert !== undefined) {
      updates.min_stock_alert = toNumber(min_stock_alert);
    }

    const { data, error } = await supabase
      .from('parts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      data,
      message: 'Part updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating part:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update part',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const addPartStock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity, notes } = req.body;
    const actor = getActor(req);

    const quantityToAdd = toNumber(quantity);

    if (!quantityToAdd || quantityToAdd <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be greater than 0',
      });
    }

    const { data: existing, error: findError } = await supabase
      .from('parts')
      .select('*')
      .eq('id', id)
      .single();

    if (findError) throw findError;

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Part not found',
      });
    }

    const currentQuantity = toNumber(existing.quantity);
    const newQuantity = currentQuantity + quantityToAdd;

    const { data, error } = await supabase
      .from('parts')
      .update({ quantity: newQuantity })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const { error: transactionError } = await supabase
      .from('part_transactions')
      .insert({
        part_id: id,
        transaction_type: 'stock_in',
        quantity_change: quantityToAdd,
        quantity_after: newQuantity,
        performed_by: actor.performed_by,
        performed_by_name: actor.performed_by_name,
        notes: notes || 'Stock added',
      });

    if (transactionError) throw transactionError;

    return res.json({
      success: true,
      data,
      message: `Added ${quantityToAdd} units to ${existing.name}. New quantity: ${newQuantity}`,
    });
  } catch (error: any) {
    console.error('Error adding part stock:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to add stock',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const getPartTransactions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: part, error: partError } = await supabase
      .from('parts')
      .select('id, part_number, name, quantity, reserved_quantity, unit_price')
      .eq('id', id)
      .single();

    if (partError) throw partError;

    if (!part) {
      return res.status(404).json({
        success: false,
        error: 'Part not found',
      });
    }

    const { data, error } = await supabase
      .from('part_transactions')
      .select(
        `
        *,
        sales_order:sales_order_id (order_number)
      `
      )
      .eq('part_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      data: {
        part: {
          ...part,
          available_quantity:
            toNumber(part.quantity) - toNumber(part.reserved_quantity),
        },
        transactions: data || [],
      },
      message: 'Part transactions fetched successfully',
    });
  } catch (error: any) {
    console.error('Error fetching part transactions:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch part transactions',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const deletePart = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabase
      .from('parts')
      .select('*')
      .eq('id', id)
      .single();

    if (findError) throw findError;

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Part not found',
      });
    }

    const { data: transactions, error: transactionError } = await supabase
      .from('part_transactions')
      .select('id')
      .eq('part_id', id)
      .limit(1);

    if (transactionError) throw transactionError;

    if (transactions && transactions.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete part with transaction history for audit purposes',
      });
    }

    const { error } = await supabase.from('parts').delete().eq('id', id);

    if (error) throw error;

    return res.json({
      success: true,
      message: 'Part deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting part:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete part',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};