<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  export let open = false;
  export let title = '';
  export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';

  const dispatch = createEventDispatcher();

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  function close() {
    dispatch('close');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
  >
    <div class="flex min-h-screen items-center justify-center p-4">
      <!-- Backdrop -->
      <button
        type="button"
        class="fixed inset-0 bg-gray-900/50 transition-opacity cursor-default w-full h-full border-none"
        on:click={close}
        transition:fade={{ duration: 150 }}
        aria-label="Cerrar modal"
      ></button>

      <!-- Modal panel -->
      <div
        class="relative w-full {sizes[size]} bg-white rounded-xl shadow-xl"
        transition:fly={{ y: 20, duration: 200 }}
      >
        <!-- Header -->
        {#if title || $$slots.header}
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            {#if $$slots.header}
              <slot name="header" />
            {:else}
              <h3 class="text-lg font-semibold text-gray-900" id="modal-title">{title}</h3>
            {/if}
            <button
              type="button"
              class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
              on:click={close}
              aria-label="Cerrar"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        {/if}

        <!-- Content -->
        <div class="px-6 py-4">
          <slot />
        </div>

        <!-- Footer -->
        {#if $$slots.footer}
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
            <slot name="footer" />
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
