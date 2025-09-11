export interface Device {
  id: number;
  hostname: string;
  os?: string;
  arch?: string;
  cpu?: string;
  mac_address?: string;
  disk_serial?: string;
  system_uuid?: string;
  motherboard_serial?: string;
  cpu_id?: string;
  is_blocked: boolean;
  created_at: string;
  last_signin: string;
}

export interface AdminSession {
  id: number;
  session_token: string;
  created_at: string;
  expires_at: string;
}

export interface DeviceSigninRequest {
  password: string;
  hostname: string;
  os?: string;
  arch?: string;
  cpu?: string;
  mac_address?: string;
  disk_serial?: string;
  system_uuid?: string;
  motherboard_serial?: string;
  cpu_id?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Env {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  API_PASSWORD: string;
}