import { useState } from 'react';
import { relativeTime } from '../utils/date';
import { showToast } from './Toast';
import type { OperationLog } from '../types';

interface Props {
  logs: OperationLog[];
  onLogClick: (log: OperationLog) => void;
  onRevoke: (logId: string) => boolean;
}

export default function OperationLogList({ logs, onLogClick, onRevoke }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (logs.length === 0) {
    return <div className="text-center py-8 text-gray-400 text-sm">暂无操作记录</div>;
  }

  const typeConfig = {
    inbound: { label: '入', bg: 'bg-green-500', badge: '入库', badgeBg: 'bg-green-100 text-green-700' },
    outbound: { label: '出', bg: 'bg-orange-500', badge: '出库', badgeBg: 'bg-orange-100 text-orange-700' },
    transfer: { label: '转', bg: 'bg-purple-500', badge: '转仓', badgeBg: 'bg-purple-100 text-purple-700' },
  };

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const cfg = typeConfig[log.type];
        const isRevoked = log.revoked;
        return (
          <div key={log.id} className={`bg-white rounded-xl px-4 py-3 shadow-sm ${isRevoked ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3">
              <button onClick={() => onLogClick(log)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm shrink-0 ${cfg.bg}`}>
                  {cfg.label}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{log.operator}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${cfg.badgeBg}`}>{cfg.badge}</span>
                    {isRevoked && <span className="text-xs text-red-500 bg-red-50 px-1 rounded">已撤销</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{log.summary}</div>
                </div>
                <span className="text-xs text-gray-400">{relativeTime(log.timestamp)}</span>
              </button>

              {/* 撤销按钮 */}
              {!isRevoked && (
                <div className="shrink-0">
                  {confirmId === log.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => { onRevoke(log.id); setConfirmId(null); showToast('已撤销', 'info'); }}
                        className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg font-medium">确认撤销</button>
                      <button onClick={() => setConfirmId(null)}
                        className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-lg font-medium">取消</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(log.id)}
                      className="text-xs text-gray-400 active:text-red-500 px-1">↩</button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
