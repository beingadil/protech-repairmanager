import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AuthState, UserAccount, UserRole } from '../types/auth';

const DEFAULT_SUPERADMIN: UserAccount = {
  id: 'user-superadmin-initial',
  username: 'admin',
  password: 'admin123',
  name: 'Administrator',
  role: 'Superadmin',
  created_at: new Date().toISOString()
};

interface ExtendedAuthState extends AuthState {
  updateUserPassword: (id: string, newPassword: string) => { success: boolean; error?: string };
  updateUserProfile: (id: string, updates: { name?: string; role?: UserRole }) => { success: boolean; error?: string };
}

export const useAuthStore = create<ExtendedAuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,
      users: [DEFAULT_SUPERADMIN],

      login: (username, password) => {
        const cleanUsername = username.trim().toLowerCase();
        const cleanPassword = password.trim();

        // Ensure at least one admin exists if list is empty for any reason
        let stateUsers = get().users;
        if (!stateUsers || stateUsers.length === 0) {
          stateUsers = [DEFAULT_SUPERADMIN];
        }

        const foundUser = stateUsers.find(
          (u) => u.username.toLowerCase() === cleanUsername
        );

        if (!foundUser) {
          return { success: false, error: 'Invalid username or password.' };
        }

        if (foundUser.password !== cleanPassword) {
          return { success: false, error: 'Invalid username or password.' };
        }

        set({
          currentUser: foundUser,
          isAuthenticated: true,
          users: stateUsers
        });

        return { success: true };
      },

      logout: () => {
        set({
          currentUser: null,
          isAuthenticated: false
        });
      },

      addUser: (userData) => {
        const cleanUsername = userData.username.trim().toLowerCase();
        if (!cleanUsername || !userData.password || !userData.name) {
          return { success: false, error: 'Username, Name, and Password are all required.' };
        }

        const stateUsers = get().users || [DEFAULT_SUPERADMIN];
        const exists = stateUsers.some(
          (u) => u.username.toLowerCase() === cleanUsername
        );

        if (exists) {
          return { success: false, error: `Username '${cleanUsername}' already exists.` };
        }

        const newUser: UserAccount = {
          id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          username: cleanUsername,
          password: userData.password.trim(),
          name: userData.name.trim(),
          role: userData.role || 'Technician',
          created_at: new Date().toISOString()
        };

        set((state) => ({
          users: [...(state.users || [DEFAULT_SUPERADMIN]), newUser]
        }));

        return { success: true };
      },

      updateUserPassword: (id, newPassword) => {
        const cleanPassword = newPassword.trim();
        if (!cleanPassword || cleanPassword.length < 4) {
          return { success: false, error: 'Password must be at least 4 characters long.' };
        }

        const stateUsers = get().users || [DEFAULT_SUPERADMIN];
        const userIndex = stateUsers.findIndex((u) => u.id === id);

        if (userIndex === -1) {
          return { success: false, error: 'User account not found.' };
        }

        const updatedUsers = [...stateUsers];
        updatedUsers[userIndex] = {
          ...updatedUsers[userIndex],
          password: cleanPassword
        };

        const current = get().currentUser;
        set({
          users: updatedUsers,
          currentUser: current && current.id === id ? updatedUsers[userIndex] : current
        });

        return { success: true };
      },

      updateUserProfile: (id, updates) => {
        const stateUsers = get().users || [DEFAULT_SUPERADMIN];
        const userIndex = stateUsers.findIndex((u) => u.id === id);

        if (userIndex === -1) {
          return { success: false, error: 'User account not found.' };
        }

        const updatedUsers = [...stateUsers];
        updatedUsers[userIndex] = {
          ...updatedUsers[userIndex],
          name: updates.name ? updates.name.trim() : updatedUsers[userIndex].name,
          role: updates.role ? updates.role : updatedUsers[userIndex].role
        };

        const current = get().currentUser;
        set({
          users: updatedUsers,
          currentUser: current && current.id === id ? updatedUsers[userIndex] : current
        });

        return { success: true };
      },

      deleteUser: (id) => {
        const stateUsers = get().users || [DEFAULT_SUPERADMIN];
        const targetUser = stateUsers.find((u) => u.id === id);

        if (!targetUser) {
          return { success: false, error: 'User account not found.' };
        }

        // Safeguard: Ensure at least one Superadmin account exists
        const superadminCount = stateUsers.filter((u) => u.role === 'Superadmin').length;
        if (targetUser.role === 'Superadmin' && superadminCount <= 1) {
          return { success: false, error: 'Cannot delete the only Superadmin account in the system.' };
        }

        const current = get().currentUser;
        if (current && current.id === id) {
          return { success: false, error: 'Cannot delete your own active session account. Log into another admin account first.' };
        }

        set((state) => ({
          users: state.users.filter((u) => u.id !== id)
        }));

        return { success: true };
      }
    }),
    {
      name: 'protech_auth_store',
      storage: createJSONStorage(() => localStorage)
    }
  )
);
