<script lang="ts">
  interface Props {
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
    width?: string;
    height?: string;
    lines?: number;
    animated?: boolean;
    class?: string;
  }

  let {
    variant = 'text',
    width,
    height,
    lines = 1,
    animated = true,
    class: className = '',
  }: Props = $props();

  // Default dimensions based on variant
  let defaultWidth = $derived(() => {
    switch (variant) {
      case 'circular':
        return '40px';
      case 'rectangular':
      case 'rounded':
        return '100%';
      case 'text':
      default:
        return '100%';
    }
  });

  let defaultHeight = $derived(() => {
    switch (variant) {
      case 'circular':
        return '40px';
      case 'rectangular':
      case 'rounded':
        return '120px';
      case 'text':
      default:
        return '1em';
    }
  });
</script>

{#if variant === 'text' && lines > 1}
  <div class="skeleton-lines {className}">
    {#each Array(lines) as _, i}
      <div
        class="skeleton skeleton-text"
        class:skeleton-animated={animated}
        style="width: {i === lines - 1 ? '60%' : width || defaultWidth()}; height: {height || defaultHeight()}"
      ></div>
    {/each}
  </div>
{:else}
  <div
    class="skeleton skeleton-{variant} {className}"
    class:skeleton-animated={animated}
    style="width: {width || defaultWidth()}; height: {height || defaultHeight()}"
  ></div>
{/if}

<style>
  .skeleton {
    background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
    background-size: 200% 100%;
  }

  .skeleton-animated {
    animation: shimmer 1.5s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  .skeleton-text {
    border-radius: 4px;
  }

  .skeleton-circular {
    border-radius: 50%;
  }

  .skeleton-rectangular {
    border-radius: 0;
  }

  .skeleton-rounded {
    border-radius: 12px;
  }

  .skeleton-lines {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
