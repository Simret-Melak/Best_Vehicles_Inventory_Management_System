import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const getVehicles = async (req: Request, res: Response) => {
  try {
    // Get query parameters
    const { status, model } = req.query;
    
    // Start building the query
    let query = supabase.from('vehicles').select('*');
    
    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    // Apply model filter if provided
    if (model) {
      query = query.ilike('model', `%${model}%`);
    }
    
    // Execute query
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

    // Validation
    if (!model || !chassis_number || !unit_price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: model, chassis_number, unit_price'
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
          status: 'available'  // Default status for new vehicles
        }
      ])
      .select()
      .single();

    if (error) throw error;

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