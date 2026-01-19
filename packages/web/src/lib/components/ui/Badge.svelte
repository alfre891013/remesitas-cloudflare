<script lang="ts">
  let className = '';
  export { className as class };
  export let variant: 'primary' | 'success' | 'warning' | 'error' | 'blue' | 'purple' | 'gray' =
    'gray';
  export let size: 'sm' | 'md' = 'sm';

  const variants = {
    primary: 'bg-primary-100 text-primary-700',
    success: 'bg-success-100 text-success-700',
    warning: 'bg-warning-100 text-warning-700',
    error: 'bg-error-100 text-error-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    gray: 'bg-gray-100 text-gray-700',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };
</script>

<span class="inline-flex items-center font-medium rounded-full {variants[variant]} {sizes[size]} {className}">
  <slot />
</span>
