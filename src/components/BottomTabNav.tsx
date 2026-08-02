import { NavLink, useLocation } from 'react-router-dom';

export default function BottomTabNav() {
  const location = useLocation();

  const tabs = [
    { path: '/', label: '首页', icon: '📊' },
    { path: '/inventory', label: '库存', icon: '📦' },
    { path: '/inbound', label: '入库', icon: '📥' },
    { path: '/outbound', label: '出库', icon: '📤' },
    { path: '/transfer', label: '转仓', icon: '🔄' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
      <div className="flex justify-around items-center h-14 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = tab.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.path);
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors relative ${
                isActive ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="text-[10px] mt-0.5 font-medium leading-none">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
