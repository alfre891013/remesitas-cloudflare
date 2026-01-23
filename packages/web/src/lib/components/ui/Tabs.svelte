<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Tab {
    id: string;
    label: string;
    icon?: string;
    badge?: string | number;
    disabled?: boolean;
  }

  interface Props {
    tabs: Tab[];
    activeTab?: string;
    variant?: 'default' | 'pills' | 'underline';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    onchange?: (tabId: string) => void;
    children?: Snippet<[{ activeTab: string }]>;
  }

  let {
    tabs,
    activeTab = $bindable(tabs[0]?.id || ''),
    variant = 'default',
    size = 'md',
    fullWidth = false,
    onchange,
    children,
  }: Props = $props();

  function handleTabClick(tabId: string) {
    if (tabs.find((t) => t.id === tabId)?.disabled) return;
    activeTab = tabId;
    onchange?.(tabId);
  }

  function handleKeyDown(event: KeyboardEvent, tabId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTabClick(tabId);
    }
  }
</script>

<div class="tabs-container">
  <div
    class="tabs tabs-{variant} tabs-{size}"
    class:tabs-full-width={fullWidth}
    role="tablist"
  >
    {#each tabs as tab}
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === tab.id}
        aria-disabled={tab.disabled}
        class="tab"
        class:active={activeTab === tab.id}
        class:disabled={tab.disabled}
        onclick={() => handleTabClick(tab.id)}
        onkeydown={(e) => handleKeyDown(e, tab.id)}
      >
        {#if tab.icon}
          <span class="tab-icon">{@html tab.icon}</span>
        {/if}
        <span class="tab-label">{tab.label}</span>
        {#if tab.badge !== undefined}
          <span class="tab-badge">{tab.badge}</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if children}
    <div class="tabs-content" role="tabpanel">
      {@render children({ activeTab })}
    </div>
  {/if}
</div>

<style>
  .tabs-container {
    width: 100%;
  }

  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid #e5e7eb;
  }

  .tabs-full-width {
    width: 100%;
  }

  .tabs-full-width .tab {
    flex: 1;
    justify-content: center;
  }

  /* Tab Button */
  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border: none;
    background: transparent;
    color: #6b7280;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    white-space: nowrap;
  }

  .tab:hover:not(.disabled) {
    color: #1a1a2e;
    background: #f3f4f6;
  }

  .tab.active {
    color: #1a1a2e;
  }

  .tab.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Size Variants */
  .tabs-sm .tab {
    padding: 8px 12px;
    font-size: 13px;
  }

  .tabs-md .tab {
    padding: 12px 16px;
    font-size: 14px;
  }

  .tabs-lg .tab {
    padding: 14px 20px;
    font-size: 15px;
  }

  /* Style Variants */
  .tabs-default .tab.active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 2px 2px 0 0;
  }

  .tabs-pills {
    border-bottom: none;
    background: #f3f4f6;
    padding: 4px;
    border-radius: 10px;
    gap: 2px;
  }

  .tabs-pills .tab {
    border-radius: 8px;
  }

  .tabs-pills .tab.active {
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .tabs-underline {
    border-bottom: none;
    gap: 24px;
  }

  .tabs-underline .tab {
    padding: 12px 0;
    border-bottom: 2px solid transparent;
  }

  .tabs-underline .tab.active {
    border-bottom-color: #1a1a2e;
  }

  /* Tab Icon */
  .tab-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tab-icon :global(svg) {
    width: 18px;
    height: 18px;
  }

  /* Tab Badge */
  .tab-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 9999px;
    background: #e5e7eb;
    color: #374151;
  }

  .tab.active .tab-badge {
    background: #1a1a2e;
    color: white;
  }

  /* Tabs Content */
  .tabs-content {
    padding-top: 20px;
  }
</style>
