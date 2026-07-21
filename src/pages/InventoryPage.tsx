import { useState, useMemo, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { mergeBySkuColor, calcTotalValue } from '../utils/stats';
import { WAREHOUSE_LABELS, CATEGORIES, COLORS, SIZES } from '../types';
import type { WarehouseId, Product } from '../types';

const MAX_IMG = 200;

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [warehouse, setWarehouse] = useState<'all' | WarehouseId>('all');
  const [category, setCategory] = useState<string>('全部');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const products = useStore((s) => s.products);
  const inventories = useStore((s) => s.inventories);
  const save = useStore((s) => s.save);

  const warehouseId = warehouse === 'all' ? undefined : warehouse;

  // 合并同款同色
  const mergedRows = useMemo(
    () => mergeBySkuColor(products, inventories),
    [products, inventories]
  );

  const totalValue = useMemo(
    () => calcTotalValue(products, inventories, warehouseId),
    [products, inventories, warehouseId]
  );

  const filtered = useMemo(() => {
    let list = mergedRows;
    if (search.trim()) {
      const kw = search.toLowerCase();
      list = list.filter((r) => r.sku.toLowerCase().includes(kw) || r.color.toLowerCase().includes(kw) || r.category.toLowerCase().includes(kw));
    }
    if (category !== '全部') {
      list = list.filter((r) => r.category === category);
    }
    return list;
  }, [mergedRows, search, category]);

  const totalStock = useMemo(() => {
    return filtered.reduce((s, r) => {
      for (const sz of Object.values(r.sizes)) {
        s += warehouseId === 'warehouse-a' ? sz.stockA : warehouseId === 'warehouse-b' ? sz.stockB : sz.stockA + sz.stockB;
      }
      return s;
    }, 0);
  }, [filtered, warehouseId]);

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image(); img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX_IMG) { h = h * MAX_IMG / w; w = MAX_IMG; } }
        else { if (h > MAX_IMG) { w = w * MAX_IMG / h; h = MAX_IMG; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        setEditForm((p) => ({ ...p, image: canvas.toDataURL('image/jpeg', 0.7) }));
      }; img.src = reader.result as string;
    }; reader.readAsDataURL(file);
  }, []);

  const openEditor = (row: typeof mergedRows[0]) => {
    // 找第一个 productId 对应的产品
    const prod = row.productIds.length > 0 ? products.find((p) => p.id === row.productIds[0]) : null;
    if (prod) {
      setEditingProduct(prod);
      setEditForm({ sku: prod.sku, category: prod.category, color: prod.color, price: prod.price, image: prod.image });
    }
  };

  const saveEdit = () => {
    if (!editingProduct) return;
    // 更新所有同款同色的产品
    const relatedIds = mergedRows.find((r) => r.productIds.includes(editingProduct.id))?.productIds || [editingProduct.id];
    useStore.setState((s) => ({
      products: s.products.map((p) =>
        relatedIds.includes(p.id)
          ? { ...p, sku: editForm.sku || p.sku, category: editForm.category || p.category, color: editForm.color || p.color, price: editForm.price ?? p.price, image: editForm.image !== undefined ? editForm.image : p.image }
          : p
      ),
    }));
    save();
    setEditingProduct(null);
  };

  const deleteProduct = () => {
    if (!editingProduct) return;
    const relatedIds = mergedRows.find((r) => r.productIds.includes(editingProduct.id))?.productIds || [editingProduct.id];
    useStore.setState((s) => ({
      products: s.products.filter((p) => !relatedIds.includes(p.id)),
      inventories: s.inventories.filter((i) => !relatedIds.includes(i.productId)),
    }));
    save();
    setEditingProduct(null);
  };

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
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${warehouse === opt.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索款号..."
          className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-200" />
      </div>

      <div className="px-4">
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setCategory('全部')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${category === '全部' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >全部</button>
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${category === cat ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >{cat}</button>
          ))}
        </div>
      </div>

      <div className="px-4">
        <div className="text-xs text-gray-400">
          共 {filtered.length} 款 | {totalStock} 件 | ¥{totalValue.toLocaleString()}
        </div>
      </div>

      <div className="px-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">暂无货品</div>
        ) : (
          filtered.map((row) => (
            <div key={`${row.sku}-${row.color}`} className="bg-white rounded-xl p-3 shadow-sm">
              <div className="flex gap-3">
                {row.image ? (
                  <img src={row.image} alt={row.sku} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-gray-400 text-xs">无图</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{row.sku}</span>
                    <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600">{row.category}</span>
                    <span className="text-xs text-gray-500">{row.color}</span>
                  </div>
                  <div className="text-xs text-blue-600 mt-0.5">¥{row.price}</div>

                  {/* 尺码明细 */}
                  <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
                    {Array.from(SIZES).map((size) => {
                      const sz = row.sizes[size];
                      if (!sz) return null;
                      const s = warehouseId === 'warehouse-a' ? sz.stockA : warehouseId === 'warehouse-b' ? sz.stockB : sz.stockA + sz.stockB;
                      const low = s < 5;
                      return (
                        <span key={size} className="text-[10px]">
                          <span className="text-gray-400">{size}:</span>
                          <span className={`font-medium ${low ? 'text-red-500' : 'text-gray-700'}`}>
                            {s}{low ? '⚠️' : ''}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
                <button onClick={() => openEditor(row)}
                  className="text-gray-400 active:text-blue-500 shrink-0 self-start">✏️</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 编辑弹窗 */}
      {editingProduct && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingProduct(null)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[80vh] overflow-y-auto p-5 space-y-3 animate-slide-up">
            <h3 className="font-semibold text-gray-900">编辑货品</h3>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">图片</label>
              <div className="h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 relative overflow-hidden">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                {editForm.image ? (
                  <img src={editForm.image} alt="" className="w-14 h-14 rounded object-cover" />
                ) : (
                  <span className="text-gray-400 text-xs">点击更换图片</span>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">款号</label>
              <input type="text" value={editForm.sku || ''} onChange={(e) => setEditForm((p) => ({ ...p, sku: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 rounded-xl border text-sm outline-none" />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">类别</label>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => setEditForm((p) => ({ ...p, category: cat }))}
                    className={`px-2 py-1 rounded text-xs transition-all ${editForm.category === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >{cat}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">颜色</label>
              <select value={editForm.color || ''} onChange={(e) => setEditForm((p) => ({ ...p, color: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 rounded-xl border text-sm outline-none">
                {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">单价</label>
              <input type="number" value={editForm.price || 0} onChange={(e) => setEditForm((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-gray-50 rounded-xl border text-sm outline-none" step="0.01" />
            </div>

            <div className="flex gap-2">
              <button onClick={deleteProduct}
                className="flex-1 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium active:bg-red-100">删除此款</button>
              <button onClick={saveEdit}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium active:bg-blue-700">保存</button>
            </div>
            <button onClick={() => setEditingProduct(null)}
              className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
