<script lang="ts">
  export let loading = false;
  export let emptyMessage = 'No hay datos disponibles';
  export let isEmpty = false;
</script>

<div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200">
      {#if $$slots.head}
        <thead class="bg-gray-50">
          <tr>
            <slot name="head" />
          </tr>
        </thead>
      {/if}

      <tbody class="divide-y divide-gray-200 bg-white">
        {#if loading}
          <tr>
            <td colspan="100" class="py-12 text-center">
              <div class="flex items-center justify-center gap-3">
                <div class="spinner border-primary-600 h-6 w-6"></div>
                <span class="text-gray-500">Cargando...</span>
              </div>
            </td>
          </tr>
        {:else if isEmpty}
          <tr>
            <td colspan="100" class="py-12 text-center">
              <div class="flex flex-col items-center gap-2">
                <svg class="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p class="text-gray-500">{emptyMessage}</p>
              </div>
            </td>
          </tr>
        {:else}
          <slot />
        {/if}
      </tbody>
    </table>
  </div>

  {#if $$slots.footer}
    <div class="border-t border-gray-200 bg-gray-50 px-4 py-3">
      <slot name="footer" />
    </div>
  {/if}
</div>

<style>
  :global(.th) {
    @apply px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500;
  }
  :global(.td) {
    @apply px-4 py-3 text-sm text-gray-900;
  }
  :global(.td-muted) {
    @apply px-4 py-3 text-sm text-gray-500;
  }
</style>
