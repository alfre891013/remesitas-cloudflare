<script lang="ts">
  import { onMount } from 'svelte';
  import { auth, authLoading } from '$stores/auth';
  import '../app.css';

  onMount(() => {
    auth.init();
  });
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
