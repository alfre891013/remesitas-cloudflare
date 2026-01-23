<script lang="ts">
  import { browser } from '$app/environment';
  import Header from '$components/layout/Header.svelte';
  import { apiClient } from '$utils/api';

  interface ConfigItem {
    id: number;
    clave: string;
    valor: string;
    descripcion: string | null;
  }

  let configs: ConfigItem[] = $state([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let saveSuccess = $state(false);
  let editedConfigs: Record<string, string> = $state({});

  // Business rules section
  const businessRulesKeys = [
    'COMISION_USD_PORCENTAJE',
    'DESCUENTO_MN_CUP',
    'MONTO_MINIMO',
    'MONTO_MAXIMO',
  ];

  // Notification settings section
  const notificationKeys = [
    'HABILITAR_NOTIFICACIONES_SMS',
    'HABILITAR_NOTIFICACIONES_WHATSAPP',
    'HABILITAR_NOTIFICACIONES_PUSH',
    'HABILITAR_GPS_TRACKING',
  ];

  // Other settings
  const otherKeys = [
    'URL_BASE',
    'DIAS_VENCIMIENTO_FACTURA',
  ];

  const labels: Record<string, string> = {
    COMISION_USD_PORCENTAJE: 'Comision USD (%)',
    DESCUENTO_MN_CUP: 'Descuento MN (CUP)',
    MONTO_MINIMO: 'Monto Minimo (USD)',
    MONTO_MAXIMO: 'Monto Maximo (USD)',
    HABILITAR_NOTIFICACIONES_SMS: 'SMS',
    HABILITAR_NOTIFICACIONES_WHATSAPP: 'WhatsApp',
    HABILITAR_NOTIFICACIONES_PUSH: 'Push',
    HABILITAR_GPS_TRACKING: 'GPS Tracking',
    URL_BASE: 'URL Base',
    DIAS_VENCIMIENTO_FACTURA: 'Dias Vencimiento Factura',
  };

  if (browser) {
    loadConfigs();
  }

  async function loadConfigs() {
    isLoading = true;
    error = null;

    try {
      const response = await apiClient.get<{ data: ConfigItem[] }>('/api/admin/configuracion');
      if (response.success && response.data) {
        configs = response.data;
        // Initialize editedConfigs with current values
        editedConfigs = {};
        for (const config of configs) {
          editedConfigs[config.clave] = config.valor;
        }
      } else {
        error = response.message || 'Error al cargar configuracion';
      }
    } catch (e) {
      error = 'Error de conexion';
    }

    isLoading = false;
  }

  async function saveConfigs() {
    error = null;
    saveSuccess = false;

    try {
      // Save each changed config
      for (const [clave, valor] of Object.entries(editedConfigs)) {
        const original = configs.find(c => c.clave === clave);
        if (original && original.valor !== valor) {
          await apiClient.put(`/api/admin/configuracion/${original.id}`, { valor });
        }
      }
      saveSuccess = true;
      await loadConfigs();
      setTimeout(() => saveSuccess = false, 3000);
    } catch (e) {
      error = 'Error al guardar configuracion';
    }
  }

  function getConfigValue(key: string): string {
    return editedConfigs[key] || '';
  }

  function updateConfig(key: string, value: string) {
    editedConfigs[key] = value;
  }

  function isToggle(key: string): boolean {
    return notificationKeys.includes(key);
  }

  function toggleValue(key: string) {
    const current = editedConfigs[key];
    editedConfigs[key] = current === '1' ? '0' : '1';
  }

  function filterConfigs(keys: string[]): ConfigItem[] {
    return configs.filter(c => keys.includes(c.clave));
  }
</script>

<svelte:head>
  <title>Configuracion - Remesitas Admin</title>
</svelte:head>

<Header title="Configuracion del Sistema" />

<main class="p-6">
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="spinner border-primary-600 h-8 w-8"></div>
    </div>
  {:else if error}
    <div class="p-4 bg-error-50 border border-error-200 rounded-lg">
      <p class="text-error-600">{error}</p>
      <button onclick={loadConfigs} class="btn-secondary mt-4">
        Reintentar
      </button>
    </div>
  {:else}
    {#if saveSuccess}
      <div class="mb-6 p-4 bg-success-50 border border-success-200 rounded-lg">
        <p class="text-success-600">Configuracion guardada correctamente</p>
      </div>
    {/if}

    <!-- Business Rules -->
    <div class="card p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Reglas de Negocio</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#each businessRulesKeys as key}
          {@const config = configs.find(c => c.clave === key)}
          {#if config}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                {labels[key] || key}
              </label>
              <input
                type="number"
                value={getConfigValue(key)}
                oninput={(e) => updateConfig(key, e.currentTarget.value)}
                class="input"
                step="0.01"
              />
              {#if config.descripcion}
                <p class="text-xs text-gray-500 mt-1">{config.descripcion}</p>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- Notification Settings -->
    <div class="card p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Notificaciones</h2>
      <div class="space-y-4">
        {#each notificationKeys as key}
          {@const config = configs.find(c => c.clave === key)}
          {#if config}
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-gray-900">{labels[key] || key}</p>
                {#if config.descripcion}
                  <p class="text-sm text-gray-500">{config.descripcion}</p>
                {/if}
              </div>
              <button
                type="button"
                onclick={() => toggleValue(key)}
                class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 {getConfigValue(key) === '1' ? 'bg-primary-600' : 'bg-gray-200'}"
                role="switch"
                aria-checked={getConfigValue(key) === '1'}
              >
                <span
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {getConfigValue(key) === '1' ? 'translate-x-5' : 'translate-x-0'}"
                ></span>
              </button>
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- Other Settings -->
    <div class="card p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Otros Ajustes</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#each otherKeys as key}
          {@const config = configs.find(c => c.clave === key)}
          {#if config}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                {labels[key] || key}
              </label>
              <input
                type={key === 'DIAS_VENCIMIENTO_FACTURA' ? 'number' : 'text'}
                value={getConfigValue(key)}
                oninput={(e) => updateConfig(key, e.currentTarget.value)}
                class="input"
              />
              {#if config.descripcion}
                <p class="text-xs text-gray-500 mt-1">{config.descripcion}</p>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- Save Button -->
    <div class="flex justify-end">
      <button onclick={saveConfigs} class="btn-primary">
        Guardar Cambios
      </button>
    </div>
  {/if}
</main>
