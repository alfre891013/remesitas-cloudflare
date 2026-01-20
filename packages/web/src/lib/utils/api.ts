import { browser } from '$app/environment';
import { auth } from '$stores/auth';
import { get } from 'svelte/store';
import { getApiBaseUrl } from './config';

interface ApiOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getApiBaseUrl();
  }

  private getAuthHeader(): Record<string, string> {
    if (!browser) return {};

    const state = get(auth);
    if (state.accessToken) {
      return { Authorization: `Bearer ${state.accessToken}` };
    }
    return {};
  }

  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(`${this.baseUrl}${endpoint}`, window.location.origin);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  async request<T>(endpoint: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
    const { params, ...fetchOptions } = options;

    const url = this.buildUrl(endpoint, params);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
      ...(fetchOptions.headers as Record<string, string>),
    };

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });

      const data = await response.json();

      // Handle 401 - try refresh
      if (response.status === 401 && browser) {
        const refreshed = await auth.refresh();
        if (refreshed) {
          // Retry request with new token
          return this.request<T>(endpoint, options);
        }
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: 'Network Error',
        message: 'No se pudo conectar con el servidor',
      };
    }
  }

  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // File upload
  async upload<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const headers = this.getAuthHeader();
    // Don't set Content-Type for FormData - browser will set it with boundary

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      return await response.json();
    } catch (error) {
      console.error('Upload Error:', error);
      return {
        success: false,
        error: 'Upload Error',
        message: 'Error al subir el archivo',
      };
    }
  }
}

export const api = new ApiClient();

// Typed API helpers
export const apiHelpers = {
  // Auth
  login: (username: string, password: string) =>
    api.post<{ access_token: string; refresh_token: string; user: any }>('/auth/login', {
      username,
      password,
    }),

  // Dashboard
  getDashboard: () => api.get<any>('/admin/dashboard'),
  getRepartidorDashboard: () => api.get<any>('/repartidor/dashboard'),
  getRevendedorDashboard: () => api.get<any>('/revendedor/dashboard'),

  // Remesas
  getRemesas: (params?: Record<string, any>) => api.get<any>('/remesas', params),
  getRemesa: (id: number) => api.get<any>(`/remesas/${id}`),
  createRemesa: (data: any) => api.post<any>('/remesas', data),
  updateRemesa: (id: number, data: any) => api.put<any>(`/remesas/${id}`, data),
  assignRemesa: (id: number, repartidorId: number) =>
    api.post<any>(`/remesas/${id}/asignar`, { repartidor_id: repartidorId }),
  approveRemesa: (id: number) => api.post<any>(`/remesas/${id}/aprobar`),
  cancelRemesa: (id: number) => api.post<any>(`/remesas/${id}/cancelar`),
  deliverRemesa: (id: number, data: any) =>
    api.post<any>(`/repartidor/remesas/${id}/entregar`, data),
  invoiceRemesa: (id: number) => api.post<any>(`/remesas/${id}/facturar`),
  calculate: (monto: number, tipoEntrega?: string) =>
    api.get<any>('/remesas/api/calcular', { monto, tipo_entrega: tipoEntrega }),
  searchRemitentes: (q: string) => api.get<any>('/remesas/api/buscar-remitentes', { q }),
  searchBeneficiarios: (q: string) => api.get<any>('/remesas/api/buscar-beneficiarios', { q }),

  // Users
  getUsers: (params?: Record<string, any>) => api.get<any>('/admin/usuarios', params),
  getUser: (id: number) => api.get<any>(`/admin/usuarios/${id}`),
  createUser: (data: any) => api.post<any>('/admin/usuarios', data),
  updateUser: (id: number, data: any) => api.put<any>(`/admin/usuarios/${id}`, data),
  deleteUser: (id: number) => api.delete<any>(`/admin/usuarios/${id}`),
  getRepartidores: () => api.get<any>('/admin/repartidores'),
  getRevendedores: () => api.get<any>('/admin/revendedores'),

  // Rates
  getRates: () => api.get<any>('/tasas'),
  getRatesAdmin: () => api.get<any>('/tasas/admin/all'),
  updateRate: (moneda: string, data: any) => api.put<any>(`/tasas/admin/${moneda}`, data),
  fetchExternalRates: () => api.post<any>('/tasas/admin/fetch'),
  previewExternalRates: () => api.get<any>('/tasas/admin/external'),
  getRateHistory: (params?: Record<string, any>) => api.get<any>('/tasas/admin/historial', params),

  // Commissions
  getCommissions: () => api.get<any>('/admin/comisiones'),
  createCommission: (data: any) => api.post<any>('/admin/comisiones', data),
  updateCommission: (id: number, data: any) => api.put<any>(`/admin/comisiones/${id}`, data),
  deleteCommission: (id: number) => api.delete<any>(`/admin/comisiones/${id}`),

  // Cash flow
  getCashMovements: (params?: Record<string, any>) => api.get<any>('/admin/efectivo', params),
  createCashMovement: (data: any) => api.post<any>('/admin/efectivo', data),
  getRepartidorBalance: (id: number) => api.get<any>(`/admin/efectivo/balance/${id}`),

  // Reseller payments
  getResellerPayments: (params?: Record<string, any>) =>
    api.get<any>('/admin/pagos-revendedor', params),
  createResellerPayment: (data: any) => api.post<any>('/admin/pagos-revendedor', data),
  getResellerBalance: (id: number) => api.get<any>(`/admin/pagos-revendedor/balance/${id}`),

  // Solicitudes
  getSolicitudes: (params?: Record<string, any>) => api.get<any>('/admin/solicitudes', params),
  approveSolicitud: (id: number) => api.post<any>(`/admin/solicitudes/${id}/aprobar`),
  rejectSolicitud: (id: number) => api.post<any>(`/admin/solicitudes/${id}/rechazar`),

  // Configuration
  getConfig: () => api.get<any>('/admin/configuracion'),
  updateConfig: (data: any) => api.put<any>('/admin/configuracion', data),

  // Reports
  getReportSummary: (params?: Record<string, any>) => api.get<any>('/reportes/resumen', params),
  getDailyReport: (fecha?: string) =>
    api.get<any>('/reportes/diario', fecha ? { fecha } : undefined),
  getRepartidorReport: (params?: Record<string, any>) =>
    api.get<any>('/reportes/repartidores', params),
  getRevendedorReport: (params?: Record<string, any>) =>
    api.get<any>('/reportes/revendedores', params),
  getBalanceReport: () => api.get<any>('/reportes/balance'),
  getIncomeReport: (params?: Record<string, any>) => api.get<any>('/reportes/ingresos', params),
  getCashReport: (params?: Record<string, any>) => api.get<any>('/reportes/movimientos', params),
  exportReport: (tipo: string, params?: Record<string, any>) =>
    api.get<any>('/reportes/exportar', { tipo, ...params }),

  // Public
  submitRequest: (data: any) => api.post<any>('/publico/solicitar', data),
  trackRemesa: (codigo: string) => api.get<any>(`/publico/rastrear/${codigo}`),
  getPublicRates: () => api.get<any>('/publico/tasas'),
  calculatePublic: (monto: number, tipoEntrega?: string) =>
    api.get<any>('/publico/calcular-entrega', { monto, tipo_entrega: tipoEntrega }),

  // Revendedor
  getRevendedorRemesas: (params?: Record<string, any>) =>
    api.get<any>('/revendedor/remesas', params),
  createRevendedorRemesa: (data: any) => api.post<any>('/revendedor/remesas', data),
  calculateRevendedor: (monto: number, tipoEntrega?: string) =>
    api.get<any>('/revendedor/api/calcular', { monto, tipo_entrega: tipoEntrega }),
  revendedorCalculate: (monto: number, tipoEntrega?: string) =>
    api.get<any>('/revendedor/api/calcular', { monto, tipo_entrega: tipoEntrega }),
  getRevendedorRemitentes: () => api.get<any>('/revendedor/remitentes'),
  getRevendedorBeneficiarios: () => api.get<any>('/revendedor/beneficiarios'),
  getRevendedorPayments: () => api.get<any>('/revendedor/pagos'),
  getRevendedorBalance: () => api.get<any>('/revendedor/balance'),

  // Repartidor
  getRepartidorRemesas: (params?: Record<string, any>) =>
    api.get<any>('/repartidor/remesas', params),
  getRepartidorRemesa: (id: number) => api.get<any>(`/repartidor/remesas/${id}`),
  markDelivered: (id: number, notas?: string) =>
    api.post<any>(`/repartidor/remesas/${id}/entregar`, { notas }),
  uploadDeliveryPhoto: (id: number, formData: FormData) =>
    api.upload<any>(`/repartidor/remesas/${id}/foto`, formData),
  getRepartidorHistory: (params?: Record<string, any>) =>
    api.get<any>('/repartidor/historial', params),
  getRepartidorMovements: (params?: Record<string, any>) =>
    api.get<any>('/repartidor/movimientos', params),
  getRepartidorBalanceSelf: () => api.get<any>('/repartidor/balance'),

  // Push notifications
  subscribePush: (endpoint: string, p256dh: string, auth: string) =>
    api.post<any>('/revendedor/push/subscribe', { endpoint, p256dh, auth }),
};
