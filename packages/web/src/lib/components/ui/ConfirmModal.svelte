<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import Button from './Button.svelte';

  export let open = false;
  export let title = 'Confirmar';
  export let message = '';
  export let confirmText = 'Confirmar';
  export let cancelText = 'Cancelar';
  export let variant: 'danger' | 'warning' | 'primary' = 'danger';
  export let loading = false;

  const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>();

  const icons = {
    danger: {
      path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      bg: 'bg-error-100',
      color: 'text-error-600',
    },
    warning: {
      path: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      bg: 'bg-warning-100',
      color: 'text-warning-600',
    },
    primary: {
      path: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      bg: 'bg-primary-100',
      color: 'text-primary-600',
    },
  };

  function handleConfirm() {
    dispatch('confirm');
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !loading) handleCancel();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="confirm-modal-title"
    role="alertdialog"
    aria-modal="true"
  >
    <div class="flex min-h-screen items-center justify-center p-4">
      <!-- Backdrop -->
      <button
        type="button"
        class="fixed inset-0 bg-gray-900/50 transition-opacity cursor-default w-full h-full border-none"
        on:click={handleCancel}
        disabled={loading}
        transition:fade={{ duration: 150 }}
        aria-label="Cerrar"
      ></button>

      <!-- Modal panel -->
      <div
        class="relative w-full max-w-md bg-white rounded-xl shadow-xl p-6"
        transition:fly={{ y: 20, duration: 200 }}
      >
        <div class="flex flex-col items-center text-center">
          <!-- Icon -->
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full {icons[variant].bg}">
            <svg class="h-6 w-6 {icons[variant].color}" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={icons[variant].path} />
            </svg>
          </div>

          <!-- Content -->
          <h3 class="mt-4 text-lg font-semibold text-gray-900" id="confirm-modal-title">
            {title}
          </h3>
          <p class="mt-2 text-sm text-gray-500">
            {message}
          </p>

          <!-- Actions -->
          <div class="mt-6 flex w-full gap-3">
            <Button
              variant="secondary"
              class="flex-1"
              on:click={handleCancel}
              disabled={loading}
            >
              {cancelText}
            </Button>
            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
              class="flex-1"
              on:click={handleConfirm}
              {loading}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
