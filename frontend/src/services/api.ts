import axios from 'axios';

// For iOS Simulator: http://localhost:3000
// For Android Emulator: http://10.0.2.2:3000
// For Physical Device: http://YOUR_IP_ADDRESS:3000
const API_BASE_URL = 'http://192.168.8.63:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// ============================================
// INVENTORY API
// ============================================
export const inventoryApi = {
  // Vehicles
  getVehicles: () => api.get('/inventory/vehicles'),
  getVehicleById: (id: string) => api.get(`/inventory/vehicles/${id}`),
  createVehicle: (data: any) => api.post('/inventory/vehicles', data),
  updateVehicle: (id: string, data: any) => api.put(`/inventory/vehicles/${id}`, data),
  deleteVehicle: (id: string) => api.delete(`/inventory/vehicles/${id}`),
  getVehicleHistory: (id: string) => api.get(`/inventory/vehicles/${id}/history`),
  
  // Parts
  getParts: () => api.get('/inventory/parts'),
  getPartById: (id: string) => api.get(`/inventory/parts/${id}`),
  createPart: (data: any) => api.post('/inventory/parts', data),
  updatePart: (id: string, data: any) => api.put(`/inventory/parts/${id}`, data),
  deletePart: (id: string) => api.delete(`/inventory/parts/${id}`),
  addPartStock: (id: string, quantity: number, notes?: string) => 
    api.post(`/inventory/parts/${id}/add-stock`, { quantity, notes }),
  getPartTransactions: (id: string) => api.get(`/inventory/parts/${id}/transactions`),
  getLowStockParts: () => api.get('/inventory/parts/low-stock'),
};

// ============================================
// CUSTOMER API
// ============================================
export const customerApi = {
  getCustomers: (params?: { search?: string; limit?: number; offset?: number }) => 
    api.get('/customers', { params }),
  getCustomerById: (id: string) => api.get(`/customers/${id}`),
  createCustomer: (data: any) => api.post('/customers', data),
  updateCustomer: (id: string, data: any) => api.put(`/customers/${id}`, data),
  deleteCustomer: (id: string) => api.delete(`/customers/${id}`),
  getCustomerOrders: (id: string) => api.get(`/customers/${id}/orders`),
  searchCustomers: (q: string) => api.get('/customers/search', { params: { q } }),
};

// ============================================
// SALES ORDER API
// ============================================
export const salesApi = {
  getSalesOrders: (params?: { status?: string; customer_id?: string }) => 
    api.get('/sales', { params }),
  getSalesOrderById: (id: string) => api.get(`/sales/${id}`),
  createSalesOrder: (data: any) => api.post('/sales', data),
  updateOrderStatus: (id: string, status: string) => 
    api.put(`/sales/${id}/status`, { status }),
  cancelOrder: (id: string) => api.put(`/sales/${id}/cancel`),
  deleteOrder: (id: string) => api.delete(`/sales/${id}`),
};

// ============================================
// PAYMENT API
// ============================================
export const paymentApi = {
  recordDeposit: (data: any) => api.post('/payments', data),
  getPendingDeposits: () => api.get('/payments/pending'),
  confirmDeposit: (id: string, confirmed_by?: string) => 
    api.put(`/payments/${id}/confirm`, { confirmed_by }),
  rejectDeposit: (id: string, notes?: string) => 
    api.put(`/payments/${id}/reject`, { notes }),
  getOrderPaymentHistory: (orderId: string) => api.get(`/payments/order/${orderId}`),
};

export default api;