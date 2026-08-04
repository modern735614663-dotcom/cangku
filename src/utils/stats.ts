import type {
  Product,
  Inventory,
  OperationLog,
  WarehouseId,
  Period,
  ChartGranularity,
  TrendSeries,
  MergedRow,
} from '../types';
import { getPeriodRange, generateTrendSlots } from './date';

// ====== 从操作日志计算统计（v4.0+ 不再用 inboundDocs/outboundDocs） ======

/** 从日志统计指定类型数量 */
export function calcLogTotal(
  logs: OperationLog[],
  logType: 'inbound' | 'outbound',
  period: Period,
  warehouseId?: WarehouseId
): number {
  const { start, end } = getPeriodRange(period);
  return logs
    .filter(l => l.type === logType && !l.revoked && l.timestamp >= start && l.timestamp <= end
      && (!warehouseId || l.detail?.warehouse === warehouseId))
    .reduce((s, l) => s + (l.detail?.quantity || 0), 0);
}

/** 从日志统计出库金额 */
export function calcLogOutboundValue(
  logs: OperationLog[],
  period: Period,
  warehouseId?: WarehouseId
): number {
  const { start, end } = getPeriodRange(period);
  let total = 0;
  for (const l of logs) {
    if (l.type !== 'outbound' || l.revoked) continue;
    if (l.timestamp < start || l.timestamp > end) continue;
    if (warehouseId && l.detail?.warehouse !== warehouseId) continue;
    total += (l.detail?.quantity || 0) * (l.detail?.price || 0);
  }
  return Math.round(total * 100) / 100;
}

/** 从日志生成趋势对比 */
export function calcLogTrendComparison(
  logs: OperationLog[],
  granularity: ChartGranularity,
  warehouseId?: WarehouseId
): TrendSeries {
  const { labels, slotStart, slotMs } = generateTrendSlots(granularity);
  const outboundLogs = logs.filter(l => l.type === 'outbound' && !l.revoked
    && (!warehouseId || l.detail?.warehouse === warehouseId));

  const compareLabels: Record<ChartGranularity, string> = {
    day: '昨日', week: '上周', month: '上月', halfYear: '上半年', year: '去年',
  };

  const current: number[] = [];
  const compare: number[] = [];
  const compareOffset = labels.length * slotMs;

  for (let i = 0; i < labels.length; i++) {
    const slotBegin = slotStart + i * slotMs;
    const slotEnd = slotBegin + slotMs;
    current.push(outboundLogs.filter(l => l.timestamp >= slotBegin && l.timestamp < slotEnd).reduce((s, l) => s + (l.detail?.quantity || 0), 0));
    compare.push(outboundLogs.filter(l => l.timestamp >= slotBegin - compareOffset && l.timestamp < slotEnd - compareOffset).reduce((s, l) => s + (l.detail?.quantity || 0), 0));
  }
  return { labels, current, compare, compareLabel: compareLabels[granularity] || '上期' };
}

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

