import { useState } from 'react';

interface Props {
  products: Array<{ id: string; sku: string; color: string; size: string; stock: number; image?: string }>;
  selectedId: string | null;
  onSelect: (productId: string) => void;
  showStock?: boolean;
  placeholder?: string;
}

export default function ProductPicker({
  products,
  selectedId,
  onSelect,
  showStock = true,
  placeholder = '搜索款号...',
}: Props) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = search
    ? products.filter(
        (p) =>
          p.sku.toLowerCase().includes(search.toLowerCase()) ||
          p.color.includes(search) ||
          p.size.includes(search)
      )
    : products;

  const selected = products.find((p) => p.id === selectedId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 text-left min-h-12"
      >
        {selected ? (
          <>
            {selected.image && (
              <img
                src={selected.image}
                alt={selected.sku}
                className="w-10 h-10 rounded-lg object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">{selected.sku}</div>
              <div className="text-sm text-gray-500">
                {selected.color} / {selected.size}
                {showStock && (
                  <span className="ml-2 text-blue-600">库存: {selected.stock}</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <span className="text-gray-400">点击选择货品</span>
        )}
        <span className="text-gray-400 ml-auto">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-64 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                {search ? '无匹配货品' : '暂无可选货品'}
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p.id);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                    p.id === selectedId ? 'bg-blue-50' : ''
                  }`}
                >
                  {p.image && (
                    <img
                      src={p.image}
                      alt={p.sku}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                  )}
                  {!p.image && (
                    <div className="w-10 h-10 rounded-lg bg-gray-200 shrink-0 flex items-center justify-center text-gray-400 text-xs">
                      无图
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">
                      {p.sku}
                    </div>
                    <div className="text-xs text-gray-500">
                      {p.color} / {p.size}
                    </div>
                  </div>
                  {showStock && (
                    <span className="text-sm font-medium text-blue-600 shrink-0">
                      {p.stock}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
