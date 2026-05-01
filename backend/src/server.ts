import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import inventoryRoutes from './routes/inventoryRoutes';

import customerRoutes from './routes/customerRoutes';
import salesRoutes from './routes/salesRoutes';
import paymentRoutes from './routes/paymentRoutes';  // NEW

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/payments', paymentRoutes);  // NEW

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Beast Vehicles API is running',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// 404 handler
app.all('*', (req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Vehicles API: http://localhost:${PORT}/api/inventory/vehicles`);
  console.log(`🔧 Parts API: http://localhost:${PORT}/api/inventory/parts`);
  console.log(`👥 Customers API: http://localhost:${PORT}/api/customers`);
  console.log(`📦 Sales Orders API: http://localhost:${PORT}/api/sales`);
  console.log(`💰 Payments API: http://localhost:${PORT}/api/payments`);  // NEW
});