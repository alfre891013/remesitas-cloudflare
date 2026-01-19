<script lang="ts">
  import { page } from '$app/stores';

  export let title: string = '';

  // Breadcrumb generation
  $: pathSegments = $page.url.pathname.split('/').filter(Boolean);
  $: breadcrumbs = pathSegments.map((segment, index) => {
    const href = '/' + pathSegments.slice(0, index + 1).join('/');
    const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    return { href, label };
  });
</script>

<header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
  <div>
    <!-- Breadcrumbs -->
    <nav class="flex items-center gap-2 text-sm">
      {#each breadcrumbs as crumb, i}
        {#if i > 0}
          <span class="text-gray-300">/</span>
        {/if}
        {#if i === breadcrumbs.length - 1}
          <span class="text-gray-900 font-medium">{crumb.label}</span>
        {:else}
          <a href={crumb.href} class="text-gray-500 hover:text-gray-700">{crumb.label}</a>
        {/if}
      {/each}
    </nav>

    {#if title}
      <h1 class="text-xl font-semibold text-gray-900 mt-1">{title}</h1>
    {/if}
  </div>

  <div class="flex items-center gap-4">
    <slot />
  </div>
</header>
