import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// ============================================
// GET ALL PARTS
// ============================================
export const getParts = async (req: Request, res: Response) => {
  try {
    const { search, category } = req.query;
    
    let query = supabase.from('parts').select('*');
    
    // Apply search filter if provided
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    
    // Apply category filter if provided
    if (category) {
      query = query.eq('category', category);
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

// ============================================
// GET LOW STOCK PARTS (FIXED - No .raw())
// ============================================
export const getLowStockParts = async (req: Request, res: Response) => {
  try {
    // Get all parts
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .order('quantity', { ascending: true });
    
    if (error) throw error;

    // Filter in JavaScript: quantity < min_stock_alert
    const lowStockParts = data?.filter(part => part.quantity < part.min_stock_alert) || [];

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

// ============================================
// GET SINGLE PART BY ID
// ============================================
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

// ============================================
// CREATE NEW PART
// ============================================
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

// ============================================
// UPDATE PART
// ============================================
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

// ============================================
// ADD PART STOCK (INCREASE QUANTITY)
// ============================================
export const addPartStock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity, notes } = req.body;

    // Validation
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be greater than 0'
      });
    }

    // Check if part exists
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

    // Calculate new quantity
    const newQuantity = existing.quantity + quantity;

    // Update part quantity
    const { data, error } = await supabase
      .from('parts')
      .update({ quantity: newQuantity })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Add to part transactions history
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
      message: `Added ${quantity} units. New quantity: ${newQuantity}`
    });
  } catch (error) {
    console.error('Error adding part stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add stock'
    });
  }
};

// ============================================
// GET PART TRANSACTIONS HISTORY
// ============================================
export const getPartTransactions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if part exists
    const { data: part, error: partError } = await supabase
      .from('parts')
      .select('id, name, quantity, unit_price')
      .eq('id', id)
      .single();

    if (!part) {
      return res.status(404).json({
        success: false,
        error: 'Part not found'
      });
    }

    // Get transactions
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

// ============================================
// DELETE PART (Admin only)
// ============================================
export const deletePart = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if part exists
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

    // Check if part has any transactions (don't delete if it has history)
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

    // Delete part
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