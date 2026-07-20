import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import InboundPage from './pages/InboundPage';
import OutboundPage from './pages/OutboundPage';
import TransferPage from './pages/TransferPage';
import ReviewPage from './pages/ReviewPage';
import LoginPage from './pages/LoginPage';
import BottomTabNav from './components/BottomTabNav';
import ToastContainer from './components/Toast';
import { useStore } from './store';

const TITLES: Record<string, string> = {
  '/': '紫城服饰仓库管理系统',
  '/inventory': '紫城服饰库存查询',
  '/inbound': '入库操作',
  '/outbound': '紫城服饰出库操作',
  '/transfer': '转仓操作',
  '/review': '审核管理',
};

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const loadFromStorage = useStore((s) => s.loadFromStorage);
  const currentUser = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);
  const isAdmin = useStore((s) => s.isAdmin);
  const pendingDocs = useStore((s) => s.pendingDocs);

  useEffect(() => {
    loadFromStorage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 未登录 → 登录页
  if (!currentUser) {
    return (
      <>
        <LoginPage onLogin={() => {}} />
        <ToastContainer />
      </>
    );
  }

  const title = TITLES[location.pathname] || '仓库管理';
  const pendingCount = pendingDocs.filter((d) => d.status === 'pending').length;

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 relative">
      {/* 顶部标题栏 */}
      <header className="sticky top-0 z-40 bg-slate-800 px-4 py-3 text-white shadow-md">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <div className="flex items-center gap-2">
            {isAdmin() && pendingCount > 0 && (
              <button onClick={() => navigate('/review')}
                className="relative bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                审核 {pendingCount}
              </button>
            )}
            <button onClick={() => { logout(); navigate('/'); }}
              className="text-xs text-slate-300 hover:text-white">
              退出
            </button>
          </div>
        </div>
      </header>

      <main style={{ minHeight: 'calc(100vh - 56px - 56px)' }}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/inbound" element={<InboundPage />} />
          <Route path="/outbound" element={<OutboundPage />} />
          <Route path="/transfer" element={<TransferPage />} />
          <Route path="/review" element={isAdmin() ? <ReviewPage /> : <DashboardPage />} />
        </Routes>
      </main>

      <BottomTabNav />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
