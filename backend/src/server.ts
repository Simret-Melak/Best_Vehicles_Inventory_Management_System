import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';

import authRoutes from './routes/authRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import customerRoutes from './routes/customerRoutes';
import salesRoutes from './routes/salesRoutes';
import paymentRoutes from './routes/paymentRoutes';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Beast Vehicles API is running',
    endpoints: {
      health: '/health',
      test: '/api/test',
      auth: '/api/auth',
      inventory: '/api/inventory',
      customers: '/api/customers',
      sales: '/api/sales',
      payments: '/api/payments',
    },
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Beast Vehicles API is running',
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/payments', paymentRoutes);

// 404 handler
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: /health`);
  console.log(`🧪 Test API: /api/test`);
  console.log(`🔐 Auth API: /api/auth`);
  console.log(`🔧 Vehicles API: /api/inventory/vehicles`);
  console.log(`🔧 Parts API: /api/inventory/parts`);
  console.log(`👥 Customers API: /api/customers`);
  console.log(`📦 Sales Orders API: /api/sales`);
  console.log(`💰 Payments API: /api/payments`);
});