import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '../api/client';
import type { AuthMeResponse, AuthResponse, User } from '../api/types';

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  loginWithYandex: (code: string, state: string) => Promise<void>;
  updateProfile: (displayName: string) => Promise<User>;
  updateAvatar: (file: File) => Promise<User>;
  removeAvatar: () => Promise<User>;
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
              const nextUser = {
                ...parsedUser,
                email: data.email || parsedUser.email,
                display_name: data.name || parsedUser.display_name,
                avatar_url: data.avatar_url,
              };
              localStorage.setItem('auth_user', JSON.stringify(nextUser));
              setUser(nextUser);
              return;
            }
          } catch {
            localStorage.removeItem('auth_user');
          }
        }

        const nextUser = {
          id: userId,
          email: data.email || '',
          display_name: data.name || '',
          avatar_url: data.avatar_url,
        };
        localStorage.setItem('auth_user', JSON.stringify(nextUser));
        setUser(nextUser);
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
    void apiClient.get<AuthMeResponse>('/auth/me')
      .then(({ data }) => {
        const updatedUser = {
          ...nextUser,
          avatar_url: data.avatar_url,
          display_name: data.name || nextUser.display_name,
        };
        localStorage.setItem('auth_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      })
      .catch((error: unknown) => {
        console.error('Не удалось загрузить аватар профиля:', error);
      });
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

  const loginWithYandex = async (code: string, state: string) => {
    const response = await apiClient.get<AuthResponse>('/auth/yandex/callback', { params: { code, state } });
    saveAuthResponse(response.data);
  };

  const updateProfile = async (displayName: string) => {
    const response = await apiClient.patch<AuthMeResponse>('/auth/me', { name: displayName });
    const nextUser: User = {
      id: String(response.data.user_id),
      email: response.data.email || user?.email || '',
      display_name: response.data.name || user?.display_name || '',
      avatar_url: response.data.avatar_url,
    };
    localStorage.setItem('auth_user', JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

  const updateAvatar = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.put<AuthMeResponse>('/auth/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const nextUser: User = {
      id: String(response.data.user_id),
      email: response.data.email || user?.email || '',
      display_name: response.data.name || user?.display_name || '',
      avatar_url: response.data.avatar_url,
    };
    localStorage.setItem('auth_user', JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

  const removeAvatar = async () => {
    const response = await apiClient.delete<AuthMeResponse>('/auth/me/avatar');
    const nextUser: User = {
      id: String(response.data.user_id),
      email: response.data.email || user?.email || '',
      display_name: response.data.name || user?.display_name || '',
      avatar_url: response.data.avatar_url,
    };
    localStorage.setItem('auth_user', JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      loginWithYandex,
      updateProfile,
      updateAvatar,
      removeAvatar,
      logout,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be inside AuthProvider');
  return context;
};