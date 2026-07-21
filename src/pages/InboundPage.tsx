import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { showToast } from '../components/Toast';
import { COLORS, SIZES, CATEGORIES, INBOUND_SOURCES, WAREHOUSES } from '../types';
import type { WarehouseId, BatchRow } from '../types';
import { generateId } from '../utils/id';

function emptyRow(): BatchRow {
  const sizes: Record<string, number> = {};
  for (const s of SIZES) sizes[s] = 0;
  return { id: generateId(), productId: '', color: '', sizes: { ...sizes }, price: 0 };
}

export default function InboundPage() {
  const navigate = useNavigate();
  const products = useStore((s) => s.products);
  const currentUser = useStore((s) => s.currentUser);
  const submitInbound = useStore((s) => s.submitInbound);
  const isAdmin = useStore((s) => s.isAdmin);

  const [warehouseId, setWarehouseId] = useState<WarehouseId>('warehouse-a');
  const [source, setSource] = useState('采购');
  const [rows, setRows] = useState<BatchRow[]>([emptyRow()]);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [expandedNew, setExpandedNew] = useState<Record<string, boolean>>({});

  const updateRow = (id: string, patch: Partial<BatchRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const updateSize = (id: string, size: string, qty: number) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, sizes: { ...r.sizes, [size]: qty } } : r));
  };
  const deleteRow = (id: string) => { if (rows.length <= 1) return; setRows((prev) => prev.filter((r) => r.id !== id)); };
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const handleProductSelect = (row: BatchRow, productId: string) => {
    if (!productId) { updateRow(row.id, { productId: '', color: '', isNewProduct: false }); return; }
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      updateRow(row.id, { productId, color: prod.color, price: prod.price, isNewProduct: false });
    }
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
      // Parse cols[2..] as size quantities
      const sizeList = Array.from(SIZES);
      for (let i = 0; i < sizeList.length; i++) {
        sizes[sizeList[i]] = parseInt(cols[2 + i]) || 0;
      }
      const pasteColor = cols[1]?.trim() || '';
      const price = parseFloat(cols[cols.length - 1]) || 0;
      const existing = products.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
      if (existing) {
        newRows.push({ id: generateId(), productId: existing.id, color: pasteColor || existing.color, sizes: { ...sizes }, price: price || existing.price });
      } else {
        newRows.push({ id: generateId(), productId: '', color: pasteColor, sizes: { ...sizes }, price, isNewProduct: true, newSku: sku });
      }
    }
    if (newRows.length > 0) { setRows((prev) => [...prev, ...newRows]); showToast(`已导入 ${newRows.length} 行`, 'success'); }
    else { showToast('未能解析数据', 'error'); }
    setShowPasteModal(false); setPasteText('');
  };

  const handleSubmit = async () => {
    const validRows = rows.filter((r) => {
      if (r.isNewProduct) return r.newSku && r.color && Object.values(r.sizes).some(v => v > 0);
      return r.productId && Object.values(r.sizes).some(v => v > 0);
    });
    if (validRows.length === 0) { showToast('请至少填写一个尺码数量', 'error'); return; }

    // 构建 items
    const items: Array<{ productId: string; quantity: number; price: number; isNewProduct?: boolean; newProductData?: any }> = [];
    for (const row of validRows) {
      const finalColor = row.color === '其他' ? (row.customColor || '其他') : row.color;
      for (const [size, qty] of Object.entries(row.sizes)) {
        if (qty <= 0) continue;
        const finalSize = size === '其他' && row.customSize ? row.customSize : size;
        if (row.isNewProduct && row.newSku) {
          items.push({ productId: '', quantity: qty, price: row.price, isNewProduct: true,
            newProductData: { sku: row.newSku, category: row.newCategory || '其他', color: finalColor, size: finalSize, price: row.price, image: row.newImage } });
        } else {
          // 已有货品按尺码查找对应的 productId
          const prod = products.find((p) => p.id === row.productId);
          if (prod) {
            const sp = products.find((p) => p.sku === prod.sku && p.color === finalColor && p.size === finalSize);
            items.push({ productId: sp?.id || row.productId, quantity: qty, price: row.price });
          } else {
            items.push({ productId: row.productId, quantity: qty, price: row.price });
          }
        }
      }
    }
    if (items.length === 0) { showToast('请至少填写一个尺码数量', 'error'); return; }

    const error = await submitInbound({ source, warehouseId, items });
    if (error) { showToast(error, "error"); return; }
    showToast(isAdmin() ? "入库成功！" : "已提交审核", "success");
    navigate("/");
    navigate('/');
  };

  const getRowTotalQty = (row: BatchRow) => Object.values(row.sizes).reduce((s, v) => s + v, 0);

  return (
    <div className="pb-20 space-y-3">
      <div className="px-4 pt-3 space-y-2">
        <div className="bg-blue-50 rounded-xl px-3 py-1.5 text-sm text-blue-700 flex items-center gap-2">
          <span>👤 {currentUser?.username}</span>
          {!isAdmin() && <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">需审核</span>}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {WAREHOUSES.map((w) => (
            <button key={w} onClick={() => setWarehouseId(w)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${warehouseId === w ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >{w === 'warehouse-a' ? 'TK仓' : '1688仓'}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {INBOUND_SOURCES.map((s) => (
            <button key={s} onClick={() => setSource(s)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${source === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* 批量行 */}
      <div className="px-4 space-y-3">
        {rows.map((row, idx) => {
          const isNew = row.isNewProduct;
          const prod = row.productId ? products.find((p) => p.id === row.productId) : null;
          const totalQty = getRowTotalQty(row);

          return (
            <div key={row.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* 行头：款号 + 颜色 */}
              <div className="px-3 py-2 bg-gray-50 flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5">#{idx + 1}</span>
                {isNew ? (
                  <input type="text" value={row.newSku || ''} onChange={(e) => updateRow(row.id, { newSku: e.target.value })}
                    placeholder="输入新款号" className="flex-1 px-2 py-1 bg-yellow-50 rounded border border-yellow-200 text-xs outline-none" />
                ) : (
                  <div className="flex-1 relative">
                  <input type="text" value={row.search || ''}
                    onChange={(e) => updateRow(row.id, { search: e.target.value })}
                    placeholder="🔍 搜索款号" className="w-full px-1 py-1 bg-white rounded border border-gray-200 text-xs outline-none" />
                  {(row.search && row.search.length > 0) && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-32 overflow-y-auto">
                      {products.filter((p) => p.sku.toLowerCase().includes(row.search!.toLowerCase()) || p.color.includes(row.search!)).slice(0, 20).map((p) => (
                        <button key={p.id} type="button" onClick={() => { handleProductSelect(row, p.id); updateRow(row.id, { search: '' }); }}
                          className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0">
                          {p.sku} <span className="text-gray-400">{p.color}/{p.size} ¥{p.price}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {/* 颜色 */}
                <div className="flex items-center gap-1">
                  <select value={isNew ? (row.color || '') : (prod?.color || '')} onChange={(e) => {
                    if (isNew) updateRow(row.id, { color: e.target.value });
                  }}
                    className={`px-1 py-1 rounded border text-xs outline-none w-14 ${isNew ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-100 border-gray-100 text-gray-500'}`}
                    disabled={!isNew}>
                    <option value="">色</option>
                    {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* 单价 */}
                <input type="number" value={row.price} onChange={(e) => updateRow(row.id, { price: parseFloat(e.target.value) || 0 })}
                  className="w-14 px-1 py-1 bg-white rounded border border-gray-200 text-xs outline-none text-center" placeholder="单价" step="0.01" />

                <button onClick={() => deleteRow(row.id)} className="text-red-400 text-lg leading-none shrink-0">&times;</button>
              </div>

              {/* 颜色自定义输入 */}
              {(row.color === '其他' || (isNew && row.color === '其他')) && (
                <div className="px-3 py-1 bg-yellow-50">
                  <input type="text" value={row.customColor || ''} onChange={(e) => updateRow(row.id, { customColor: e.target.value })}
                    placeholder="输入颜色名称" className="w-full px-2 py-1 bg-white rounded border border-yellow-200 text-xs outline-none" />
                </div>
              )}

              {/* 全新款展开 */}
              {isNew && (
                <div className="px-3 pb-1">
                  <button onClick={() => setExpandedNew((p) => ({ ...p, [row.id]: !p[row.id] }))}
                    className="text-xs text-blue-500">
                    {expandedNew[row.id] ? '收起' : '类别/图片'}
                  </button>
                  {expandedNew[row.id] && (
                    <div className="mt-1 p-2 bg-yellow-50 rounded-lg space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {CATEGORIES.map((cat) => (
                          <button key={cat} onClick={() => updateRow(row.id, { newCategory: cat })}
                            className={`px-2 py-0.5 rounded text-xs ${row.newCategory === cat ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}
                          >{cat}</button>
                        ))}
                      </div>
                      <div className="h-28 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white relative overflow-hidden">
                        <input type="file" accept="image/*" capture="environment"
                          onChange={(e) => {
                            const file = e.target.files?.[0]; if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              const img = new Image(); img.onload = () => {
                                const canvas = document.createElement('canvas');
                                const max = 200; let w = img.width, h = img.height;
                                if (w > max) { h = h * max / w; w = max; }
                                if (h > max) { w = w * max / h; h = max; }
                                canvas.width = w; canvas.height = h;
                                canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
                                updateRow(row.id, { newImage: canvas.toDataURL('image/jpeg', 0.6) });
                              }; img.src = reader.result as string;
                            }; reader.readAsDataURL(file);
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer" />
                        {row.newImage ? (
                          <img src={row.newImage} alt="预览" className="w-16 h-16 rounded-lg object-cover" />
                        ) : (
                          <span className="text-gray-400 text-xs">点击上传图片</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 尺码网格 */}
              <div className="px-3 py-2 grid grid-cols-3 gap-1">
                {Array.from(SIZES).map((size) => {
                  const val = row.sizes[size] || 0;
                  return (
                    <div key={size} className="flex items-center gap-0.5">
                      <span className="text-[10px] text-gray-400 w-5 text-right shrink-0">{size}</span>
                      <input type="number" value={val}
                        onChange={(e) => updateSize(row.id, size, Math.max(0, parseInt(e.target.value) || 0))}
                        className="flex-1 px-1 py-1 bg-gray-50 rounded border border-gray-100 text-xs outline-none text-center min-w-0" min={0} />
                      {size === '其他' && val > 0 && (
                        <input type="text" value={row.customSize || ''}
                          onChange={(e) => updateRow(row.id, { customSize: e.target.value })}
                          placeholder="码名" className="w-10 px-1 py-1 bg-yellow-50 rounded border border-yellow-200 text-[10px] outline-none" />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="px-3 pb-2 text-[10px] text-gray-400">
                合计 {totalQty} 件
                {!isNew && (
                  <button onClick={() => updateRow(row.id, { isNewProduct: true, color: '', newSku: '', newCategory: '' })}
                    className="ml-2 text-red-400">切换为录入新款</button>
                )}
                {isNew && (
                  <button onClick={() => updateRow(row.id, { isNewProduct: false, newSku: '', newCategory: '', newImage: undefined })}
                    className="ml-2 text-blue-400">切换为选择已有</button>
                )}
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
          {isAdmin() ? '确认入库' : '提交审核'}
        </button>
      </div>

      {showPasteModal && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPasteModal(false)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5 space-y-3 animate-slide-up">
            <h3 className="font-semibold">粘贴导入</h3>
            <p className="text-xs text-gray-400">款号\t颜色\t各尺码数量(6列: S/M/L/XL/XXL/其他)\t单价</p>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
              className="w-full h-32 px-3 py-2 bg-gray-50 rounded-xl border text-xs outline-none resize-none"
              placeholder={"SKU-001\t黑色\t5\t10\t0\t20\t0\t0\t128"} />
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
