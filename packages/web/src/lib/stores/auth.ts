import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import type { User } from '@remesitas/shared';
import { getApiBaseUrl } from '$utils/config';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  error: null,
};

// Load initial state from localStorage
function loadFromStorage(): Partial<AuthState> {
  if (!browser) return {};

  try {
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    return { accessToken, refreshToken, user };
  } catch {
    return {};
  }
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    ...initialState,
    ...loadFromStorage(),
  });

  return {
    subscribe,

    // Login
    async login(username: string, password: string): Promise<boolean> {
      update((s) => ({ ...s, isLoading: true, error: null }));

      try {
        const res = await fetch(`${getApiBaseUrl()}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          update((s) => ({
            ...s,
            isLoading: false,
            error: data.message || 'Error al iniciar sesión',
          }));
          return false;
        }

        const { access_token, refresh_token, user } = data.data;

        // Store in localStorage
        if (browser) {
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          localStorage.setItem('user', JSON.stringify(user));
        }

        update((s) => ({
          ...s,
          accessToken: access_token,
          refreshToken: refresh_token,
          user,
          isLoading: false,
          error: null,
        }));

        return true;
      } catch (err) {
        update((s) => ({
          ...s,
          isLoading: false,
          error: 'Error de conexión',
        }));
        return false;
      }
    },

    // Logout
    async logout(): Promise<void> {
      const state = get({ subscribe });

      try {
        if (state.refreshToken) {
          await fetch(`${getApiBaseUrl()}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: state.refreshToken }),
          });
        }
      } catch {
        // Ignore errors during logout
      }

      // Clear storage
      if (browser) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
      }

      set(initialState);
      goto('/login');
    },

    // Refresh token
    async refresh(): Promise<boolean> {
      const state = get({ subscribe });

      if (!state.refreshToken) return false;

      try {
        const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: state.refreshToken }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          // Refresh failed, logout
          await this.logout();
          return false;
        }

        const { access_token, refresh_token, user } = data.data;

        if (browser) {
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          localStorage.setItem('user', JSON.stringify(user));
        }

        update((s) => ({
          ...s,
          accessToken: access_token,
          refreshToken: refresh_token,
          user,
        }));

        return true;
      } catch {
        await this.logout();
        return false;
      }
    },

    // Initialize auth state
    async init(): Promise<void> {
      const state = get({ subscribe });

      if (!state.accessToken) {
        update((s) => ({ ...s, isLoading: false }));
        return;
      }

      // Verify token by fetching user data
      try {
        const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
          headers: {
            Authorization: `Bearer ${state.accessToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            update((s) => ({
              ...s,
              user: data.data,
              isLoading: false,
            }));
            return;
          }
        }

        // Token invalid, try refresh
        const refreshed = await this.refresh();
        if (!refreshed) {
          update((s) => ({ ...s, isLoading: false }));
        }
      } catch {
        update((s) => ({ ...s, isLoading: false }));
      }
    },

    // Clear error
    clearError(): void {
      update((s) => ({ ...s, error: null }));
    },

    // Set loading
    setLoading(loading: boolean): void {
      update((s) => ({ ...s, isLoading: loading }));
    },
  };
}

export const auth = createAuthStore();

// Derived stores for convenience
export const user = derived(auth, ($auth) => $auth.user);
export const isAuthenticated = derived(auth, ($auth) => !!$auth.user);
export const isAdmin = derived(auth, ($auth) => $auth.user?.rol === 'admin');
export const isRepartidor = derived(
  auth,
  ($auth) => $auth.user?.rol === 'repartidor' || $auth.user?.rol === 'admin'
);
export const isRevendedor = derived(
  auth,
  ($auth) => $auth.user?.rol === 'revendedor' || $auth.user?.rol === 'admin'
);
export const authLoading = derived(auth, ($auth) => $auth.isLoading);
export const authError = derived(auth, ($auth) => $auth.error);
