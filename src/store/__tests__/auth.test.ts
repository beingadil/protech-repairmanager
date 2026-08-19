import { beforeEach, describe, expect, it } from 'vitest';

// Polyfill localStorage BEFORE loading the persisted zustand store.
const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, String(v)),
  removeItem: (k: string) => void storage.delete(k)
};

const { useAuthStore } = await import('../auth');

describe('auth store superadmin credentials', () => {
  beforeEach(() => {
    storage.clear();
    useAuthStore.setState({
      currentUser: null,
      isAuthenticated: false,
      users: []
    });
  });

  it('logs in with hardcoded adil / adil123', () => {
    const res = useAuthStore.getState().login('adil', 'adil123');
    expect(res.success).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().currentUser?.username).toBe('adil');
    expect(useAuthStore.getState().currentUser?.role).toBe('Superadmin');
  });

  it('logs in when users list is empty (stale persisted store)', () => {
    expect(useAuthStore.getState().users).toEqual([]);
    const res = useAuthStore.getState().login('adil', 'adil123');
    expect(res.success).toBe(true);
  });

  it('rejects wrong password', () => {
    const res = useAuthStore.getState().login('adil', 'wrongpass');
    expect(res.success).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('ensures the superadmin exists when adding a user', () => {
    const res = useAuthStore.getState().addUser({
      username: 'tech1',
      password: 'tech1234',
      name: 'Technician One',
      role: 'Technician'
    });
    expect(res.success).toBe(true);
    const usernames = useAuthStore.getState().users.map((u) => u.username);
    expect(usernames).toContain('adil');
    expect(usernames).toContain('tech1');
  });
});