<script lang="ts">
  export let label = '';
  export let value: string | number = '';
  export let name = '';
  export let id = '';
  export let error = '';
  export let required = false;
  export let disabled = false;
  export let options: Array<{ value: string | number; label: string }> = [];
  export let placeholder = 'Seleccionar...';

  $: inputId = id || name || label.toLowerCase().replace(/\s+/g, '-');
</script>

<div class="space-y-1">
  {#if label}
    <label for={inputId} class="block text-sm font-medium text-gray-700">
      {label}
      {#if required}
        <span class="text-error-500">*</span>
      {/if}
    </label>
  {/if}

  <select
    {name}
    id={inputId}
    {required}
    {disabled}
    bind:value
    on:change
    class="block w-full rounded-lg border {error
      ? 'border-error-300 focus:border-error-500 focus:ring-error-500'
      : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'} px-3 py-2 text-sm focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
  >
    {#if placeholder}
      <option value="" disabled>{placeholder}</option>
    {/if}
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>

  {#if error}
    <p class="text-sm text-error-600">{error}</p>
  {/if}
</div>
