export type UserRole = 'Superadmin' | 'Admin' | 'Technician' | 'Cashier';

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface AuthState {
  currentUser: UserAccount | null;
  isAuthenticated: boolean;
  users: UserAccount[];
  login: (username: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  addUser: (user: Omit<UserAccount, 'id' | 'created_at'>) => { success: boolean; error?: string };
  deleteUser: (id: string) => { success: boolean; error?: string };
}
