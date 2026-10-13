export type Role = "Admin" | "User";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

// Row in the admin "Users" table
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  productCount: number;
  categoryCount: number;
}
