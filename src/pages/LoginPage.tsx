import { useState } from 'react';
import { useStore } from '../store';
import { showToast } from '../components/Toast';

interface Props {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const login = useStore((s) => s.login);
  const register = useStore((s) => s.register);

  const handleSubmit = () => {
    if (!username.trim() || !password.trim()) {
      showToast('请填写用户名和密码', 'error');
      return;
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        showToast('两次密码不一致', 'error');
        return;
      }
      if (password.length < 4) {
        showToast('密码至少4位', 'error');
        return;
      }
      const user = register(username.trim(), password);
      if (user) {
        showToast('注册成功！', 'success');
        onLogin();
      } else {
        showToast('用户名已存在', 'error');
      }
    } else {
      const user = login(username.trim(), password);
      if (user) {
        showToast(`欢迎，${user.username}！`, 'success');
        onLogin();
      } else {
        showToast('用户名或密码错误', 'error');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className="text-4xl hidden">🏷️</span>
          </div>
          <h1 className="text-2xl font-bold text-white">紫城服饰仓库管理系统</h1>
          <p className="text-slate-400 text-sm mt-1">
            {mode === 'login' ? '登录您的账号' : '创建新账号'}
          </p>
        </div>

        {/* 表单 */}
        <div className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-300"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-300"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">确认密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            onClick={handleSubmit}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl active:bg-blue-700 transition-colors"
          >
            {mode === 'login' ? '登 录' : '注 册'}
          </button>

          <div className="text-center">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setConfirmPassword('');
              }}
              className="text-sm text-blue-600"
            >
              {mode === 'login' ? '没有账号？点击注册' : '已有账号？点击登录'}
            </button>
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-4">
          管理员账号: admin / admin123
        </p>
        <button
          onClick={() => {
            localStorage.clear();
            window.location.reload();
          }}
          className="w-full mt-3 py-2 text-xs text-red-400 border border-red-200 rounded-xl active:bg-red-50"
        >
          重置所有数据
        </button>
      </div>
    </div>
  );
}
