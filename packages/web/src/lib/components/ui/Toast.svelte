<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { toasts, toast, type ToastType } from '$stores/toast';

  const icons: Record<ToastType, string> = {
    success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  };

  const colors: Record<ToastType, string> = {
    success: 'bg-success-50 border-success-200 text-success-800',
    error: 'bg-error-50 border-error-200 text-error-800',
    warning: 'bg-warning-50 border-warning-200 text-warning-800',
    info: 'bg-primary-50 border-primary-200 text-primary-800',
  };

  const iconColors: Record<ToastType, string> = {
    success: 'text-success-500',
    error: 'text-error-500',
    warning: 'text-warning-500',
    info: 'text-primary-500',
  };
</script>

<div
  class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
  aria-live="polite"
>
  {#each $toasts as t (t.id)}
    <div
      class="pointer-events-auto flex items-start gap-3 p-4 rounded-lg border shadow-lg {colors[t.type]}"
      in:fly={{ x: 100, duration: 200 }}
      out:fade={{ duration: 150 }}
      role="alert"
    >
      <svg class="w-5 h-5 flex-shrink-0 {iconColors[t.type]}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={icons[t.type]} />
      </svg>
      <p class="text-sm flex-1">{t.message}</p>
      <button
        type="button"
        class="flex-shrink-0 rounded-md p-1 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-2"
        on:click={() => toast.remove(t.id)}
        aria-label="Cerrar"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  {/each}
</div>
