import { createBrowserRouter, Navigate, Outlet, Link, useNavigate } from 'react-router-dom';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from './api/client';
import { User, AuthResponse, AuthMeResponse } from './api/types';

import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';
import { ListPage } from './datasets/ListPage';
import { CreatePage } from './datasets/CreatePage';
import { MembersPage } from './datasets/MembersPage';

// ============ AUTH CONTEXT ============
interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    apiClient.get<AuthMeResponse>('/auth/me')
      .then(({ data }) => {
        const userId = String(data.user_id);
        const cachedUser = localStorage.getItem('auth_user');

        if (cachedUser) {
          try {
            const parsedUser = JSON.parse(cachedUser) as User;
            if (parsedUser.id === userId) {
              setUser(parsedUser);
              return;
            }
          } catch {
            localStorage.removeItem('auth_user');
          }
        }

        setUser({ id: userId, email: '', display_name: '' });
      })
      .catch(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('auth_user');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const saveAuthResponse = (response: AuthResponse) => {
    const nextUser: User = {
      id: String(response.user_id),
      email: response.email,
      display_name: response.name,
    };
    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('auth_user', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const login = async (email: string, password: string) => {
    const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    saveAuthResponse(res.data);
  };

  const register = async (email: string, password: string, displayName: string) => {
    const res = await apiClient.post<AuthResponse>('/auth/register', { email, password, name: displayName });
    saveAuthResponse(res.data);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};

// ============ LAYOUT ============
const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 text-2xl font-bold text-blue-600 border-b">HUB</div>
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/" className="block px-4 py-2 rounded hover:bg-gray-100 font-medium">
            Датасеты
          </Link>
        </nav>
        <div className="p-4 border-t">
          <div className="text-sm text-gray-500 mb-1 truncate">{user?.email}</div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded"
          >
            Выйти
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
};

// ============ ROUTE GUARDS ============
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const GuestRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Загрузка...</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// ============ ROUTER ============
export const router = createBrowserRouter([
  { path: '/login', element: <GuestRoute><LoginPage /></GuestRoute> },
  { path: '/register', element: <GuestRoute><RegisterPage /></GuestRoute> },
  {
    path: '/',
    element: <ProtectedRoute><Layout /></ProtectedRoute>,
    children: [
      { index: true, element: <ListPage /> },
      { path: 'datasets/create', element: <CreatePage /> },
      { path: 'datasets/:id/members', element: <MembersPage /> },
    ],
  },
]);

// В конец src/router.tsx, после объявления router

import { Role } from './api/types';

export const useRole = (datasetRole?: Role) => {
  return {
    isOwner: datasetRole === 'owner',
    isLabeler: datasetRole === 'labeler',
    isObserver: datasetRole === 'observer',
    canEdit: datasetRole === 'owner' || datasetRole === 'labeler',
    canInvite: datasetRole === 'owner',
    canExport: datasetRole === 'owner',
    canDelete: datasetRole === 'owner',
    canReview: datasetRole === 'owner',
  };
};