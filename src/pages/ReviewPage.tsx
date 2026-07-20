import { useStore } from '../store';
import { showToast } from '../components/Toast';
import { WAREHOUSE_LABELS } from '../types';
import { formatTime } from '../utils/date';

export default function ReviewPage() {
  const pendingDocs = useStore((s) => s.pendingDocs);
  const products = useStore((s) => s.products);
  const currentUser = useStore((s) => s.currentUser);
  const approvePending = useStore((s) => s.approvePending);
  const rejectPending = useStore((s) => s.rejectPending);

  const getProduct = (pid: string) => products.find((p) => p.id === pid);

  const handleApprove = (id: string) => {
    const ok = approvePending(id, currentUser?.username || 'admin');
    if (ok) {
      showToast('已通过审核', 'success');
    } else {
      showToast('审核失败（可能库存不足）', 'error');
    }
  };

  const handleReject = (id: string) => {
    rejectPending(id, currentUser?.username || 'admin');
    showToast('已驳回', 'info');
  };

  const pending = pendingDocs.filter((d) => d.status === 'pending');

  return (
    <div className="pb-20 space-y-3">
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span className="font-semibold text-gray-900">审核队列</span>
          <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
            {pending.length}
          </span>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="px-4 text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">✅</div>
          <p>暂无待审核单据</p>
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {pending.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
              {/* 单据头 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      doc.type === 'inbound'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {doc.type === 'inbound' ? '入库' : '出库'}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {doc.username}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {formatTime(doc.createdAt)}
                </span>
              </div>

              {/* 详情 */}
              <div className="text-sm text-gray-600 space-y-1 bg-gray-50 rounded-lg p-3">
                <div>
                  <span className="text-gray-400">仓库：</span>
                  {WAREHOUSE_LABELS[doc.warehouseId]}
                </div>
                <div>
                  <span className="text-gray-400">
                    {doc.type === 'inbound' ? '来源：' : '理由：'}
                  </span>
                  {doc.type === 'inbound' ? (doc.source || '无') : (doc.reason || '无')}
                </div>
                <div>
                  <span className="text-gray-400">明细：</span>
                </div>
                {doc.items.map((item, i) => {
                  const prod = getProduct(item.productId);
                  const isNew = item.isNewProduct && item.newProductData;
                  return (
                    <div key={i} className="ml-3 text-xs">
                      {isNew
                        ? `🆕 全新款: ${item.newProductData!.sku} ${item.newProductData!.color}/${item.newProductData!.size}`
                        : prod
                        ? `${prod.sku} ${prod.color}/${prod.size}`
                        : `货品ID: ${item.productId}`}
                      {' × '}
                      <span className="font-semibold">{item.quantity}</span> 件
                    </div>
                  );
                })}
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(doc.id)}
                  className="flex-1 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl active:bg-green-700"
                >
                  ✓ 通过
                </button>
                <button
                  onClick={() => handleReject(doc.id)}
                  className="flex-1 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl active:bg-red-600"
                >
                  ✗ 驳回
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 已处理单据 */}
      {pendingDocs.filter((d) => d.status !== 'pending').length > 0 && (
        <>
          <div className="px-4 pt-4">
            <span className="text-sm text-gray-500 font-medium">已处理</span>
          </div>
          <div className="px-4 space-y-2">
            {pendingDocs
              .filter((d) => d.status !== 'pending')
              .sort((a, b) => (b.reviewedAt || 0) - (a.reviewedAt || 0))
              .map((doc) => (
                <div
                  key={doc.id}
                  className={`bg-white rounded-xl p-3 shadow-sm border-l-4 ${
                    doc.status === 'approved' ? 'border-green-500' : 'border-red-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full ${
                          doc.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {doc.status === 'approved' ? '已通过' : '已驳回'}
                      </span>
                      <span className="text-sm text-gray-700">
                        {doc.type === 'inbound' ? '入库' : '出库'} - {doc.username}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {doc.reviewedAt ? formatTime(doc.reviewedAt) : ''}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
