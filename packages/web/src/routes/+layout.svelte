<script lang="ts">
  import { browser } from '$app/environment';
  import { auth, authLoading } from '$stores/auth';
  import { Toast } from '$components/ui';
  import OfflineIndicator from '$components/OfflineIndicator.svelte';
  import '../app.css';

  // Initialize auth on client-side load
  // Note: Using browser check instead of onMount due to Svelte 5 hydration issues
  if (browser) {
    auth.init();
  }
</script>

{#if $authLoading}
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
      <div class="spinner border-primary-600 h-8 w-8 mx-auto"></div>
      <p class="mt-4 text-sm text-gray-500">Cargando...</p>
    </div>
  </div>
{:else}
  <slot />
{/if}

<Toast />
<OfflineIndicator />
