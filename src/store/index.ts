import { create } from 'zustand';
import type {
  Product, Inventory, OperationLog, InboundDoc, OutboundDoc, TransferDoc, PendingDoc,
  User, WarehouseId, AppData,
} from '../types';
import { generateId } from '../utils/id';
import { WAREHOUSE_LABELS } from '../types';

const STORAGE_KEY = 'warehouse-app-data';

function loadFromLocalStorage(): Partial<AppData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function persist(s: WarehouseState): void {
  try {
    const data: AppData = {
      products: s.products,
      inventories: s.inventories,
      operationLogs: s.operationLogs,
      inboundDocs: s.inboundDocs,
      outboundDocs: s.outboundDocs,
      transferDocs: s.transferDocs,
      pendingDocs: s.pendingDocs,
      users: s.users,
      currentUser: s.currentUser,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) { console.error('保存失败:', e); }
}

const DEFAULT_ADMIN: User = {
  id: 'admin-001', username: 'admin', password: 'admin123',
  role: 'admin', createdAt: Date.now(),
};

interface WarehouseState extends AppData {
  hydrated: boolean;
  login: (username: string, password: string) => User | null;
  register: (username: string, password: string) => User | null;
  logout: () => void;
  isAdmin: () => boolean;
  loadFromStorage: () => void;
  save: () => void;
  addProduct: (p: Omit<Product, 'id' | 'createdAt'>) => Product;
  getProduct: (id: string) => Product | undefined;
  getInventory: (pid: string, wid: WarehouseId) => Inventory | undefined;
  addInventory: (pid: string, wid: WarehouseId, qty: number) => void;
  subInventory: (pid: string, wid: WarehouseId, qty: number) => boolean;
  addPending: (doc: Omit<PendingDoc, 'id' | 'status' | 'createdAt'>) => PendingDoc;
  approvePending: (id: string, reviewer: string) => boolean;
  rejectPending: (id: string, reviewer: string) => void;
  addLog: (log: Omit<OperationLog, 'id' | 'timestamp' | 'revoked' | 'revokeInfo'>) => void;
  revokeOperation: (logId: string) => boolean;
  createTransfer: (params: {
    fromWarehouse: WarehouseId; toWarehouse: WarehouseId;
    productId: string; quantity: number;
  }) => TransferDoc | null;
  clearAll: () => void;
}

const emptyState: AppData & { hydrated: boolean } = {
  products: [], inventories: [], operationLogs: [], inboundDocs: [],
  outboundDocs: [], transferDocs: [], pendingDocs: [],
  users: [DEFAULT_ADMIN], currentUser: null, hydrated: false,
};

export const useStore = create<WarehouseState>()((set, get) => ({
  ...emptyState,

  login: (username, password) => {
    const user = get().users.find((u) => u.username === username && u.password === password);
    if (user) { set({ currentUser: user }); get().save(); return user; }
    return null;
  },

  register: (username, password) => {
    if (get().users.find((u) => u.username === username)) return null;
    const user: User = { id: generateId(), username, password, role: 'user', createdAt: Date.now() };
    set({ users: [...get().users, user], currentUser: user });
    get().save();
    return user;
  },

  logout: () => { set({ currentUser: null }); get().save(); },

  isAdmin: () => get().currentUser?.role === 'admin',

  loadFromStorage: () => {
    const data = loadFromLocalStorage();
    set({
      products: data.products ?? [],
      inventories: data.inventories ?? [],
      operationLogs: data.operationLogs ?? [],
      inboundDocs: data.inboundDocs ?? [],
      outboundDocs: data.outboundDocs ?? [],
      transferDocs: data.transferDocs ?? [],
      pendingDocs: data.pendingDocs ?? [],
      users: data.users?.length ? data.users : [DEFAULT_ADMIN],
      currentUser: data.currentUser ?? null,
      hydrated: true,
    });
  },

  save: () => persist(get()),

  addProduct: (data) => {
    const product: Product = { ...data, id: generateId(), createdAt: Date.now() };
    set((s) => ({ products: [...s.products, product] }));
    setTimeout(() => get().save(), 0);
    return product;
  },

  getProduct: (id) => get().products.find((p) => p.id === id),

  getInventory: (pid, wid) =>
    get().inventories.find((i) => i.productId === pid && i.warehouseId === wid),

  addInventory: (pid, wid, qty) => {
    set((s) => {
      const ex = s.inventories.find((i) => i.productId === pid && i.warehouseId === wid);
      if (ex) {
        return { inventories: s.inventories.map((i) =>
          i.productId === pid && i.warehouseId === wid ? { ...i, quantity: i.quantity + qty } : i) };
      }
      return { inventories: [...s.inventories, { warehouseId: wid, productId: pid, quantity: qty }] };
    });
  },

  subInventory: (pid, wid, qty) => {
    const inv = get().getInventory(pid, wid);
    if (!inv || inv.quantity < qty) return false;
    set((s) => ({
      inventories: s.inventories.map((i) =>
        i.productId === pid && i.warehouseId === wid ? { ...i, quantity: i.quantity - qty } : i),
    }));
    return true;
  },

  addPending: (doc) => {
    const pending: PendingDoc = { ...doc, id: generateId(), status: 'pending', createdAt: Date.now() };
    set((s) => ({ pendingDocs: [...s.pendingDocs, pending] }));
    setTimeout(() => get().save(), 0);
    return pending;
  },

  approvePending: (id, reviewer) => {
    if (!get().isAdmin()) return false;
    const pending = get().pendingDocs.find((p) => p.id === id);
    if (!pending || pending.status !== 'pending') return false;
    const now = Date.now();

    // 深拷贝 items，避免直接修改 Zustand state
    const items = pending.items.map((item) => ({ ...item }));

    if (pending.type === 'inbound') {
      // 处理全新款（不变更原 state 中的 items）
      for (const item of items) {
        if (item.isNewProduct && item.newProductData) {
          const prod = get().addProduct(item.newProductData);
          item.productId = prod.id;
          item.isNewProduct = false;
        }
        get().addInventory(item.productId, pending.warehouseId, item.quantity);
      }
      const totalQty = items.reduce((s, i) => s + i.quantity, 0);

      // 写入入库单（撤销功能需要）
      const docId = generateId();
      const doc: InboundDoc = {
        id: docId, source: pending.source || '未知', warehouseId: pending.warehouseId,
        items, operator: pending.username, timestamp: now,
      };
      set((s) => ({ inboundDocs: [...s.inboundDocs, doc] }));

      // 构建日志明细
      const logItems = items.map((item) => {
        const p = get().getProduct(item.productId);
        return { sku: p?.sku || '未知', color: p?.color || '', size: p?.size || '',
                 quantity: item.quantity, price: item.price || p?.price || 0 };
      });
      get().addLog({
        operator: pending.username, type: 'inbound', documentId: docId,
        summary: `入库 ${totalQty} 件（${pending.source}）`,
        items: logItems,
        detail: { warehouse: WAREHOUSE_LABELS[pending.warehouseId], quantity: totalQty, sourceOrReason: pending.source },
      });
    } else {
      // 出库：先校验所有库存充足
      for (const item of items) {
        const inv = get().getInventory(item.productId, pending.warehouseId);
        if (!inv || inv.quantity < item.quantity) return false;
      }
      // 全部通过后再扣减
      for (const item of items) {
        get().subInventory(item.productId, pending.warehouseId, item.quantity);
      }
      const totalQty = items.reduce((s, i) => s + i.quantity, 0);

      // 写入出库单（撤销功能需要）
      const docId = generateId();
      const doc: OutboundDoc = {
        id: docId, reason: pending.reason || '未知', warehouseId: pending.warehouseId,
        items, operator: pending.username, timestamp: now,
      };
      set((s) => ({ outboundDocs: [...s.outboundDocs, doc] }));

      // 构建日志明细
      const logItems = items.map((item) => {
        const p = get().getProduct(item.productId);
        return { sku: p?.sku || '未知', color: p?.color || '', size: p?.size || '',
                 quantity: item.quantity, price: p?.price || 0 };
      });
      get().addLog({
        operator: pending.username, type: 'outbound', documentId: docId,
        summary: `出库 ${totalQty} 件（${pending.reason}）`,
        items: logItems,
        detail: { warehouse: WAREHOUSE_LABELS[pending.warehouseId], quantity: totalQty, sourceOrReason: pending.reason },
      });
    }

    set((s) => ({
      pendingDocs: s.pendingDocs.map((p) =>
        p.id === id ? { ...p, status: 'approved', reviewedAt: now, reviewedBy: reviewer } : p),
    }));
    setTimeout(() => get().save(), 0);
    return true;
  },

  rejectPending: (id, reviewer) => {
    if (!get().isAdmin()) return;
    const pending = get().pendingDocs.find((p) => p.id === id);
    if (!pending || pending.status !== 'pending') return;
    set((s) => ({
      pendingDocs: s.pendingDocs.map((p) =>
        p.id === id ? { ...p, status: 'rejected', reviewedAt: Date.now(), reviewedBy: reviewer } : p),
    }));
    setTimeout(() => get().save(), 0);
  },

  addLog: (log) => {
    const entry: OperationLog = { ...log, id: generateId(), timestamp: Date.now() };
    set((s) => ({ operationLogs: [entry, ...s.operationLogs] }));
  },

  revokeOperation: (logId) => {
    if (!get().isAdmin()) return false;
    const log = get().operationLogs.find((l) => l.id === logId);
    if (!log || log.revoked) return false;

    const user = get().currentUser;
    const username = user?.username || '管理员';
    const now = Date.now();

    if (log.type === 'inbound') {
      const doc = get().inboundDocs.find((d) => d.id === log.documentId);
      if (!doc) return false;
      for (const item of doc.items) {
        get().addInventory(item.productId, doc.warehouseId, -(item.quantity || 0));
      }
    } else if (log.type === 'outbound') {
      const doc = get().outboundDocs.find((d) => d.id === log.documentId);
      if (!doc) return false;
      for (const item of doc.items) {
        get().addInventory(item.productId, doc.warehouseId, item.quantity);
      }
    } else if (log.type === 'transfer') {
      const doc = get().transferDocs.find((d) => d.id === log.documentId);
      if (!doc) return false;
      // 先校验目标仓库存是否充足
      const inv = get().getInventory(doc.productId, doc.toWarehouse);
      if (!inv || inv.quantity < doc.quantity) return false;
      // 执行回退
      get().subInventory(doc.productId, doc.toWarehouse, doc.quantity);
      get().addInventory(doc.productId, doc.fromWarehouse, doc.quantity);
    }

    set((s) => ({
      operationLogs: s.operationLogs.map((l) =>
        l.id === logId ? { ...l, revoked: true, revokeInfo: { operator: username, timestamp: now } } : l
      ),
    }));

    get().addLog({
      operator: username, type: log.type, documentId: log.documentId,
      summary: `撤销了 ${log.operator} 的${log.summary}`,
      items: log.items,
      detail: { ...log.detail },
    });

    setTimeout(() => get().save(), 0);
    return true;
  },

  createTransfer: ({ fromWarehouse, toWarehouse, productId, quantity }) => {
    const product = get().getProduct(productId);
    if (!product) return null;
    if (!get().subInventory(productId, fromWarehouse, quantity)) return null;
    get().addInventory(productId, toWarehouse, quantity);

    const user = get().currentUser;
    const doc: TransferDoc = {
      id: generateId(), fromWarehouse, toWarehouse, productId, quantity,
      operator: user?.username || '未知', timestamp: Date.now(),
    };
    set((s) => ({ transferDocs: [...s.transferDocs, doc] }));
    get().addLog({
      operator: user?.username || '未知', type: 'transfer', documentId: doc.id,
      summary: `转仓 ${product.sku} ${quantity}件 ${WAREHOUSE_LABELS[fromWarehouse]}→${WAREHOUSE_LABELS[toWarehouse]}`,
      detail: {
        warehouse: '', sku: product.sku, color: product.color, size: product.size,
        quantity, fromWarehouse: WAREHOUSE_LABELS[fromWarehouse], toWarehouse: WAREHOUSE_LABELS[toWarehouse],
      },
    });
    setTimeout(() => get().save(), 0);
    return doc;
  },

  clearAll: () => {
    set({ ...emptyState, users: [DEFAULT_ADMIN], currentUser: null });
    localStorage.removeItem(STORAGE_KEY);
  },
}));
