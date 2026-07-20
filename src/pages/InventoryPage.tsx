import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { getProductsWithStock } from '../utils/stats';
import type { WarehouseId } from '../types';
import { WAREHOUSE_LABELS, CATEGORIES } from '../types';

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [warehouse, setWarehouse] = useState<'all' | WarehouseId>('all');
  const [category, setCategory] = useState<string>('全部');

  const products = useStore((s) => s.products);
  const inventories = useStore((s) => s.inventories);

  const warehouseId = warehouse === 'all' ? undefined : warehouse;

  const productsWithStock = useMemo(
    () => getProductsWithStock(products, inventories, warehouseId),
    [products, inventories, warehouseId]
  );

  const filtered = useMemo(() => {
    let list = productsWithStock;
    if (search.trim()) {
      const kw = search.toLowerCase();
      list = list.filter((p) =>
        p.sku.toLowerCase().includes(kw) ||
        p.color.toLowerCase().includes(kw) ||
        p.category.toLowerCase().includes(kw)
      );
    }
    if (category !== '全部') {
      list = list.filter((p) => p.category === category);
    }
    return list;
  }, [productsWithStock, search, category]);

  const totalValue = useMemo(
    () => filtered.reduce((s, p) => s + p.price * p.stock, 0),
    [filtered]
  );

  return (
    <div className="pb-20 space-y-3">
      <div className="px-4 pt-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: 'all', label: '合计' },
            { key: 'warehouse-a', label: WAREHOUSE_LABELS['warehouse-a'] },
            { key: 'warehouse-b', label: WAREHOUSE_LABELS['warehouse-b'] },
          ].map((opt) => (
            <button key={opt.key} onClick={() => setWarehouse(opt.key as 'all' | WarehouseId)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${warehouse === opt.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索款号、颜色、类别..."
          className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-200 placeholder-gray-400" />
      </div>

      {/* 类别筛选 */}
      <div className="px-4">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setCategory('全部')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${category === '全部' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >全部</button>
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${category === cat ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >{cat}</button>
          ))}
        </div>
      </div>

      <div className="px-4">
        <div className="text-xs text-gray-400">
          共 {filtered.length} 款 | 库存价值 ¥{totalValue.toLocaleString()}
          {warehouse === 'all' && (
            <span> | {WAREHOUSE_LABELS['warehouse-a']}: {filtered.reduce((s, p) => s + p.stockA, 0)} 件 | {WAREHOUSE_LABELS['warehouse-b']}: {filtered.reduce((s, p) => s + p.stockB, 0)} 件</span>
          )}
        </div>
      </div>

      <div className="px-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">{search || category !== '全部' ? '没有匹配的货品' : '暂无货品，请先入库'}</div>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
              {p.image ? (
                <img src={p.image} alt={p.sku} className="w-14 h-14 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-gray-400 text-xs">无图</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm">{p.sku}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">{p.category}</span>{' '}
                  {p.color} / {p.size} | <span className="text-blue-600">¥{p.price}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-bold text-gray-900">{p.stock}</div>
                <div className="text-xs text-gray-400">
                  {warehouse === 'all' ? `TK:${p.stockA} 1688:${p.stockB}` : '件'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
