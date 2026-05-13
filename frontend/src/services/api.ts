import axios from 'axios';

// For iOS Simulator: http://localhost:3000
// For Android Emulator: http://10.0.2.2:3000
// For Physical Device: http://YOUR_IP_ADDRESS:3000
const API_BASE_URL = 'http://192.168.1.111:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  return config;
});

// ============================================
// AUTH API
// ============================================
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  getMe: () => api.get('/auth/me'),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  updatePassword: (
    current_password: string,
    new_password: string,
    confirm_password: string
  ) =>
    api.put('/auth/me/password', {
      current_password,
      new_password,
      confirm_password,
    }),

  createUser: (data: {
    full_name: string;
    email: string;
    password: string;
    role: 'super_admin' | 'admin' | 'worker' | 'store_manager';
  }) => api.post('/auth/users', data),

  getUsers: () => api.get('/auth/users'),

  updateUserStatus: (id: string, is_active: boolean) =>
    api.put(`/auth/users/${id}/status`, { is_active }),

  updateUserRole: (
    id: string,
    role: 'super_admin' | 'admin' | 'worker' | 'store_manager'
  ) => api.put(`/auth/users/${id}/role`, { role }),

  resetUserPassword: (id: string, password: string) =>
    api.put(`/auth/users/${id}/password`, { password }),

  deleteUser: (id: string) => api.delete(`/auth/users/${id}`),
};

// ============================================
// INVENTORY API
// ============================================
export const inventoryApi = {
  // Vehicles
  getVehicles: () => api.get('/inventory/vehicles'),

  getAvailableVehicles: () => api.get('/inventory/vehicles/available'),

  getVehicleById: (id: string) => api.get(`/inventory/vehicles/${id}`),

  createVehicle: (data: any) => api.post('/inventory/vehicles', data),

  updateVehicle: (id: string, data: any) =>
    api.put(`/inventory/vehicles/${id}`, data),

  deleteVehicle: (id: string) => api.delete(`/inventory/vehicles/${id}`),

  getVehicleHistory: (id: string) =>
    api.get(`/inventory/vehicles/${id}/history`),

  // Parts
  getParts: () => api.get('/inventory/parts'),

  getAvailableParts: () => api.get('/inventory/parts/available'),

  getPartById: (id: string) => api.get(`/inventory/parts/${id}`),

  createPart: (data: any) => api.post('/inventory/parts', data),

  updatePart: (id: string, data: any) =>
    api.put(`/inventory/parts/${id}`, data),

  deletePart: (id: string) => api.delete(`/inventory/parts/${id}`),

  addPartStock: (
    id: string,
    quantity: number,
    notes?: string,
    performed_by?: string,
    performed_by_name?: string
  ) =>
    api.post(`/inventory/parts/${id}/add-stock`, {
      quantity,
      notes,
      performed_by,
      performed_by_name,
    }),

  getPartTransactions: (id: string) =>
    api.get(`/inventory/parts/${id}/transactions`),

  getLowStockParts: () => api.get('/inventory/parts/low-stock'),
};

// ============================================
// CUSTOMER API
// ============================================
export const customerApi = {
  getCustomers: (search = '', limit = 100, offset = 0) =>
    api.get('/customers', {
      params: {
        search: search.trim() || undefined,
        limit,
        offset,
      },
    }),

  getCustomerById: (id: string) => api.get(`/customers/${id}`),

  createCustomer: (data: any) => api.post('/customers', data),

  updateCustomer: (id: string, data: any) =>
    api.put(`/customers/${id}`, data),

  deleteCustomer: (id: string) => api.delete(`/customers/${id}`),

  getCustomerOrders: (id: string) => api.get(`/customers/${id}/orders`),

  searchCustomers: (q: string) =>
    api.get('/customers', {
      params: {
        search: q.trim() || undefined,
        limit: 100,
        offset: 0,
      },
    }),
};

// ============================================
// SALES ORDER API
// ============================================
export const salesApi = {
  getSalesOrders: (params?: { status?: string; customer_id?: string }) =>
    api.get('/sales', { params }),

  getSalesOrderById: (id: string) => api.get(`/sales/${id}`),

  createSalesOrder: (data: any) => api.post('/sales', data),

  updateSaleRequest: (id: string, data: any) =>
    api.put(`/sales/${id}/request`, data),

  updateOrderStatus: (
    id: string,
    status: string,
    confirmed_by?: string,
    confirmed_by_name?: string,
    performed_by?: string,
    performed_by_name?: string
  ) =>
    api.put(`/sales/${id}/status`, {
      status,
      confirmed_by,
      confirmed_by_name,
      performed_by,
      performed_by_name,
    }),

  workerConfirmFullPayment: (
    id: string,
    performed_by?: string,
    performed_by_name?: string
  ) =>
    api.put(`/sales/${id}/confirm-full-payment`, {
      performed_by,
      performed_by_name,
    }),

  cancelOrder: (
    id: string,
    performed_by?: string,
    performed_by_name?: string
  ) =>
    api.put(`/sales/${id}/cancel`, {
      performed_by,
      performed_by_name,
    }),

  deleteOrder: (id: string) => api.delete(`/sales/${id}`),
};

// ============================================
// PAYMENT API
// ============================================
export const paymentApi = {
  recordDeposit: (data: any) => api.post('/payments', data),

  getPendingDeposits: () => api.get('/payments/pending'),

  confirmDeposit: (
    id: string,
    confirmed_by?: string,
    confirmed_by_name?: string
  ) =>
    api.put(`/payments/${id}/confirm`, {
      confirmed_by,
      confirmed_by_name,
    }),

  rejectDeposit: (
    id: string,
    notes?: string,
    rejected_by?: string,
    rejected_by_name?: string
  ) =>
    api.put(`/payments/${id}/reject`, {
      notes,
      rejected_by,
      rejected_by_name,
    }),

  getOrderPaymentHistory: (orderId: string) =>
    api.get(`/payments/order/${orderId}`),

  cancelOrderAndReleaseReservations: (
    orderId: string,
    performed_by?: string,
    performed_by_name?: string
  ) =>
    api.put(`/payments/cancel-order/${orderId}`, {
      performed_by,
      performed_by_name,
    }),
};

export default api;