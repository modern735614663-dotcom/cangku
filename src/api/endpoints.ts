// API 端点封装 — 所有后端接口调用

import { api, setToken, clearToken, getToken } from './client';

// ====== 认证 ======
export async function login(username: string, password: string) {
  const res = await api.post<{ token: string; user: any }>('/auth/login', { username, password });
  if (res.data?.token) setToken(res.data.token);
  return res;
}

export async function register(username: string, password: string) {
  const res = await api.post<{ token: string; user: any }>('/auth/register', { username, password });
  if (res.data?.token) setToken(res.data.token);
  return res;
}

export async function getMe() {
  return api.get<{ user: any }>('/auth/me');
}

export function logout() {
  clearToken();
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// ====== 货品 ======
export async function fetchProducts() {
  return api.get<any[]>('/products');
}

export async function createProduct(data: any) {
  return api.post<any>('/products', data);
}

export async function updateProduct(id: number, data: any) {
  return api.put<any>(`/products/${id}`, data);
}

export async function deleteProduct(id: number) {
  return api.delete(`/products/${id}`);
}

// ====== 库存 ======
export async function fetchInventory() {
  return api.get<any[]>('/inventory');
}

export async function updateInventory(productId: number, warehouseId: string, quantity: number) {
  return api.post('/inventory/update', { product_id: productId, warehouse_id: warehouseId, quantity });
}

// ====== 入库 ======
export async function submitInbound(data: { source: string; warehouse_id: string; items: any[] }) {
  return api.post<any>('/inbound', data);
}

// ====== 出库 ======
export async function submitOutbound(data: { reason: string; warehouse_id: string; items: any[] }) {
  return api.post<any>('/outbound', data);
}

// ====== 转仓 ======
export async function submitTransfer(data: { from_warehouse: string; to_warehouse: string; product_id: number; quantity: number }) {
  return api.post<any>('/transfer', data);
}

// ====== 待审核 ======
export async function fetchPending() {
  return api.get<any[]>('/pending');
}

export async function approvePending(id: number) {
  return api.post(`/pending/${id}/approve`);
}

export async function rejectPending(id: number) {
  return api.post(`/pending/${id}/reject`);
}

// ====== 操作日志 ======
export async function fetchLogs() {
  return api.get<any[]>('/logs');
}

export async function revokeOperation(logId: number) {
  return api.post(`/logs/${logId}/revoke`);
}

// ====== 统计 ======
export async function fetchStats(warehouseId?: string) {
  const query = warehouseId ? `?warehouse_id=${warehouseId}` : '';
  return api.get<any>(`/stats${query}`);
}
