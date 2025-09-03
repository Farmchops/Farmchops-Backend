import { IUser } from '../models/User';

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user?: Omit<IUser, "password">;
    token?: string;
  };
}

export interface ResetCodeResponse {
  success: boolean;
  message: string;
  data?: {
    resetCode?: string;
  };
}

export interface ProfileResponse {
  success: boolean;
  message: string;
  data?: {
    user?: Omit<IUser, "password">;
  };
}
