import { writable, derived } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
}

function createToastStore() {
  const { subscribe, update } = writable<ToastState>({ toasts: [] });

  let idCounter = 0;

  function addToast(type: ToastType, message: string, duration = 5000): string {
    const id = `toast-${++idCounter}`;

    update((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }));

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }

    return id;
  }

  function removeToast(id: string): void {
    update((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  }

  return {
    subscribe,

    success(message: string, duration?: number): string {
      return addToast('success', message, duration);
    },

    error(message: string, duration?: number): string {
      return addToast('error', message, duration ?? 7000);
    },

    warning(message: string, duration?: number): string {
      return addToast('warning', message, duration);
    },

    info(message: string, duration?: number): string {
      return addToast('info', message, duration);
    },

    remove: removeToast,

    clear(): void {
      update(() => ({ toasts: [] }));
    },
  };
}

export const toast = createToastStore();
export const toastStore = toast; // Alias for backwards compatibility
export const toasts = derived(toast, ($state) => $state.toasts);
