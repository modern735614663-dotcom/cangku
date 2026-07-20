import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { getAvailableProducts } from '../utils/stats';
import { showToast } from '../components/Toast';
import { OUTBOUND_REASONS, WAREHOUSES, WAREHOUSE_LABELS, SIZES } from '../types';
import type { WarehouseId, BatchRow } from '../types';
import { generateId } from '../utils/id';

function emptyRow(): BatchRow {
  const sizes: Record<string, number> = {};
  for (const s of SIZES) sizes[s] = 0;
  return { id: generateId(), productId: '', color: '', sizes: { ...sizes }, price: 0 };
}

export default function OutboundPage() {
  const navigate = useNavigate();
  const products = useStore((s) => s.products);
  const inventories = useStore((s) => s.inventories);
  const currentUser = useStore((s) => s.currentUser);
  const subInventory = useStore((s) => s.subInventory);
  const addLog = useStore((s) => s.addLog);
  const addPending = useStore((s) => s.addPending);
  const isAdmin = useStore((s) => s.isAdmin);
  const save = useStore((s) => s.save);

  const [warehouseId, setWarehouseId] = useState<WarehouseId>('warehouse-a');
  const [reason, setReason] = useState('TK总店备货');
  const [rows, setRows] = useState<BatchRow[]>([emptyRow()]);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const availableProducts = useMemo(
    () => getAvailableProducts(products, inventories, warehouseId),
    [products, inventories, warehouseId]
  );

  const updateRow = (id: string, patch: Partial<BatchRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const updateSize = (id: string, size: string, qty: number) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, sizes: { ...r.sizes, [size]: qty } } : r));
  };
  const deleteRow = (id: string) => { if (rows.length <= 1) return; setRows((prev) => prev.filter((r) => r.id !== id)); };
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const handleProductSelect = (row: BatchRow, productId: string) => {
    if (!productId) { updateRow(row.id, { productId: '', color: '' }); return; }
    const prod = availableProducts.find((p) => p.id === productId);
    if (prod) { updateRow(row.id, { productId, color: prod.color, price: prod.price }); }
  };

  const getStockForSize = (productId: string, size: string) => {
    // 找到该款号+尺码对应的货品库存
    const prod = products.find((p) => p.id === productId);
    if (!prod) return 0;
    const sp = products.find((p) => p.sku === prod.sku && p.color === prod.color && p.size === size);
    if (!sp) return 0;
    const inv = inventories.find((i) => i.productId === sp.id && i.warehouseId === warehouseId);
    return inv?.quantity ?? 0;
  };

  const handlePasteImport = () => {
    const lines = pasteText.trim().split('\n').filter(Boolean);
    const newRows: BatchRow[] = [];
    for (const line of lines) {
      const cols = line.split('\t');
      const sku = cols[0]?.trim();
      if (!sku) continue;
      const sizes: Record<string, number> = {};
      for (const s of SIZES) sizes[s] = 0;
      const sizeList = Array.from(SIZES);
      for (let i = 0; i < sizeList.length; i++) {
        sizes[sizeList[i]] = parseInt(cols[1 + i]) || 0;
      }
      const existing = availableProducts.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
      if (existing) {
        newRows.push({ id: generateId(), productId: existing.id, color: existing.color, sizes: { ...sizes }, price: existing.price });
      }
    }
    if (newRows.length > 0) { setRows((prev) => [...prev, ...newRows]); showToast(`已导入 ${newRows.length} 行`, 'success'); }
    else { showToast('未匹配到库存货品', 'error'); }
    setShowPasteModal(false); setPasteText('');
  };

  const handleSubmit = () => {
    const username = currentUser?.username || '未知';
    const validRows = rows.filter((r) => r.productId && Object.values(r.sizes).some(v => v > 0));
    if (validRows.length === 0) { showToast('请至少填写一个尺码数量', 'error'); return; }

    const items: Array<{ productId: string; quantity: number }> = [];
    for (const row of validRows) {
      const prod = products.find((p) => p.id === row.productId);
      if (!prod) continue;
      for (const [size, qty] of Object.entries(row.sizes)) {
        if (qty <= 0) continue;
        const sp = products.find((p) => p.sku === prod.sku && p.color === prod.color && p.size === size);
        if (!sp) continue;
        const stock = inventories.find((i) => i.productId === sp.id && i.warehouseId === warehouseId)?.quantity ?? 0;
        if (qty > stock) { showToast(`${prod.sku} ${size} 库存不足（库存: ${stock}）`, 'error'); return; }
        items.push({ productId: sp.id, quantity: qty });
      }
    }
    if (items.length === 0) { showToast('无有效出库项', 'error'); return; }

    if (isAdmin()) {
      let totalQty = 0;
      for (const item of items) {
        totalQty += item.quantity;
        subInventory(item.productId, warehouseId, item.quantity);
      }
      const docId = generateId();
      useStore.setState((s) => ({ outboundDocs: [...s.outboundDocs, { id: docId, reason, warehouseId, items, operator: username, timestamp: Date.now() }] }));
      addLog({
        operator: username, type: 'outbound', documentId: docId,
        summary: `批量出库 ${totalQty} 件（${reason}）`,
        detail: { warehouse: WAREHOUSE_LABELS[warehouseId], quantity: totalQty, sourceOrReason: reason },
      });
      save();
      showToast(`出库成功！${totalQty} 件`, 'success');
    } else {
      addPending({ type: 'outbound', username, reason, warehouseId, items });
      showToast('已提交审核', 'info');
    }
    navigate('/');
  };

  const getRowTotalQty = (row: BatchRow) => Object.values(row.sizes).reduce((s, v) => s + v, 0);

  return (
    <div className="pb-20 space-y-3">
      <div className="px-4 pt-3 space-y-2">
        <div className="bg-orange-50 rounded-xl px-3 py-1.5 text-sm text-orange-700 flex items-center gap-2">
          <span>👤 {currentUser?.username}</span>
          {!isAdmin() && <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">需审核</span>}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {WAREHOUSES.map((w) => (
            <button key={w} onClick={() => { setWarehouseId(w); setRows([emptyRow()]); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${warehouseId === w ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >{WAREHOUSE_LABELS[w]}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {OUTBOUND_REASONS.map((r) => (
            <button key={r} onClick={() => setReason(r)}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${reason === r ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >{r}</button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-3">
        {rows.map((row, idx) => {
          const prod = availableProducts.find((p) => p.id === row.productId);
          const totalQty = getRowTotalQty(row);
          return (
            <div key={row.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5">#{idx + 1}</span>
                <select value={row.productId} onChange={(e) => handleProductSelect(row, e.target.value)}
                  className="flex-1 px-1 py-1 bg-white rounded border border-gray-200 text-xs outline-none">
                  <option value="">选择款号...</option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.sku} {p.color}/{p.size} 库存{p.stock}</option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">{prod?.color || ''}</span>
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
              <div className="px-3 pb-2 text-[10px] text-gray-400 flex justify-between">
                <span>合计 {totalQty} 件 {prod ? `| 单价 ¥${prod.price}` : ''}</span>
              </div>
            </div>
          );
        })}
        <div className="flex gap-2">
          <button onClick={addRow}
            className="flex-1 py-2 bg-white rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 active:bg-gray-50">+ 添加一行</button>
          <button onClick={() => setShowPasteModal(true)}
            className="flex-1 py-2 bg-white rounded-xl border border-dashed border-blue-300 text-sm text-blue-500 active:bg-blue-50">📋 粘贴导入</button>
        </div>
      </div>

      <div className="px-4">
        <button onClick={handleSubmit}
          className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 active:bg-blue-700 transition-colors">
          {isAdmin() ? '确认出库' : '提交审核'}
        </button>
      </div>

      {showPasteModal && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPasteModal(false)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5 space-y-3 animate-slide-up">
            <h3 className="font-semibold">粘贴导入</h3>
            <p className="text-xs text-gray-400">款号\t各尺码数量(8列)</p>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
              className="w-full h-32 px-3 py-2 bg-gray-50 rounded-xl border text-xs outline-none resize-none"
              placeholder={"SKU-001\t5\t10\t0\t20\t0\t0\t0\t0"} />
            <div className="flex gap-2">
              <button onClick={() => { setShowPasteModal(false); setPasteText(''); }}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">取消</button>
              <button onClick={handlePasteImport}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium">导入</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
