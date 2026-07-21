import type { WarehouseId } from '../types';

interface Props {
  value: 'all' | WarehouseId;
  onChange: (v: 'all' | WarehouseId) => void;
}

export default function WarehouseSwitcher({ value, onChange }: Props) {
  const options: Array<{ key: 'all' | WarehouseId; label: string }> = [
    { key: 'all', label: '合计' },
    { key: 'warehouse-a', label: 'TK仓' },
    { key: 'warehouse-b', label: '1688仓' },
  ];

  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
            value === opt.key
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
