<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'elevated' | 'outlined' | 'glass';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    class?: string;
    children: Snippet;
    header?: Snippet;
    footer?: Snippet;
    onclick?: () => void;
  }

  let {
    variant = 'default',
    padding = 'md',
    class: className = '',
    children,
    header,
    footer,
    onclick,
  }: Props = $props();

  const baseClasses = 'card';
  const variantClasses = {
    default: 'card-default',
    elevated: 'card-elevated',
    outlined: 'card-outlined',
    glass: 'card-glass',
  };
  const paddingClasses = {
    none: '',
    sm: 'card-padding-sm',
    md: 'card-padding-md',
    lg: 'card-padding-lg',
  };

  let classes = $derived(
    [baseClasses, variantClasses[variant], paddingClasses[padding], onclick ? 'card-clickable' : '', className]
      .filter(Boolean)
      .join(' ')
  );
</script>

{#if onclick}
  <button class={classes} {onclick} type="button">
    {#if header}
      <div class="card-header">
        {@render header()}
      </div>
    {/if}
    <div class="card-body">
      {@render children()}
    </div>
    {#if footer}
      <div class="card-footer">
        {@render footer()}
      </div>
    {/if}
  </button>
{:else}
  <div class={classes}>
    {#if header}
      <div class="card-header">
        {@render header()}
      </div>
    {/if}
    <div class="card-body">
      {@render children()}
    </div>
    {#if footer}
      <div class="card-footer">
        {@render footer()}
      </div>
    {/if}
  </div>
{/if}

<style>
  .card {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    width: 100%;
  }

  .card-default {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .card-elevated {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  }

  .card-outlined {
    border: 1px solid #e5e7eb;
    box-shadow: none;
  }

  .card-glass {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .card-padding-sm .card-body {
    padding: 12px;
  }

  .card-padding-md .card-body {
    padding: 20px;
  }

  .card-padding-lg .card-body {
    padding: 28px;
  }

  .card-header {
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .card-footer {
    padding: 16px 20px;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .card-clickable {
    cursor: pointer;
    border: none;
    text-align: left;
    font: inherit;
    transition: all 0.2s ease;
  }

  .card-clickable:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  .card-clickable:active {
    transform: translateY(0);
  }
</style>
