import { create } from 'zustand';
import type { Product, Inventory, OperationLog, TransferDoc, PendingDoc, User, WarehouseId } from '../types';
import * as api from '../api/endpoints';
import { getToken, clearToken } from '../api/client';

// ====== 后端数据 → 前端类型转换 ======
function toProduct(p: any): Product {
  return { ...p, id: String(p.id), createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now() };
}
function toInventory(i: any): Inventory {
  return { ...i, productId: String(i.product_id || i.productId), warehouseId: i.warehouse_id || i.warehouseId };
}
function toLog(l: any): OperationLog {
  return {
    ...l, id: String(l.id), documentId: String(l.doc_id || l.id),
    operator: l.operator, type: l.type, summary: l.summary,
    timestamp: l.created_at ? new Date(l.created_at).getTime() : Date.now(),
    revoked: !!l.revoked, revokeInfo: typeof l.revoke_info === 'string' ? JSON.parse(l.revoke_info || 'null') : l.revoke_info,
    detail: typeof l.detail === 'string' ? JSON.parse(l.detail || '{}') : (l.detail || {}),
    items: typeof l.items === 'string' ? JSON.parse(l.items || '[]') : (l.items || []),
  };
}
function toPending(p: any): PendingDoc {
  return {
    ...p, id: String(p.id), warehouseId: p.warehouse_id,
    items: typeof p.items === 'string' ? JSON.parse(p.items) : p.items,
    createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
    reviewedAt: p.reviewed_at ? new Date(p.reviewed_at).getTime() : undefined,
    reviewedBy: p.reviewed_by,
  };
}
interface WarehouseState {
  products: Product[];
  inventories: Inventory[];
  operationLogs: OperationLog[];
  inboundDocs: any[];
  outboundDocs: any[];
  transferDocs: any[];
  pendingDocs: PendingDoc[];
  users: User[];
  currentUser: User | null;
  hydrated: boolean;

  // Auth
  login: (u: string, p: string) => Promise<User | null>;
  register: (u: string, p: string) => Promise<User | null>;
  logout: () => void;
  isAdmin: () => boolean;

  // Data loading
  loadFromServer: () => Promise<void>;

  // Product
  addProduct: (data: any) => Promise<Product>;
  getProduct: (id: string) => Product | undefined;

  // Inventory
  getInventory: (pid: string, wid: WarehouseId) => Inventory | undefined;
  addInventory: (pid: string, wid: WarehouseId, qty: number) => void;
  subInventory: (pid: string, wid: WarehouseId, qty: number) => boolean;

  // High-level
  submitInbound: (data: { source: string; warehouseId: WarehouseId; items: any[] }) => Promise<string | null>;
  submitOutbound: (data: { reason: string; warehouseId: WarehouseId; items: { productId: string; quantity: number }[] }) => Promise<string | null>;

  // Pending
  addPending: (doc: any) => Promise<PendingDoc | null>;
  approvePending: (id: string) => Promise<boolean>;
  rejectPending: (id: string) => Promise<void>;

  // Logs
  addLog: (log: any) => void;
  revokeOperation: (logId: string) => Promise<boolean>;

  // Transfer
  createTransfer: (params: { fromWarehouse: WarehouseId; toWarehouse: WarehouseId; productId: string; quantity: number }) => Promise<TransferDoc | null>;

  // Utility
  save: () => void;
  clearAll: () => void;
  refresh: () => Promise<void>;
}

export const useStore = create<WarehouseState>()((set, get) => ({
  products: [], inventories: [], operationLogs: [], inboundDocs: [],
  outboundDocs: [], transferDocs: [], pendingDocs: [],
  users: [], currentUser: null, hydrated: false,

  // ====== 认证 ======
  login: async (username, password) => {
    const res = await api.login(username, password);
    if (res.error) return null;
    const u = res.data!.user;
    const user: User = { id: String(u.id), username: u.username, password: '', role: u.role, createdAt: Date.now() };
    set({ currentUser: user });
    return user;
  },

  register: async (username, password) => {
    const res = await api.register(username, password);
    if (res.error) return null;
    const u = res.data!.user;
    const user: User = { id: String(u.id), username: u.username, password: '', role: u.role, createdAt: Date.now() };
    set({ currentUser: user });
    return user;
  },

  logout: () => {
    api.logout();
    set({ currentUser: null });
  },

  isAdmin: () => get().currentUser?.role === 'admin',

  // ====== 数据加载 ======
  loadFromServer: async () => {
    if (!getToken()) {
      set({ hydrated: true });
      return;
    }
    // 验证 token 有效性
    const meRes = await api.getMe();
    if (meRes.error) {
      clearToken();
      set({ hydrated: true });
      return;
    }
    const u = meRes.data!.user;
    const user: User = { id: String(u.id), username: u.username, password: '', role: u.role, createdAt: Date.now() };
    set({ currentUser: user });

    // 并行加载所有数据
    const [prodRes, invRes, logRes, pendRes] = await Promise.all([
      api.fetchProducts(), api.fetchInventory(), api.fetchLogs(), api.fetchPending(),
    ]);

    const products = prodRes.data?.map(toProduct) || [];
    const inventories = invRes.data?.map(toInventory) || [];
    const operationLogs = logRes.data?.map(toLog) || [];
    const pendingDocs = pendRes.data?.map(toPending) || [];

    set({ products, inventories, operationLogs, pendingDocs, hydrated: true });
  },

  refresh: async () => {
    const [prodRes, invRes, logRes, pendRes] = await Promise.all([
      api.fetchProducts(), api.fetchInventory(), api.fetchLogs(), api.fetchPending(),
    ]);
    const products = prodRes.data?.map(toProduct) || [];
    const inventories = invRes.data?.map(toInventory) || [];
    const operationLogs = logRes.data?.map(toLog) || [];
    const pendingDocs = pendRes.data?.map(toPending) || [];
    set({ products, inventories, operationLogs, pendingDocs });
  },

  // ====== 货品 ======
  addProduct: async (data) => {
    const res = await api.createProduct(data);
    if (res.error) throw new Error(res.error);
    const product = toProduct(res.data);
    set(s => ({ products: [...s.products, product] }));
    return product;
  },

  getProduct: (id) => get().products.find(p => p.id === id),

  // ====== 库存（本地缓存，操作后刷新） ======
  getInventory: (pid, wid) => get().inventories.find(i => i.productId === pid && i.warehouseId === wid),
  addInventory: () => {}, // 由后端处理，前端只刷新
  subInventory: () => true, // 同上

  // ====== 上层操作 ======
  submitInbound: async (data: { source: string; warehouseId: WarehouseId; items: any[] }) => {
    const res = await api.submitInbound({
      source: data.source, warehouse_id: data.warehouseId,
      items: data.items.map(i => ({
        productId: i.productId, quantity: i.quantity, price: i.price,
        isNewProduct: i.isNewProduct, newProductData: i.newProductData,
      })),
    });
    if (res.error) return res.error;
    await get().refresh();
    return null;
  },
  submitOutbound: async (data: { reason: string; warehouseId: WarehouseId; items: { productId: string; quantity: number }[] }) => {
    const res = await api.submitOutbound({
      reason: data.reason, warehouse_id: data.warehouseId,
      items: data.items.map(i => ({ productId: Number(i.productId), quantity: i.quantity })),
    });
    if (res.error) return res.error;
    await get().refresh();
    return null;
  },

  // ====== 待审核 ======
  addPending: async () => {
    await get().refresh();
    return null;
  },

  approvePending: async (id) => {
    const res = await api.approvePending(Number(id));
    if (res.error) return false;
    await get().refresh();
    return true;
  },

  rejectPending: async (id) => {
    await api.rejectPending(Number(id));
    await get().refresh();
  },

  // ====== 日志 ======
  addLog: () => {}, // 由后端生成

  revokeOperation: async (logId) => {
    if (!get().isAdmin()) return false;
    const res = await api.revokeOperation(Number(logId));
    if (res.error) return false;
    await get().refresh();
    return true;
  },

  // ====== 转仓 ======
  createTransfer: async ({ fromWarehouse, toWarehouse, productId, quantity }) => {
    const res = await api.submitTransfer({
      from_warehouse: fromWarehouse, to_warehouse: toWarehouse,
      product_id: Number(productId), quantity,
    });
    if (res.error) return null;
    await get().refresh();
    return { id: String(res.data?.docId || ''), fromWarehouse, toWarehouse, productId, quantity, operator: get().currentUser?.username || '', timestamp: Date.now() };
  },

  // ====== 工具 ======
  save: () => {}, // 后端自动保存
  clearAll: () => { api.logout(); set({ currentUser: null, hydrated: false }); },
}));
