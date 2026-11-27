// apps/web/src/api/types.ts

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  user_id: number | string;
  email: string;
  name: string;
}

export interface AuthMeResponse {
  user_id: number | string;
  email?: string;
  name?: string;
  avatar_url?: string | null;
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
  role: Exclude<Role, 'owner'>;
}

export interface DatasetMember {
  user_id: number;
  email: string;
  name: string;
  role: Role;
  status: 'pending' | 'accepted';
  notification_id?: number | null;
  email_notification_sent?: boolean | null;
}

export interface DatasetInvitation {
  dataset_id: string;
  dataset_name: string;
  role: Exclude<Role, 'owner'>;
  inviter_name: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  dataset_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPage {
  items: Notification[];
  total: number;
  unread_count: number;
  page: number;
  page_size: number;
}
