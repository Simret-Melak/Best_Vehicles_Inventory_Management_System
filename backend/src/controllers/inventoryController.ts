import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// ============================================
// EXISTING CODE (keep as is)
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

export const createVehicle = async (req: Request, res: Response) => {
  try {
    const { model, chassis_number, specifications, unit_price } = req.body;

    if (!model || !chassis_number || !unit_price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: model, chassis_number, unit_price'
      });
    }

    // Check if chassis number already exists
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

    // Add to vehicle history
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

// ============================================
// NEW FUNCTIONS TO ADD
// ============================================

// Get single vehicle by ID
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

// Update vehicle
export const updateVehicle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { model, chassis_number, specifications, unit_price, status } = req.body;

    // Check if vehicle exists
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

    // If changing chassis number, check it's unique
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

    // Build update object (only include fields that are provided)
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

    // Add to vehicle history if status changed
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

// Delete vehicle (admin only)
export const deleteVehicle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if vehicle exists
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

    // Check if vehicle is sold (should not delete sold vehicles)
    if (existing.status === 'sold') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete sold vehicles for audit purposes'
      });
    }

    // Delete vehicle history first (foreign key constraint)
    await supabase
      .from('vehicle_history')
      .delete()
      .eq('vehicle_id', id);

    // Delete vehicle
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

// Get vehicle history
export const getVehicleHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if vehicle exists
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

    // Get vehicle history
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