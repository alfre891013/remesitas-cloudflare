<script lang="ts">
  export let type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'search' | 'date' = 'text';
  export let label = '';
  export let placeholder = '';
  export let value: string | number = '';
  export let name = '';
  export let id = '';
  export let error = '';
  export let required = false;
  export let disabled = false;
  export let readonly = false;
  export let min: number | undefined = undefined;
  export let max: number | undefined = undefined;
  export let step: number | string | undefined = undefined;
  export let autocomplete: string | undefined = undefined;

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

  <input
    {type}
    {name}
    id={inputId}
    {placeholder}
    {required}
    {disabled}
    {readonly}
    {min}
    {max}
    {step}
    autocomplete={autocomplete as AutoFill | undefined}
    bind:value
    on:input
    on:change
    on:blur
    on:focus
    class="block w-full rounded-lg border {error
      ? 'border-error-300 focus:border-error-500 focus:ring-error-500'
      : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'} px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
    class:bg-gray-100={readonly}
  />

  {#if error}
    <p class="text-sm text-error-600">{error}</p>
  {/if}
</div>
