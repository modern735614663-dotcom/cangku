import { create } from 'zustand';
import type {
  Product, Inventory, OperationLog, TransferDoc, PendingDoc,
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

const emptyState: AppData = {
  products: [], inventories: [], operationLogs: [], inboundDocs: [],
  outboundDocs: [], transferDocs: [], pendingDocs: [],
  users: [DEFAULT_ADMIN], currentUser: null,
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
    const pending = get().pendingDocs.find((p) => p.id === id);
    if (!pending || pending.status !== 'pending') return false;
    const now = Date.now();

    if (pending.type === 'inbound') {
      for (const item of pending.items) {
        if (item.isNewProduct && item.newProductData) {
          const prod = get().addProduct(item.newProductData);
          item.productId = prod.id;
          item.isNewProduct = false;
        }
        get().addInventory(item.productId, pending.warehouseId, item.quantity);
      }
      const totalQty = pending.items.reduce((s, i) => s + i.quantity, 0);
      const firstItem = pending.items[0];
      const prod = firstItem ? get().getProduct(firstItem.productId) : undefined;
      const isNew = firstItem?.isNewProduct && firstItem?.newProductData;
      get().addLog({
        operator: pending.username, type: 'inbound', documentId: generateId(),
        summary: `入库 ${totalQty} 件（${pending.source}）`,
        detail: {
          warehouse: WAREHOUSE_LABELS[pending.warehouseId],
          quantity: totalQty,
          sourceOrReason: pending.source,
          sku: isNew ? firstItem!.newProductData!.sku : (prod?.sku ?? undefined),
          color: isNew ? firstItem!.newProductData!.color : (prod?.color ?? undefined),
          size: isNew ? firstItem!.newProductData!.size : (prod?.size ?? undefined),
        },
      });
    } else {
      for (const item of pending.items) {
        get().subInventory(item.productId, pending.warehouseId, item.quantity);
      }
      const totalQty = pending.items.reduce((s, i) => s + i.quantity, 0);
      const firstItem = pending.items[0];
      const prod = firstItem ? get().getProduct(firstItem.productId) : undefined;
      get().addLog({
        operator: pending.username, type: 'outbound', documentId: generateId(),
        summary: `出库 ${totalQty} 件（${pending.reason}）`,
        detail: {
          warehouse: WAREHOUSE_LABELS[pending.warehouseId],
          quantity: totalQty,
          sourceOrReason: pending.reason,
          sku: prod?.sku,
          color: prod?.color,
          size: prod?.size,
        },
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
    const log = get().operationLogs.find((l) => l.id === logId);
    if (!log || log.revoked) return false;

    const user = get().currentUser;
    const username = user?.username || '管理员';
    const now = Date.now();

    if (log.type === 'inbound') {
      // 入库撤销 = 扣回库存
      const doc = get().inboundDocs.find((d) => d.id === log.documentId);
      if (doc) {
        for (const item of doc.items) {
          get().addInventory(item.productId, doc.warehouseId, -(item.quantity || 0));
        }
      }
    } else if (log.type === 'outbound') {
      // 出库撤销 = 加回库存
      const doc = get().outboundDocs.find((d) => d.id === log.documentId);
      if (doc) {
        for (const item of doc.items) {
          get().addInventory(item.productId, doc.warehouseId, item.quantity);
        }
      }
    } else if (log.type === 'transfer') {
      // 转仓撤销 = 从目标仓退回来源仓
      const doc = get().transferDocs.find((d) => d.id === log.documentId);
      if (doc) {
        get().subInventory(doc.productId, doc.toWarehouse as WarehouseId, doc.quantity);
        get().addInventory(doc.productId, doc.fromWarehouse as WarehouseId, doc.quantity);
      }
    }

    // 标记撤销
    set((s) => ({
      operationLogs: s.operationLogs.map((l) =>
        l.id === logId ? { ...l, revoked: true, revokeInfo: { operator: username, timestamp: now } } : l
      ),
    }));

    // 生成撤销记录
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
