<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth, authError, user } from '$stores/auth';

  let username = '';
  let password = '';
  let isLoading = false;

  async function handleSubmit() {
    if (!username || !password) return;

    isLoading = true;
    auth.clearError();

    const success = await auth.login(username, password);

    if (success) {
      // Redirect based on role
      const currentUser = $user;
      if (currentUser?.rol === 'admin') {
        goto('/admin');
      } else if (currentUser?.rol === 'repartidor') {
        goto('/repartidor');
      } else if (currentUser?.rol === 'revendedor') {
        goto('/revendedor');
      } else {
        goto('/');
      }
    }

    isLoading = false;
  }
</script>

<svelte:head>
  <title>Iniciar Sesión - Remesitas</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full">
    <div class="card p-8">
      <div class="text-center mb-8">
        <div class="mx-auto h-16 w-16 bg-primary-600 rounded-xl flex items-center justify-center">
          <svg class="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 class="mt-4 text-2xl font-bold text-gray-900">Remesitas</h2>
        <p class="mt-2 text-sm text-gray-600">Inicia sesión en tu cuenta</p>
      </div>

      {#if $authError}
        <div class="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg">
          <p class="text-sm text-error-600">{$authError}</p>
        </div>
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="space-y-6">
        <div>
          <label for="username" class="label">Usuario</label>
          <input
            type="text"
            id="username"
            bind:value={username}
            class="input"
            placeholder="Ingresa tu usuario"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label for="password" class="label">Contraseña</label>
          <input
            type="password"
            id="password"
            bind:value={password}
            class="input"
            placeholder="Ingresa tu contraseña"
            required
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          class="btn-primary w-full py-3"
          disabled={isLoading || !username || !password}
        >
          {#if isLoading}
            <span class="spinner"></span>
            Iniciando sesión...
          {:else}
            Iniciar Sesión
          {/if}
        </button>
      </form>

      <div class="mt-6 text-center">
        <a href="/solicitar" class="text-sm text-primary-600 hover:text-primary-500">
          Enviar una remesa sin cuenta
        </a>
      </div>
    </div>

    <p class="mt-8 text-center text-xs text-gray-500">
      2026 Remesitas. Todos los derechos reservados.
    </p>
  </div>
</div>
