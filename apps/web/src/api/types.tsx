// apps/web/src/api/types.ts

export interface User {
  id: string;
  email: string;
  display_name: string;
}

export interface AuthResponse {
  access_token: string;
  token_type?: string;
  user_id: number | string;
  email: string;
  name: string;
}

export interface AuthMeResponse {
  user_id: number | string;
}

export interface YandexLoginResponse {
  auth_url: string;
}

export type Task = 'detect' | 'obb' | 'segment';
export type Role = 'owner' | 'labeler' | 'observer';

export interface Dataset {
  id: string;
  name: string;
  task: Task;
  is_private: boolean;
  samples_count: number;
  is_owner: boolean;
  my_role?: Role;
}

export interface Member {
  id: string;
  user: User;
  role: Role;
  joined_at: string;
}

export interface InviteRequest {
  email: string;
  role: Role;
}