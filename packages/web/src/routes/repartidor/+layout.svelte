<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { isRepartidor, authLoading } from '$stores/auth';
  import Sidebar from '$components/layout/Sidebar.svelte';

  const menuItems = [
    {
      href: '/repartidor',
      label: 'Inicio',
      icon: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>',
    },
    {
      href: '/repartidor/entregas',
      label: 'Mis Entregas',
      icon: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>',
    },
    {
      href: '/repartidor/historial',
      label: 'Historial',
      icon: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
    },
    {
      href: '/repartidor/balance',
      label: 'Mi Balance',
      icon: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
    },
  ];

  onMount(() => {
    if (!$authLoading && !$isRepartidor) {
      goto('/login');
    }
  });

  $: if (!$authLoading && !$isRepartidor) {
    goto('/login');
  }
</script>

{#if $isRepartidor}
  <div class="min-h-screen bg-gray-50">
    <Sidebar {menuItems} />
    <div class="ml-64">
      <slot />
    </div>
  </div>
{:else}
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="spinner border-primary-600 h-8 w-8"></div>
  </div>
{/if}
