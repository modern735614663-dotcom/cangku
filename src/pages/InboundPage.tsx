import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { showToast } from '../components/Toast';
import { COLORS, SIZES, CATEGORIES, INBOUND_SOURCES, WAREHOUSES, WAREHOUSE_LABELS } from '../types';
import type { WarehouseId, BatchRow } from '../types';
import { generateId } from '../utils/id';

function emptyRow(): BatchRow {
  return { id: generateId(), productId: '', quantity: 1, price: 0 };
}

export default function InboundPage() {
  const navigate = useNavigate();
  const products = useStore((s) => s.products);
  const currentUser = useStore((s) => s.currentUser);
  const addProduct = useStore((s) => s.addProduct);
  const addInventory = useStore((s) => s.addInventory);
  const addLog = useStore((s) => s.addLog);
  const addPending = useStore((s) => s.addPending);
  const isAdmin = useStore((s) => s.isAdmin);
  const save = useStore((s) => s.save);

  const [warehouseId, setWarehouseId] = useState<WarehouseId>('warehouse-a');
  const [source, setSource] = useState('采购');
  const [rows, setRows] = useState<BatchRow[]>([emptyRow()]);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [expandedNew, setExpandedNew] = useState<Record<string, boolean>>({});

  const finalSource = source;

  const updateRow = (id: string, patch: Partial<BatchRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const deleteRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const handleProductSelect = (row: BatchRow, productId: string) => {
    if (!productId) {
      updateRow(row.id, { productId: '', isNewProduct: false });
      return;
    }
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      updateRow(row.id, {
        productId,
        price: prod.price,
        newColor: undefined,
        newSize: undefined,
        isNewProduct: false,
      });
    }
  };

  const handlePasteImport = () => {
    const lines = pasteText.trim().split('\n').filter(Boolean);
    const newRows: BatchRow[] = [];
    for (const line of lines) {
      const cols = line.split('\t');
      if (cols.length < 3) continue;
      const sku = cols[0]?.trim();
      const sizeFromPaste = cols[2]?.trim();
      const qty = parseInt(cols[3]) || 1;
      const price = parseFloat(cols[4]) || 0;

      // 尝试匹配已有款号
      const existing = products.find((p) => p.sku.toLowerCase() === sku?.toLowerCase());
      if (existing) {
        newRows.push({
          id: generateId(),
          productId: existing.id,
          quantity: qty,
          price: price || existing.price,
          isNewProduct: false,
        });
      } else if (sku) {
        newRows.push({
          id: generateId(),
          productId: '',
          quantity: qty,
          price,
          isNewProduct: true,
          newSku: sku,
          newSize: sizeFromPaste || '',
        });
      }
    }
    if (newRows.length > 0) {
      setRows((prev) => [...prev, ...newRows]);
      showToast(`已导入 ${newRows.length} 行`, 'success');
    } else {
      showToast('未能解析数据，请检查格式', 'error');
    }
    setShowPasteModal(false);
    setPasteText('');
  };

  const handleSubmit = () => {
    const username = currentUser?.username || '未知';
    const validRows = rows.filter((r) => {
      if (r.isNewProduct) return r.newSku && r.newColor && r.newSize && r.quantity > 0;
      return r.productId && r.quantity > 0;
    });

    if (validRows.length === 0) {
      showToast('请至少填写一行有效数据', 'error');
      return;
    }

    if (isAdmin()) {
      let totalQty = 0;
      for (const row of validRows) {
        totalQty += row.quantity;
        let pid = row.productId;
        if (row.isNewProduct && row.newSku) {
          const prod = addProduct({
            sku: row.newSku,
            category: row.newCategory || '其他',
            color: row.newColor || '',
            size: row.newSize || '',
            price: row.price,
            image: row.newImage,
          });
          pid = prod.id;
        }
        addInventory(pid, warehouseId, row.quantity);
      }
      addLog({
        operator: username, type: 'inbound', documentId: generateId(),
        summary: `批量入库 ${validRows.length} 款 ${totalQty} 件（${finalSource}）`,
        detail: { warehouse: WAREHOUSE_LABELS[warehouseId], quantity: totalQty, sourceOrReason: finalSource },
      });
      save();
      showToast(`入库成功！${validRows.length} 款 ${totalQty} 件`, 'success');
    } else {
      addPending({
        type: 'inbound', username, source: finalSource, warehouseId,
        items: validRows.map((r) => ({
          productId: r.productId,
          quantity: r.quantity,
          price: r.price,
          isNewProduct: r.isNewProduct || false,
          newProductData: r.isNewProduct ? {
            sku: r.newSku || '', category: r.newCategory || '其他',
            color: r.newColor || '', size: r.newSize || '',
            price: r.price, image: r.newImage,
          } : undefined,
        })),
      });
      showToast('已提交审核，请等待管理员审批', 'info');
    }
    navigate('/');
  };

  return (
    <div className="pb-20 space-y-3">
      {/* 用户 + 仓库 */}
      <div className="px-4 pt-3 space-y-2">
        <div className="bg-blue-50 rounded-xl px-4 py-2 text-sm text-blue-700 flex items-center gap-2">
          <span>👤 {currentUser?.username}</span>
          {!isAdmin() && <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">需审核</span>}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {WAREHOUSES.map((w) => (
            <button key={w} onClick={() => setWarehouseId(w)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${warehouseId === w ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >{WAREHOUSE_LABELS[w]}</button>
          ))}
        </div>
      </div>

      {/* 来源 */}
      <div className="px-4">
        <div className="flex flex-wrap gap-2">
          {INBOUND_SOURCES.map((s) => (
            <button key={s} onClick={() => setSource(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${source === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* 批量表格 */}
      <div className="px-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          {/* 表头 */}
          <div className="grid grid-cols-12 gap-1 px-3 py-2 bg-gray-50 text-xs text-gray-500 font-medium border-b">
            <div className="col-span-3">款号</div>
            <div className="col-span-2">颜色</div>
            <div className="col-span-2">尺码</div>
            <div className="col-span-2">数量</div>
            <div className="col-span-2">单价</div>
            <div className="col-span-1"></div>
          </div>

          {/* 行 */}
          {rows.map((row) => {
            const selectedProd = row.productId ? products.find((p) => p.id === row.productId) : null;
            const isNew = row.isNewProduct;
            return (
              <div key={row.id} className="border-b border-gray-50 last:border-0">
                <div className="grid grid-cols-12 gap-1 px-3 py-2 items-center text-xs">
                  {/* 款号 */}
                  <div className="col-span-3">
                    {isNew ? (
                      <input type="text" value={row.newSku || ''} onChange={(e) => updateRow(row.id, { newSku: e.target.value })}
                        placeholder="新款号" className="w-full px-1.5 py-1 bg-yellow-50 rounded border border-yellow-200 text-xs outline-none" />
                    ) : (
                      <select value={row.productId} onChange={(e) => handleProductSelect(row, e.target.value)}
                        className="w-full px-1 py-1 bg-gray-50 rounded border border-gray-100 text-xs outline-none">
                        <option value="">选择...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.sku}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {/* 颜色 */}
                  <div className="col-span-2">
                    {isNew ? (
                      <select value={row.newColor || ''} onChange={(e) => updateRow(row.id, { newColor: e.target.value })}
                        className="w-full px-1 py-1 bg-yellow-50 rounded border border-yellow-200 text-xs outline-none">
                        <option value="">选</option>
                        {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <span className="text-gray-700 px-1 truncate block">{selectedProd?.color || '-'}</span>
                    )}
                  </div>
                  {/* 尺码 */}
                  <div className="col-span-2">
                    {isNew ? (
                      <select value={row.newSize || ''} onChange={(e) => updateRow(row.id, { newSize: e.target.value })}
                        className="w-full px-1 py-1 bg-yellow-50 rounded border border-yellow-200 text-xs outline-none">
                        <option value="">选</option>
                        {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span className="text-gray-700 px-1 truncate block">{selectedProd?.size || '-'}</span>
                    )}
                  </div>
                  {/* 数量 */}
                  <div className="col-span-2">
                    <input type="number" value={row.quantity} onChange={(e) => updateRow(row.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full px-1 py-1 bg-gray-50 rounded border border-gray-100 text-xs outline-none text-center" min={1} />
                  </div>
                  {/* 单价 */}
                  <div className="col-span-2">
                    <input type="number" value={row.price} onChange={(e) => updateRow(row.id, { price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-1 py-1 bg-gray-50 rounded border border-gray-100 text-xs outline-none text-center" step="0.01" />
                  </div>
                  {/* 删除 */}
                  <div className="col-span-1 text-center">
                    <button onClick={() => deleteRow(row.id)} className="text-red-400 text-lg leading-none active:text-red-600">&times;</button>
                  </div>
                </div>

                {/* 全新款展开行 */}
                {isNew && (
                  <div className="px-3 pb-2">
                    <button onClick={() => setExpandedNew((p) => ({ ...p, [row.id]: !p[row.id] }))}
                      className="text-xs text-blue-500 mb-1">
                      {expandedNew[row.id] ? '收起详情' : '展开详情（类别/图片）'}
                    </button>
                    {expandedNew[row.id] && (
                      <div className="space-y-2 bg-yellow-50 rounded-lg p-2">
                        <div className="flex flex-wrap gap-1">
                          {CATEGORIES.map((cat) => (
                            <button key={cat} onClick={() => updateRow(row.id, { newCategory: cat })}
                              className={`px-2 py-0.5 rounded text-xs ${row.newCategory === cat ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}
                            >{cat}</button>
                          ))}
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mr-2">图片</label>
                          <input type="file" accept="image/*" capture="environment"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                const img = new Image();
                                img.onload = () => {
                                  const canvas = document.createElement('canvas');
                                  const max = 150;
                                  let w = img.width, h = img.height;
                                  if (w > max) { h = h * max / w; w = max; }
                                  if (h > max) { w = w * max / h; h = max; }
                                  canvas.width = w; canvas.height = h;
                                  canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
                                  updateRow(row.id, { newImage: canvas.toDataURL('image/jpeg', 0.6) });
                                };
                                img.src = reader.result as string;
                              };
                              reader.readAsDataURL(file);
                            }}
                            className="text-xs" />
                        </div>
                        {row.newImage && <img src={row.newImage} alt="预览" className="w-12 h-12 rounded object-cover" />}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 mt-2">
          <button onClick={addRow}
            className="flex-1 py-2 bg-white rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 active:bg-gray-50">
            + 添加一行
          </button>
          <button onClick={() => setShowPasteModal(true)}
            className="flex-1 py-2 bg-white rounded-xl border border-dashed border-blue-300 text-sm text-blue-500 active:bg-blue-50">
            📋 粘贴导入
          </button>
        </div>
        <div className="flex gap-2 mt-1">
          <button onClick={() => updateRow(rows[rows.length - 1].id, { isNewProduct: !rows[rows.length - 1].isNewProduct })}
            className="flex-1 py-2 bg-yellow-50 rounded-xl border border-yellow-200 text-sm text-yellow-700 active:bg-yellow-100">
            🆕 {rows[rows.length - 1].isNewProduct ? '切换为选择已有' : '最后一行改为全新款'}
          </button>
        </div>
      </div>

      {/* 提交 */}
      <div className="px-4">
        <button onClick={handleSubmit}
          className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 active:bg-blue-700 transition-colors">
          {isAdmin() ? `确认入库（${rows.filter(r => r.productId || r.isNewProduct).length} 款）` : '提交审核'}
        </button>
      </div>

      {/* 粘贴导入弹窗 */}
      {showPasteModal && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPasteModal(false)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5 space-y-3 animate-slide-up">
            <h3 className="font-semibold text-gray-900">粘贴导入</h3>
            <p className="text-xs text-gray-400">从 Excel 复制数据粘贴到下面（款号 图片链接 尺码 数量 单价）</p>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
              placeholder={"SKU-001\t\tM\t5\t99\nSKU-002\t\tL\t10\t128"}
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
