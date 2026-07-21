// ====== 基础枚举 ======
export const WAREHOUSES = ['warehouse-a', 'warehouse-b'] as const;
export type WarehouseId = (typeof WAREHOUSES)[number];

export const WAREHOUSE_LABELS: Record<WarehouseId, string> = {
  'warehouse-a': 'TK备货仓',
  'warehouse-b': '1688预留仓',
};

export const CATEGORIES = ['裙套装', '裤套装', '连衣裙', '单上衣', '单裤', '单裙', '其他'] as const;
export type Category = (typeof CATEGORIES)[number];

export const COLORS = ['白色', '黑色', '绿色', '红色', '杏色', '紫色', '粉红色', '蓝色', '棕色', '玫红色', '卡其色', '灰色', '豹纹', '拼色', '其他'] as const;
export type Color = (typeof COLORS)[number];

export const SIZES = ['S', 'M', 'L', 'XL', 'XXL', '其他'] as const;
export type SizeOption = (typeof SIZES)[number];

export const INBOUND_SOURCES = ['采购', '退货', '其他'] as const;
export type InboundSource = (typeof INBOUND_SOURCES)[number];

export const OUTBOUND_REASONS = ['TK总店备货', 'TK1号店备货', 'TK2号店备货', 'TK 1号店JIT销售', '1688销售', 'temu备货', '审核寄样', '带货寄样'] as const;
export type OutboundReason = (typeof OUTBOUND_REASONS)[number];

// ====== 用户认证 ======
export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  createdAt: number;
}

// ====== 数据模型 ======

/** 货品/SKU */
export interface Product {
  id: string;
  sku: string;
  category: Category | string;
  color: string;
  size: string;
  price: number; // 单价
  image?: string;
  createdAt: number;
}

/** 库存明细 */
export interface Inventory {
  warehouseId: WarehouseId;
  productId: string;
  quantity: number;
}

/** 批量表单行（多尺码） */
export interface BatchRow {
  id: string;
  productId: string;  // 选择已有货品ID（空=全新款）
  color: string;       // 颜色（选已有货品时自动带出）
  sizes: Record<string, number>; // 尺码→数量 { S: 5, M: 10, L: 0 }
  price: number;
  // 全新款
  isNewProduct?: boolean;
  newSku?: string;
  newCategory?: string;
  newImage?: string;
  // 自定义
  customColor?: string;
  customSize?: string;
  search?: string;
}

/** 库存合并显示行 */
export interface MergedRow {
  productIds: string[];   // 合并的货品ID列表
  sku: string;
  category: string;
  color: string;
  image?: string;
  price: number;
  sizes: Record<string, { stockA: number; stockB: number }>;
}

/** 操作记录 */
export interface OperationLog {
  id: string;
  operator: string;
  type: 'inbound' | 'outbound' | 'transfer';
  documentId: string;
  summary: string;
  timestamp: number;
  revoked?: boolean;
  revokeInfo?: { operator: string; timestamp: number };
  // 货品明细（用于日志详情弹窗）
  items?: Array<{
    sku: string; color: string; size: string; quantity: number; price?: number;
  }>;
  detail: {
    warehouse: string;
    sku?: string;
    color?: string;
    size?: string;
    quantity: number;
    price?: number;
    sourceOrReason?: string;
    fromWarehouse?: string;
    toWarehouse?: string;
  };
}

/** 入库单项 */
export interface InboundItem {
  productId: string;
  quantity: number;
  price?: number;
  isNewProduct?: boolean;
  newProductData?: Omit<Product, 'id' | 'createdAt'>;
}

/** 入库单 */
export interface InboundDoc {
  id: string;
  source: string;
  warehouseId: WarehouseId;
  items: InboundItem[];
  operator: string;
  timestamp: number;
}

/** 出库单项 */
export interface OutboundItem {
  productId: string;
  quantity: number;
}

/** 出库单 */
export interface OutboundDoc {
  id: string;
  reason: string;
  warehouseId: WarehouseId;
  items: OutboundItem[];
  operator: string;
  timestamp: number;
}

/** 转仓单 */
export interface TransferDoc {
  id: string;
  fromWarehouse: WarehouseId;
  toWarehouse: WarehouseId;
  productId: string;
  quantity: number;
  operator: string;
  timestamp: number;
}

/** 待审核单据 */
export type DocStatus = 'pending' | 'approved' | 'rejected';

export interface PendingDoc {
  id: string;
  type: 'inbound' | 'outbound';
  status: DocStatus;
  username: string;
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  source?: string;
  reason?: string;
  warehouseId: WarehouseId;
  items: Array<{
    productId: string;
    quantity: number;
    price?: number;
    isNewProduct?: boolean;
    newProductData?: Omit<Product, 'id' | 'createdAt'>;
  }>;
}

// ====== 统计相关 ======
export type Period = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear';
export type ChartGranularity = 'day' | 'week' | 'month' | 'halfYear' | 'year';

export interface TrendDataPoint {
  label: string;
  count: number;
}

export interface TrendSeries {
  labels: string[];
  current: number[];
  compare: number[];
  compareLabel: string;
}

export interface AppData {
  products: Product[];
  inventories: Inventory[];
  operationLogs: OperationLog[];
  inboundDocs: InboundDoc[];
  outboundDocs: OutboundDoc[];
  transferDocs: TransferDoc[];
  pendingDocs: PendingDoc[];
  users: User[];
  currentUser: User | null;
}
