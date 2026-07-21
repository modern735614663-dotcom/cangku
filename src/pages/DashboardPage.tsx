import { useState, useMemo } from 'react';
import { useStore } from '../store';
import WarehouseSwitcher from '../components/WarehouseSwitcher';
import StatCard from '../components/StatCard';
import OperationLogList from '../components/OperationLogList';
import LogDetailModal from '../components/LogDetailModal';
import {
  calcTotalStock, calcStockByWarehouse, calcTotalOutbound,
  calcOutboundValue, calcTrendComparison, calcTotalValue, calcTotalInbound,
} from '../utils/stats';
import type { WarehouseId, Period, ChartGranularity, OperationLog } from '../types';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'today', label: '今日' }, { key: 'yesterday', label: '昨日' },
  { key: 'thisWeek', label: '本周' }, { key: 'lastWeek', label: '上周' },
  { key: 'thisMonth', label: '本月' }, { key: 'lastMonth', label: '上月' },
  { key: 'thisYear', label: '今年' },
];

const GRANULARITIES: Array<{ key: ChartGranularity; label: string }> = [
  { key: 'day', label: '日' }, { key: 'week', label: '周' },
  { key: 'month', label: '月' }, { key: 'halfYear', label: '半年' },
  { key: 'year', label: '年' },
];

export default function DashboardPage() {
  const [warehouse, setWarehouse] = useState<'all' | WarehouseId>('all');
  const [granularity, setGranularity] = useState<ChartGranularity>('day');
  const [selectedLog, setSelectedLog] = useState<OperationLog | null>(null);

  const products = useStore((s) => s.products);
  const inventories = useStore((s) => s.inventories);
  const outboundDocs = useStore((s) => s.outboundDocs);
  const inboundDocs = useStore((s) => s.inboundDocs);
  const operationLogs = useStore((s) => s.operationLogs);
  const currentUser = useStore((s) => s.currentUser);
  const revokeOperation = useStore((s) => s.revokeOperation);

  const warehouseId = warehouse === 'all' ? undefined : warehouse;

  const recentLogs = useMemo(() => operationLogs.slice(0, 50), [operationLogs]);
  const totalStock = useMemo(() => calcTotalStock(inventories, warehouseId), [inventories, warehouseId]);
  const totalValue = useMemo(() => calcTotalValue(products, inventories, warehouseId), [products, inventories, warehouseId]);
  const stockByWarehouse = useMemo(() => calcStockByWarehouse(inventories), [inventories]);
  const valueByWarehouse = useMemo(() => ({
    'warehouse-a': calcTotalValue(products, inventories, 'warehouse-a'),
    'warehouse-b': calcTotalValue(products, inventories, 'warehouse-b'),
  }), [products, inventories]);

  const outboundStats = useMemo(() =>
    PERIODS.map((p) => ({
      ...p, value: calcTotalOutbound(outboundDocs, p.key, warehouseId),
      valueAmount: calcOutboundValue(products, outboundDocs, p.key, warehouseId),
    })),
    [outboundDocs, warehouseId, products]
  );

  const inboundStats = useMemo(() =>
    PERIODS.map((p) => ({
      ...p, value: calcTotalInbound(inboundDocs, p.key, warehouseId),
    })),
    [inboundDocs, warehouseId]
  );

  const trendSeries = useMemo(
    () => calcTrendComparison(outboundDocs, granularity, warehouseId),
    [outboundDocs, granularity, warehouseId]
  );

  // 合并趋势数据供 Recharts 使用
  const trendChartData = useMemo(() =>
    trendSeries.labels.map((label, i) => ({
      label,
      本期: trendSeries.current[i],
      [trendSeries.compareLabel]: trendSeries.compare[i],
    })),
    [trendSeries]
  );

  const stockLabel = warehouse === 'all'
    ? `TK仓 ${stockByWarehouse['warehouse-a']} | 1688仓 ${stockByWarehouse['warehouse-b']}`
    : `${warehouse === 'warehouse-a' ? 'TK仓' : '1688仓'} 库存`;

  const valueLabel = warehouse === 'all'
    ? `TK仓 ¥${valueByWarehouse['warehouse-a'].toLocaleString()} | 1688仓 ¥${valueByWarehouse['warehouse-b'].toLocaleString()}`
    : `${warehouse === 'warehouse-a' ? 'TK仓' : '1688仓'} 价值`;

  return (
    <div className="pb-20 space-y-4">
      {currentUser && (
        <div className="px-4 pt-3">
          <div className="text-xs text-gray-500">
            欢迎，<span className="font-semibold text-gray-700">{currentUser.username}</span>
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${currentUser.role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
              {currentUser.role === 'admin' ? '管理员' : '操作员'}
            </span>
          </div>
        </div>
      )}

      <div className="px-4">
        <WarehouseSwitcher value={warehouse} onChange={setWarehouse} />
      </div>

      {/* 库存量 + 库存价值 双卡片 */}
      <div className="px-4 grid grid-cols-2 gap-3">
        <StatCard title="总库存量" value={totalStock.toLocaleString() + ' 件'} subtitle={stockLabel} icon="📋" />
        <StatCard title="库存总价值" value={'¥' + totalValue.toLocaleString()} subtitle={valueLabel} icon="💰" />
      </div>

      {/* 出库统计 */}
      <div className="px-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">📤</span>
            <span className="text-xs text-gray-500 font-medium">出库统计</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {outboundStats.map((s) => (
              <div key={s.key} className="text-center">
                <div className="text-xs text-gray-400">{s.label}</div>
                <div className="text-base font-bold text-gray-900">{s.value}</div>
                <div className="text-[10px] text-gray-400">¥{s.valueAmount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 入库统计 */}
      <div className="px-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">📥</span>
            <span className="text-xs text-gray-500 font-medium">入库统计</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {inboundStats.map((s) => (
              <div key={s.key} className="text-center">
                <div className="text-xs text-gray-400">{s.label}</div>
                <div className="text-base font-bold text-gray-900">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 趋势对比图 */}
      <div className="px-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 font-medium">📈 出库趋势</span>
            <div className="flex gap-1">
              {GRANULARITIES.map((g) => (
                <button key={g.key} onClick={() => setGranularity(g.key)}
                  className={`px-2.5 py-1 text-xs rounded-full transition-all ${granularity === g.key ? 'bg-blue-600 text-white' : 'text-gray-500 bg-gray-100'}`}
                >{g.label}</button>
              ))}
            </div>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colCur" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colCmp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="本期" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colCur)" />
                <Area type="monotone" dataKey={trendSeries.compareLabel} stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colCmp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 操作记录 */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">📝</span>
          <span className="text-xs text-gray-500 font-medium">操作记录（点击查看详情）</span>
        </div>
        <OperationLogList logs={recentLogs} onLogClick={setSelectedLog} onRevoke={revokeOperation} />
      </div>

      {selectedLog && (
        <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
