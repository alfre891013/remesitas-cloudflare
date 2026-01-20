<script lang="ts">
  import { goto } from '$app/navigation';
  import { isAuthenticated, user, authLoading } from '$stores/auth';
  import { browser } from '$app/environment';

  // Subscribe to stores for reactivity - use explicit variable declarations
  let loading = $derived($authLoading);
  let authenticated = $derived($isAuthenticated);
  let currentUser = $derived($user);

  // Effect runs when derived values change
  $effect(() => {
    if (!browser || loading) return;

    if (authenticated && currentUser) {
      if (currentUser.rol === 'admin') {
        goto('/admin');
      } else if (currentUser.rol === 'repartidor') {
        goto('/repartidor');
      } else if (currentUser.rol === 'revendedor') {
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
