import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { getAvailableProducts } from '../utils/stats';
import { showToast } from '../components/Toast';
import { WAREHOUSES, WAREHOUSE_LABELS } from '../types';
import type { WarehouseId, BatchRow } from '../types';
import { generateId } from '../utils/id';

function emptyRow(): BatchRow {
  return { id: generateId(), productId: '', quantity: 1, price: 0 };
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
  const deleteRow = (id: string) => { if (rows.length <= 1) return; setRows((prev) => prev.filter((r) => r.id !== id)); };
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const getStock = (row: BatchRow) => {
    const prod = availableProducts.find((p) => p.id === row.productId);
    return prod?.stock ?? 0;
  };

  const handleSubmit = () => {
    const validRows = rows.filter((r) => r.productId && r.quantity > 0);
    if (validRows.length === 0) { showToast('请至少选择一款货品', 'error'); return; }

    for (const row of validRows) {
      const stock = getStock(row);
      if (row.quantity > stock) {
        showToast(`库存不足（库存: ${stock}）`, 'error');
        return;
      }
    }

    let ok = 0;
    for (const row of validRows) {
      const r = createTransfer({ fromWarehouse, toWarehouse, productId: row.productId, quantity: row.quantity });
      if (r) ok++;
    }
    if (ok > 0) {
      showToast(`转仓成功！${ok} 款`, 'success');
      navigate('/');
    } else {
      showToast('转仓失败', 'error');
    }
  };

  return (
    <div className="pb-20 space-y-3">
      <div className="px-4 pt-3 space-y-2">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {WAREHOUSES.map((w) => (
            <button key={w} onClick={() => { setFromWarehouse(w); setToWarehouse(w === 'warehouse-a' ? 'warehouse-b' : 'warehouse-a'); setRows([emptyRow()]); }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${fromWarehouse === w ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >{WAREHOUSE_LABELS[w]}（出）</button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {WAREHOUSES.map((w) => (
            <button key={w} onClick={() => setToWarehouse(w)} disabled={w === fromWarehouse}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${w === fromWarehouse ? 'bg-gray-200 text-gray-300 cursor-not-allowed' : toWarehouse === w ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >{WAREHOUSE_LABELS[w]}（入）</button>
          ))}
        </div>
      </div>

      <div className="px-4">
        <div className="bg-purple-50 rounded-xl p-3 text-sm text-purple-700">
          📦 {WAREHOUSE_LABELS[fromWarehouse]} → {WAREHOUSE_LABELS[toWarehouse]}
        </div>
      </div>

      {/* 批量表格 */}
      <div className="px-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          <div className="grid grid-cols-10 gap-1 px-3 py-2 bg-gray-50 text-xs text-gray-500 font-medium border-b">
            <div className="col-span-5">款号</div>
            <div className="col-span-3">数量</div>
            <div className="col-span-2"></div>
          </div>
          {rows.map((row) => {
            const stock = getStock(row);
            return (
              <div key={row.id} className="grid grid-cols-10 gap-1 px-3 py-2 items-center text-xs border-b border-gray-50 last:border-0">
                <div className="col-span-5">
                  <select value={row.productId} onChange={(e) => updateRow(row.id, { productId: e.target.value })}
                    className="w-full px-1 py-1 bg-gray-50 rounded border border-gray-100 text-xs outline-none">
                    <option value="">选择...</option>
                    {availableProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.sku} ({p.color}/{p.size}) 库存{p.stock}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <input type="number" value={row.quantity} onChange={(e) => updateRow(row.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full px-1 py-1 bg-gray-50 rounded border border-gray-100 text-xs outline-none text-center" min={1} max={stock} />
                </div>
                <div className="col-span-2 text-center">
                  <button onClick={() => deleteRow(row.id)} className="text-red-400 text-lg leading-none">&times;</button>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={addRow}
          className="w-full mt-2 py-2 bg-white rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 active:bg-gray-50">
          + 添加一行
        </button>
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
