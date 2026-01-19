<script lang="ts">
  import { page } from '$app/stores';
  import { user, auth } from '$stores/auth';
  import { getInitials, getRolLabel } from '$utils/format';

  export let menuItems: Array<{
    href: string;
    label: string;
    icon: string;
  }> = [];

  $: currentPath = $page.url.pathname;

  function isActive(href: string): boolean {
    if (href === '/admin' || href === '/repartidor' || href === '/revendedor') {
      return currentPath === href;
    }
    return currentPath.startsWith(href);
  }
</script>

<aside class="fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
  <!-- Logo -->
  <div class="h-16 flex items-center px-6 border-b border-gray-200">
    <div class="flex items-center gap-3">
      <div class="h-10 w-10 bg-primary-600 rounded-lg flex items-center justify-center">
        <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <span class="text-lg font-bold text-gray-900">Remesitas</span>
    </div>
  </div>

  <!-- Navigation -->
  <nav class="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
    {#each menuItems as item}
      <a
        href={item.href}
        class={isActive(item.href) ? 'nav-item-active' : 'nav-item-inactive'}
      >
        <span class="w-5 h-5">{@html item.icon}</span>
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>

  <!-- User section -->
  <div class="p-4 border-t border-gray-200">
    <div class="flex items-center gap-3">
      <div class="h-10 w-10 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-semibold text-sm">
        {$user ? getInitials($user.nombre) : '??'}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 truncate">
          {$user?.nombre || 'Usuario'}
        </p>
        <p class="text-xs text-gray-500">
          {$user ? getRolLabel($user.rol) : ''}
        </p>
      </div>
      <button
        on:click={() => auth.logout()}
        class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        title="Cerrar sesión"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  </div>
</aside>
