<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { isAuthenticated, user } from '$stores/auth';

  onMount(() => {
    // Redirect based on auth state
    if ($isAuthenticated && $user) {
      if ($user.rol === 'admin') {
        goto('/admin');
      } else if ($user.rol === 'repartidor') {
        goto('/repartidor');
      } else if ($user.rol === 'revendedor') {
        goto('/revendedor');
      }
    } else {
      goto('/solicitar');
    }
  });
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
  <div class="text-center">
    <div class="spinner border-primary-600 h-8 w-8 mx-auto"></div>
    <p class="mt-4 text-sm text-gray-500">Redirigiendo...</p>
  </div>
</div>
