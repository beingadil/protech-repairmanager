import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AuthState, UserAccount, UserRole } from '../types/auth';

const SUPERADMIN: UserAccount = {
  id: 'user-superadmin-initial',
  username: 'adil',
  password: 'adil123',
  name: 'Super Administrator',
  role: 'Superadmin',
  created_at: '2026-01-01T00:00:00.000Z'
};

/** Always guarantees the hardcoded superadmin account exists in the list. */
function ensureSuperadmin(users: UserAccount[]): UserAccount[] {
  const stateUsers = users && users.length > 0 ? users : [];
  if (stateUsers.some((u) => u.username.toLowerCase() === SUPERADMIN.username)) {
    return stateUsers;
  }
  return [SUPERADMIN, ...stateUsers];
}

interface ExtendedAuthState extends AuthState {
  updateUserPassword: (id: string, newPassword: string) => { success: boolean; error?: string };
  updateUserProfile: (id: string, updates: { name?: string; role?: UserRole }) => { success: boolean; error?: string };
}

export const useAuthStore = create<ExtendedAuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,
      users: [SUPERADMIN],

      login: (username, password) => {
        const cleanUsername = username.trim().toLowerCase();
        const cleanPassword = password.trim();

        // Always ensure the hardcoded superadmin (adil / adil123) is present,
        // even if an older persisted auth store is missing it.
        const stateUsers = ensureSuperadmin(get().users);

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

        const stateUsers = ensureSuperadmin(get().users);
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
          users: [...ensureSuperadmin(state.users), newUser]
        }));

        return { success: true };
      },

      updateUserPassword: (id, newPassword) => {
        const cleanPassword = newPassword.trim();
        if (!cleanPassword || cleanPassword.length < 4) {
          return { success: false, error: 'Password must be at least 4 characters long.' };
        }

        const stateUsers = ensureSuperadmin(get().users);
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
        const stateUsers = ensureSuperadmin(get().users);
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
        const stateUsers = ensureSuperadmin(get().users);
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
