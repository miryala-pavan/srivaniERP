export interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  businessId: string;
  email?: string;
  phone?: string;
}

export interface Business {
  id: string;
  name: string;
  gstin?: string;
  stateCode: string;
  stateName: string;
  address?: string;
  phone?: string;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface DashboardData {
  generatedAt: string;
  sales: {
    todaySales: number;
    yesterdaySales: number;
    salesGrowth: number | null;
    todayBills: number;
    yesterdayBills: number;
  };
  thisMonth: {
    revenue: number;
    bills: number;
  };
  avgBasket: {
    today: number;
    yesterday: number;
    growth: number | null;
  };
  paymentBreakdown: {
    cash: number;
    upi: number;
    card: number;
  };
  onlineOrders: {
    pendingCount: number;
    todayCount: number;
    todayRevenue: number;
  };
  alerts: {
    cashMismatch: number;
    lowStockCount: number;
    pendingGRNs: number;
    pendingPayments: number;
  };
  topSellingProducts: {
    productId: string;
    productName: string;
    barcode: string | null;
    totalQty: number;
    totalRevenue: number;
  }[];
  onlineOrdersPending: number;
}
