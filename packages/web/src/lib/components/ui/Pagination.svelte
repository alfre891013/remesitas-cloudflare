<script lang="ts">
  interface Props {
    page: number;
    totalPages: number;
    totalItems?: number;
    limit?: number;
    showInfo?: boolean;
    siblingCount?: number;
    onchange: (page: number) => void;
  }

  let {
    page = $bindable(1),
    totalPages,
    totalItems,
    limit = 20,
    showInfo = true,
    siblingCount = 1,
    onchange,
  }: Props = $props();

  // Generate page numbers to display
  let pages = $derived(() => {
    const result: (number | 'ellipsis')[] = [];

    // Always show first page
    result.push(1);

    // Calculate range around current page
    const leftSibling = Math.max(page - siblingCount, 2);
    const rightSibling = Math.min(page + siblingCount, totalPages - 1);

    // Add left ellipsis if needed
    if (leftSibling > 2) {
      result.push('ellipsis');
    }

    // Add pages around current
    for (let i = leftSibling; i <= rightSibling; i++) {
      if (i > 1 && i < totalPages) {
        result.push(i);
      }
    }

    // Add right ellipsis if needed
    if (rightSibling < totalPages - 1) {
      result.push('ellipsis');
    }

    // Always show last page (if more than 1 page)
    if (totalPages > 1) {
      result.push(totalPages);
    }

    return result;
  });

  function goToPage(newPage: number) {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      page = newPage;
      onchange(newPage);
    }
  }

  // Calculate display info
  let startItem = $derived((page - 1) * limit + 1);
  let endItem = $derived(Math.min(page * limit, totalItems || page * limit));
</script>

<div class="pagination-container">
  {#if showInfo && totalItems}
    <div class="pagination-info">
      Mostrando <strong>{startItem}</strong> - <strong>{endItem}</strong> de <strong>{totalItems.toLocaleString()}</strong>
    </div>
  {/if}

  <nav class="pagination" aria-label="Paginacion">
    <button
      type="button"
      class="pagination-btn pagination-prev"
      disabled={page === 1}
      onclick={() => goToPage(page - 1)}
      aria-label="Pagina anterior"
    >
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>

    <div class="pagination-pages">
      {#each pages() as pageNum, i}
        {#if pageNum === 'ellipsis'}
          <span class="pagination-ellipsis">...</span>
        {:else}
          <button
            type="button"
            class="pagination-btn pagination-page"
            class:active={pageNum === page}
            onclick={() => goToPage(pageNum)}
            aria-label="Ir a pagina {pageNum}"
            aria-current={pageNum === page ? 'page' : undefined}
          >
            {pageNum}
          </button>
        {/if}
      {/each}
    </div>

    <button
      type="button"
      class="pagination-btn pagination-next"
      disabled={page >= totalPages}
      onclick={() => goToPage(page + 1)}
      aria-label="Pagina siguiente"
    >
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  </nav>
</div>

<style>
  .pagination-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  @media (min-width: 640px) {
    .pagination-container {
      flex-direction: row;
      justify-content: space-between;
    }
  }

  .pagination-info {
    font-size: 14px;
    color: #6b7280;
  }

  .pagination-info strong {
    color: #1a1a2e;
    font-weight: 600;
  }

  .pagination {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pagination-pages {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pagination-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    height: 40px;
    padding: 0 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    color: #374151;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .pagination-btn:hover:not(:disabled):not(.active) {
    background: #f9fafb;
    border-color: #d1d5db;
  }

  .pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination-btn.active {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-color: transparent;
    color: white;
  }

  .pagination-prev,
  .pagination-next {
    padding: 0;
  }

  .pagination-prev svg,
  .pagination-next svg {
    width: 20px;
    height: 20px;
  }

  .pagination-ellipsis {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    color: #9ca3af;
    font-weight: 500;
  }

  /* Mobile: Hide page numbers, show only prev/next */
  @media (max-width: 480px) {
    .pagination-pages {
      display: none;
    }

    .pagination-container {
      width: 100%;
      justify-content: space-between;
    }

    .pagination {
      width: 100%;
      justify-content: space-between;
    }

    .pagination-btn {
      flex: 1;
      max-width: 120px;
    }
  }
</style>
