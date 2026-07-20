import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { getAvailableProducts } from '../utils/stats';
import { showToast } from '../components/Toast';
import { WAREHOUSES, WAREHOUSE_LABELS, SIZES } from '../types';
import type { WarehouseId, BatchRow } from '../types';
import { generateId } from '../utils/id';

function emptyRow(): BatchRow {
  const sizes: Record<string, number> = {};
  for (const s of SIZES) sizes[s] = 0;
  return { id: generateId(), productId: '', color: '', sizes: { ...sizes }, price: 0 };
}

export default function TransferPage() {
  const navigate = useNavigate();
  const products = useStore((s) => s.products);
  const inventories = useStore((s) => s.inventories);
  const createTransfer = useStore((s) => s.createTransfer);

  const [fromWarehouse, setFromWarehouse] = useState<WarehouseId>('warehouse-a');
  const [toWarehouse, setToWarehouse] = useState<WarehouseId>('warehouse-b');
  const [rows, setRows] = useState<BatchRow[]>([emptyRow()]);

  const availableProducts = useMemo(
    () => getAvailableProducts(products, inventories, fromWarehouse),
    [products, inventories, fromWarehouse]
  );

  const updateRow = (id: string, patch: Partial<BatchRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const updateSize = (id: string, size: string, qty: number) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, sizes: { ...r.sizes, [size]: qty } } : r));
  };
  const deleteRow = (id: string) => { if (rows.length <= 1) return; setRows((prev) => prev.filter((r) => r.id !== id)); };
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const getStockForSize = (productId: string, size: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return 0;
    const sp = products.find((p) => p.sku === prod.sku && p.color === prod.color && p.size === size);
    if (!sp) return 0;
    const inv = inventories.find((i) => i.productId === sp.id && i.warehouseId === fromWarehouse);
    return inv?.quantity ?? 0;
  };

  const handleSubmit = () => {
    const validRows = rows.filter((r) => r.productId && Object.values(r.sizes).some(v => v > 0));
    if (validRows.length === 0) { showToast('请至少填写一个尺码', 'error'); return; }

    let ok = 0;
    for (const row of validRows) {
      const prod = products.find((p) => p.id === row.productId);
      if (!prod) continue;
      for (const [size, qty] of Object.entries(row.sizes)) {
        if (qty <= 0) continue;
        const sp = products.find((p) => p.sku === prod.sku && p.color === prod.color && p.size === size);
        if (!sp) continue;
        const stock = getStockForSize(row.productId, size);
        if (qty > stock) { showToast(`${prod.sku} ${size} 库存不足`, 'error'); return; }
        const r = createTransfer({ fromWarehouse, toWarehouse, productId: sp.id, quantity: qty });
        if (r) ok++;
      }
    }
    if (ok > 0) { showToast(`转仓成功！${ok} 项`, 'success'); navigate('/'); }
    else { showToast('转仓失败', 'error'); }
  };

  const getRowTotalQty = (row: BatchRow) => Object.values(row.sizes).reduce((s, v) => s + v, 0);

  return (
    <div className="pb-20 space-y-3">
      <div className="px-4 pt-3 space-y-2">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {WAREHOUSES.map((w) => (
            <button key={w} onClick={() => { setFromWarehouse(w); setToWarehouse(w === 'warehouse-a' ? 'warehouse-b' : 'warehouse-a'); setRows([emptyRow()]); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${fromWarehouse === w ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >{WAREHOUSE_LABELS[w]}（出）</button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {WAREHOUSES.map((w) => (
            <button key={w} onClick={() => setToWarehouse(w)} disabled={w === fromWarehouse}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${w === fromWarehouse ? 'bg-gray-200 text-gray-300 cursor-not-allowed' : toWarehouse === w ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >{WAREHOUSE_LABELS[w]}（入）</button>
          ))}
        </div>
        <div className="bg-purple-50 rounded-xl p-2 text-xs text-purple-700 text-center">
          📦 {WAREHOUSE_LABELS[fromWarehouse]} → {WAREHOUSE_LABELS[toWarehouse]}
        </div>
      </div>

      <div className="px-4 space-y-3">
        {rows.map((row, idx) => {
          const totalQty = getRowTotalQty(row);
          return (
            <div key={row.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5">#{idx + 1}</span>
                <select value={row.productId} onChange={(e) => updateRow(row.id, { productId: e.target.value })}
                  className="flex-1 px-1 py-1 bg-white rounded border border-gray-200 text-xs outline-none">
                  <option value="">选择款号...</option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.sku} ({p.color}/{p.size}) 库存{p.stock}</option>
                  ))}
                </select>
                <button onClick={() => deleteRow(row.id)} className="text-red-400 text-lg shrink-0">&times;</button>
              </div>
              <div className="px-3 py-2 grid grid-cols-4 gap-1.5">
                {Array.from(SIZES).map((size) => {
                  const stock = row.productId ? getStockForSize(row.productId, size) : 0;
                  const val = row.sizes[size] || 0;
                  const over = val > stock && stock > 0;
                  return (
                    <div key={size} className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 w-6 text-right">{size}</span>
                      <input type="number" value={val}
                        onChange={(e) => updateSize(row.id, size, Math.max(0, parseInt(e.target.value) || 0))}
                        className={`flex-1 px-1 py-1 rounded border text-xs outline-none text-center ${over ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-100'}`}
                        min={0} max={stock} />
                    </div>
                  );
                })}
              </div>
              <div className="px-3 pb-2 text-[10px] text-gray-400">合计 {totalQty} 件</div>
            </div>
          );
        })}
        <button onClick={addRow}
          className="w-full py-2 bg-white rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 active:bg-gray-50">+ 添加一行</button>
      </div>

      <div className="px-4">
        <button onClick={handleSubmit}
          className="w-full py-3.5 bg-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-200 active:bg-purple-700 transition-colors">
          确认批量转仓
        </button>
      </div>
    </div>
  );
}
