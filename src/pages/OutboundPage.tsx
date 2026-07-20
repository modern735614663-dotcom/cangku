import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { getAvailableProducts } from '../utils/stats';
import { showToast } from '../components/Toast';
import { OUTBOUND_REASONS, WAREHOUSES, WAREHOUSE_LABELS } from '../types';
import type { WarehouseId, BatchRow } from '../types';
import { generateId } from '../utils/id';

function emptyRow(): BatchRow {
  return { id: generateId(), productId: '', quantity: 1, price: 0 };
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
  const [customReason, setCustomReason] = useState('');
  const [rows, setRows] = useState<BatchRow[]>([emptyRow()]);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const availableProducts = useMemo(
    () => getAvailableProducts(products, inventories, warehouseId),
    [products, inventories, warehouseId]
  );

  const finalReason = reason === '其他' ? (customReason || '其他') : reason;

  const updateRow = (id: string, patch: Partial<BatchRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const deleteRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const handleProductSelect = (row: BatchRow, productId: string) => {
    if (!productId) { updateRow(row.id, { productId: '' }); return; }
    const prod = availableProducts.find((p) => p.id === productId);
    if (prod) {
      updateRow(row.id, { productId, price: prod.price });
    }
  };

  const getStockForRow = (row: BatchRow) => {
    const prod = availableProducts.find((p) => p.id === row.productId);
    return prod?.stock ?? 0;
  };

  const handlePasteImport = () => {
    const lines = pasteText.trim().split('\n').filter(Boolean);
    const newRows: BatchRow[] = [];
    for (const line of lines) {
      const cols = line.split('\t');
      const sku = cols[0]?.trim();
      const qty = parseInt(cols[3]) || 1;
      if (!sku) continue;
      const existing = availableProducts.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
      if (existing) {
        newRows.push({ id: generateId(), productId: existing.id, quantity: qty, price: existing.price });
      }
    }
    if (newRows.length > 0) {
      setRows((prev) => [...prev, ...newRows]);
      showToast(`已导入 ${newRows.length} 行`, 'success');
    } else {
      showToast('未能匹配任何库存货品', 'error');
    }
    setShowPasteModal(false);
    setPasteText('');
  };

  const handleSubmit = () => {
    const username = currentUser?.username || '未知';
    const validRows = rows.filter((r) => r.productId && r.quantity > 0);

    if (validRows.length === 0) {
      showToast('请至少选择一款货品', 'error');
      return;
    }

    // 检查库存
    for (const row of validRows) {
      const stock = getStockForRow(row);
      if (row.quantity > stock) {
        const prod = availableProducts.find((p) => p.id === row.productId);
        showToast(`${prod?.sku || '未知'} 库存不足（库存: ${stock}）`, 'error');
        return;
      }
    }

    if (isAdmin()) {
      let totalQty = 0;
      for (const row of validRows) {
        totalQty += row.quantity;
        subInventory(row.productId, warehouseId, row.quantity);
      }
      addLog({
        operator: username, type: 'outbound', documentId: generateId(),
        summary: `批量出库 ${validRows.length} 款 ${totalQty} 件（${finalReason}）`,
        detail: { warehouse: WAREHOUSE_LABELS[warehouseId], quantity: totalQty, sourceOrReason: finalReason },
      });
      save();
      showToast(`出库成功！${validRows.length} 款 ${totalQty} 件`, 'success');
    } else {
      addPending({
        type: 'outbound', username, reason: finalReason, warehouseId,
        items: validRows.map((r) => ({ productId: r.productId, quantity: r.quantity })),
      });
      showToast('已提交审核，请等待管理员审批', 'info');
    }
    navigate('/');
  };

  return (
    <div className="pb-20 space-y-3">
      <div className="px-4 pt-3 space-y-2">
        <div className="bg-orange-50 rounded-xl px-4 py-2 text-sm text-orange-700 flex items-center gap-2">
          <span>👤 {currentUser?.username}</span>
          {!isAdmin() && <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">需审核</span>}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {WAREHOUSES.map((w) => (
            <button key={w} onClick={() => { setWarehouseId(w); setRows([emptyRow()]); }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${warehouseId === w ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >{WAREHOUSE_LABELS[w]}</button>
          ))}
        </div>
      </div>

      {/* 理由 */}
      <div className="px-4">
        <div className="flex flex-wrap gap-1.5">
          {OUTBOUND_REASONS.map((r) => (
            <button key={r} onClick={() => setReason(r)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${reason === r ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >{r}</button>
          ))}
          <button onClick={() => setReason('其他')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${reason === '其他' ? 'bg-gray-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >其他</button>
        </div>
        {reason === '其他' && (
          <input type="text" value={customReason} onChange={(e) => setCustomReason(e.target.value)}
            placeholder="自定义理由" className="w-full mt-1 px-3 py-1.5 bg-white rounded-lg border text-xs outline-none focus:ring-2 focus:ring-blue-200" />
        )}
      </div>

      {/* 批量表格 */}
      <div className="px-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          <div className="grid grid-cols-10 gap-1 px-3 py-2 bg-gray-50 text-xs text-gray-500 font-medium border-b">
            <div className="col-span-4">款号（仅库存有的）</div>
            <div className="col-span-2">数量</div>
            <div className="col-span-3">库存/单价</div>
            <div className="col-span-1"></div>
          </div>
          {rows.map((row) => {
            const stock = getStockForRow(row);
            const prod = availableProducts.find((p) => p.id === row.productId);
            return (
              <div key={row.id} className="grid grid-cols-10 gap-1 px-3 py-2 items-center text-xs border-b border-gray-50 last:border-0">
                <div className="col-span-4">
                  <select value={row.productId} onChange={(e) => handleProductSelect(row, e.target.value)}
                    className="w-full px-1 py-1 bg-gray-50 rounded border border-gray-100 text-xs outline-none">
                    <option value="">选择货品...</option>
                    {availableProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.sku} {p.color}/{p.size}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <input type="number" value={row.quantity} onChange={(e) => updateRow(row.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full px-1 py-1 bg-gray-50 rounded border border-gray-100 text-xs outline-none text-center" min={1} />
                  {row.quantity > stock && stock > 0 && (
                    <div className="text-[10px] text-red-500">超出库存</div>
                  )}
                </div>
                <div className="col-span-3 text-gray-400 text-[10px]">
                  {prod ? `库存${stock} ¥${prod.price}` : '-'}
                </div>
                <div className="col-span-1 text-center">
                  <button onClick={() => deleteRow(row.id)} className="text-red-400 text-lg leading-none">&times;</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={addRow}
            className="flex-1 py-2 bg-white rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 active:bg-gray-50">+ 添加一行</button>
          <button onClick={() => setShowPasteModal(true)}
            className="flex-1 py-2 bg-white rounded-xl border border-dashed border-blue-300 text-sm text-blue-500 active:bg-blue-50">📋 粘贴导入</button>
        </div>
      </div>

      <div className="px-4">
        <button onClick={handleSubmit}
          className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 active:bg-blue-700 transition-colors">
          {isAdmin() ? `确认出库（${rows.filter(r => r.productId).length} 款）` : '提交审核'}
        </button>
      </div>

      {/* 粘贴导入弹窗 */}
      {showPasteModal && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPasteModal(false)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5 space-y-3 animate-slide-up">
            <h3 className="font-semibold text-gray-900">粘贴导入</h3>
            <p className="text-xs text-gray-400">从 Excel 复制数据粘贴（款号 图片 尺码 数量 单价）</p>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
              placeholder={"SKU-001\t\tM\t5\nSKU-002\t\tL\t10"}
              className="w-full h-32 px-3 py-2 bg-gray-50 rounded-xl border text-xs outline-none resize-none"
            />
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
