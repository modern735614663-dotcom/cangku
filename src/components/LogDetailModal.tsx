import type { OperationLog } from '../types';
import { formatTime } from '../utils/date';

interface Props {
  log: OperationLog;
  onClose: () => void;
}

export default function LogDetailModal({ log, onClose }: Props) {
  const typeLabel = log.type === 'inbound' ? '入库' : log.type === 'outbound' ? '出库' : '转仓';

  const typeColor =
    log.type === 'inbound'
      ? 'text-green-600 bg-green-50'
      : log.type === 'outbound'
      ? 'text-orange-600 bg-orange-50'
      : 'text-purple-600 bg-purple-50';

  const d = log.detail || {} as OperationLog['detail'];

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* 弹窗 */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[70vh] overflow-y-auto shadow-xl p-5 space-y-4 animate-slide-up">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 active:bg-gray-200"
        >
          ✕
        </button>

        {/* 标题 */}
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeColor}`}>
            {typeLabel}
          </span>
          <span className="text-sm font-semibold text-gray-900">
            {log.operator}
          </span>
        </div>

        {/* 时间 */}
        <div className="text-xs text-gray-400">{formatTime(log.timestamp)}</div>

        {/* 详情表格 */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
          {d.warehouse && (
            <div className="flex justify-between">
              <span className="text-gray-400">仓库</span>
              <span className="text-gray-900 font-medium">{d.warehouse}</span>
            </div>
          )}

          {d.fromWarehouse && d.toWarehouse && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-400">转出仓</span>
                <span className="text-gray-900 font-medium">{d.fromWarehouse}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">转入仓</span>
                <span className="text-gray-900 font-medium">{d.toWarehouse}</span>
              </div>
            </>
          )}

          {d.sku && (
            <div className="flex justify-between">
              <span className="text-gray-400">款号</span>
              <span className="text-gray-900 font-medium">{d.sku}</span>
            </div>
          )}

          {d.color && (
            <div className="flex justify-between">
              <span className="text-gray-400">颜色</span>
              <span className="text-gray-900">{d.color}</span>
            </div>
          )}

          {d.size && (
            <div className="flex justify-between">
              <span className="text-gray-400">尺码</span>
              <span className="text-gray-900">{d.size}</span>
            </div>
          )}

          <div className="flex justify-between border-t border-gray-200 pt-2">
            <span className="text-gray-400">数量</span>
            <span className="text-gray-900 font-bold text-lg">{d.quantity ?? 0} 件</span>
          </div>

          {d.sourceOrReason && (
            <div className="flex justify-between">
              <span className="text-gray-400">
                {log.type === 'inbound' ? '来源' : log.type === 'outbound' ? '理由' : '备注'}
              </span>
              <span className="text-gray-900">{d.sourceOrReason}</span>
            </div>
          )}
        </div>

        {/* 底部 */}
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-gray-100 text-gray-600 font-medium rounded-xl active:bg-gray-200"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
