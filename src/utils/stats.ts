import type {
  Product,
  Inventory,
  OutboundDoc,
  WarehouseId,
  Period,
  ChartGranularity,
  TrendDataPoint,
  TrendSeries,
  MergedRow,
} from '../types';
import { getPeriodRange, generateTrendSlots } from './date';

/** 计算总库存量 */
export function calcTotalStock(
  inventories: Inventory[],
  warehouseId?: WarehouseId
): number {
  const filtered = warehouseId
    ? inventories.filter((inv) => inv.warehouseId === warehouseId)
    : inventories;
  return filtered.reduce((sum, inv) => sum + inv.quantity, 0);
}

/** 按仓库计算库存量 */
export function calcStockByWarehouse(
  inventories: Inventory[]
): Record<WarehouseId, number> {
  const result: Record<WarehouseId, number> = {
    'warehouse-a': 0,
    'warehouse-b': 0,
  };
  for (const inv of inventories) {
    result[inv.warehouseId] += inv.quantity;
  }
  return result;
}

/** 计算库存总价值 */
export function calcTotalValue(
  products: Product[],
  inventories: Inventory[],
  warehouseId?: WarehouseId
): number {
  let total = 0;
  const filtered = warehouseId
    ? inventories.filter((inv) => inv.warehouseId === warehouseId)
    : inventories;
  for (const inv of filtered) {
    const prod = products.find((p) => p.id === inv.productId);
    total += (prod?.price ?? 0) * inv.quantity;
  }
  return Math.round(total * 100) / 100;
}

/** 统计所有出库（不再区分理由） */
export function calcTotalOutbound(
  outboundDocs: OutboundDoc[],
  period: Period,
  warehouseId?: WarehouseId
): number {
  const { start, end } = getPeriodRange(period);
  const filtered = outboundDocs.filter((doc) => {
    if (doc.timestamp < start || doc.timestamp > end) return false;
    if (warehouseId && doc.warehouseId !== warehouseId) return false;
    return true;
  });
  return filtered.reduce((sum, doc) => {
    return sum + doc.items.reduce((s, item) => s + item.quantity, 0);
  }, 0);
}

/** 统计出库金额 */
export function calcOutboundValue(
  products: Product[],
  outboundDocs: OutboundDoc[],
  period: Period,
  warehouseId?: WarehouseId
): number {
  const { start, end } = getPeriodRange(period);
  let total = 0;
  for (const doc of outboundDocs) {
    if (doc.timestamp < start || doc.timestamp > end) continue;
    if (warehouseId && doc.warehouseId !== warehouseId) continue;
    for (const item of doc.items) {
      const prod = products.find((p) => p.id === item.productId);
      total += (prod?.price ?? 0) * item.quantity;
    }
  }
  return Math.round(total * 100) / 100;
}

/** 生成趋势图数据 */
export function calcTrendData(
  outboundDocs: OutboundDoc[],
  granularity: ChartGranularity,
  warehouseId?: WarehouseId
): TrendDataPoint[] {
  const { labels, slotStart, slotMs } = generateTrendSlots(granularity);

  const filtered = outboundDocs.filter((d) => {
    if (warehouseId && d.warehouseId !== warehouseId) return false;
    return true;
  });

  return labels.map((label, i) => {
    const slotBegin = slotStart + i * slotMs;
    const slotEnd = slotBegin + slotMs;
    const total = filtered
      .filter((doc) => doc.timestamp >= slotBegin && doc.timestamp < slotEnd)
      .reduce((sum, doc) => sum + doc.items.reduce((s, it) => s + it.quantity, 0), 0);
    return { label, count: total };
  });
}

/** 生成趋势对比数据（本期 vs 上期） */
export function calcTrendComparison(
  outboundDocs: OutboundDoc[],
  granularity: ChartGranularity,
  warehouseId?: WarehouseId
): TrendSeries {
  const { labels, slotStart, slotMs } = generateTrendSlots(granularity);

  const filtered = outboundDocs.filter((d) => {
    if (warehouseId && d.warehouseId !== warehouseId) return false;
    return true;
  });

  const compareLabels: Record<ChartGranularity, string> = {
    day: '昨日',
    week: '上周',
    month: '上月',
    halfYear: '上半年',
    year: '去年',
  };

  const current: number[] = [];
  const compare: number[] = [];
  const compareOffset = labels.length * slotMs; // 上一个周期的偏移量

  for (let i = 0; i < labels.length; i++) {
    const slotBegin = slotStart + i * slotMs;
    const slotEnd = slotBegin + slotMs;

    // 本期
    const cur = filtered
      .filter((doc) => doc.timestamp >= slotBegin && doc.timestamp < slotEnd)
      .reduce((sum, doc) => sum + doc.items.reduce((s, it) => s + it.quantity, 0), 0);
    current.push(cur);

    // 上期（往前偏移一个完整周期）
    const prevBegin = slotBegin - compareOffset;
    const prevEnd = slotEnd - compareOffset;
    const prev = filtered
      .filter((doc) => doc.timestamp >= prevBegin && doc.timestamp < prevEnd)
      .reduce((sum, doc) => sum + doc.items.reduce((s, it) => s + it.quantity, 0), 0);
    compare.push(prev);
  }

  return {
    labels,
    current,
    compare,
    compareLabel: compareLabels[granularity] || '上期',
  };
}

/** 获取带库存信息的货品列表 */
export function getProductsWithStock(
  products: Product[],
  inventories: Inventory[],
  warehouseId?: WarehouseId
): Array<Product & { stock: number; stockA: number; stockB: number }> {
  return products.map((p) => {
    const invA = inventories.find(
      (inv) => inv.productId === p.id && inv.warehouseId === 'warehouse-a'
    );
    const invB = inventories.find(
      (inv) => inv.productId === p.id && inv.warehouseId === 'warehouse-b'
    );
    const stockA = invA?.quantity ?? 0;
    const stockB = invB?.quantity ?? 0;
    const stock = warehouseId
      ? warehouseId === 'warehouse-a'
        ? stockA
        : stockB
      : stockA + stockB;
    return { ...p, stock, stockA, stockB };
  });
}

/** 获取有库存的货品（供出库选择） */
export function getAvailableProducts(
  products: Product[],
  inventories: Inventory[],
  warehouseId: WarehouseId
): Array<Product & { stock: number }> {
  return products
    .map((p) => {
      const inv = inventories.find(
        (i) => i.productId === p.id && i.warehouseId === warehouseId
      );
      return { ...p, stock: inv?.quantity ?? 0 };
    })
    .filter((p) => p.stock > 0);
}

/** 合并同款同色货品为一行（多尺码展示） */
export function mergeBySkuColor(
  products: Product[],
  inventories: Inventory[]
): MergedRow[] {
  const map = new Map<string, MergedRow>();

  for (const p of products) {
    const key = `${p.sku}|${p.color}`;
    let row = map.get(key);
    if (!row) {
      row = {
        productIds: [],
        sku: p.sku,
        category: p.category,
        color: p.color,
        image: p.image,
        price: p.price,
        sizes: {},
      };
      map.set(key, row);
    }
    // 用最高价格
    if (p.price > row.price) row.price = p.price;
    if (p.image && !row.image) row.image = p.image;
    row.productIds.push(p.id);

    const invA = inventories.find((i) => i.productId === p.id && i.warehouseId === 'warehouse-a');
    const invB = inventories.find((i) => i.productId === p.id && i.warehouseId === 'warehouse-b');
    row.sizes[p.size] = {
      stockA: invA?.quantity ?? 0,
      stockB: invB?.quantity ?? 0,
    };
  }

  return Array.from(map.values());
}

