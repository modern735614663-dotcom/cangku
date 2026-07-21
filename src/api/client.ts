// API 客户端 - 封装 fetch + JWT token 管理

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'warehouse-token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      clearToken();
    }

    const json = await res.json();
    if (!res.ok) {
      return { error: json.error || `请求失败 (${res.status})` };
    }
    return { data: json };
  } catch (e: any) {
    return { error: e.message || '网络错误，请检查服务器连接' };
  }
}

// HTTP 方法封装
export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};

export { getToken, setToken, clearToken, BASE_URL };
