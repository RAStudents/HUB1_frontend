import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '../api/client';
import type { AuthMeResponse, AuthResponse, User } from '../api/types';

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  loginWithYandex: (code: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
    const response = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    saveAuthResponse(response.data);
  };

  const register = async (email: string, password: string, displayName: string) => {
    const response = await apiClient.post<AuthResponse>('/auth/register', {
      email,
      password,
      name: displayName,
    });
    saveAuthResponse(response.data);
  };

  const loginWithYandex = async (code: string) => {
    const response = await apiClient.get<AuthResponse>('/auth/yandex/callback', { params: { code } });
    saveAuthResponse(response.data);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, loginWithYandex, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be inside AuthProvider');
  return context;
};