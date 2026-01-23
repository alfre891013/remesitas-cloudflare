<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$utils/api';

  interface Provincia {
    id: number;
    nombre: string;
    codigo: string;
  }

  interface Municipio {
    id: number;
    nombre: string;
    provincia_id: number;
    codigo_postal: string | null;
  }

  interface Props {
    provinciaId?: number | null;
    municipioId?: number | null;
    required?: boolean;
    disabled?: boolean;
    showMunicipio?: boolean;
    provinciaLabel?: string;
    municipioLabel?: string;
    provinciaPlaceholder?: string;
    municipioPlaceholder?: string;
    onchange?: (data: { provinciaId: number | null; municipioId: number | null }) => void;
  }

  let {
    provinciaId = $bindable(null),
    municipioId = $bindable(null),
    required = false,
    disabled = false,
    showMunicipio = true,
    provinciaLabel = 'Provincia',
    municipioLabel = 'Municipio',
    provinciaPlaceholder = 'Selecciona una provincia',
    municipioPlaceholder = 'Selecciona un municipio',
    onchange,
  }: Props = $props();

  let provincias = $state<Provincia[]>([]);
  let municipios = $state<Municipio[]>([]);
  let isLoadingProvincias = $state(true);
  let isLoadingMunicipios = $state(false);
  let error = $state<string | null>(null);

  onMount(() => {
    loadProvincias();
  });

  async function loadProvincias() {
    isLoadingProvincias = true;
    error = null;

    try {
      const response = await apiClient.get<Provincia[]>('/api/geografia/provincias');
      if (response.success && response.data) {
        provincias = response.data;

        // If we have a pre-selected provincia, load its municipios
        if (provinciaId && showMunicipio) {
          await loadMunicipios(provinciaId);
        }
      }
    } catch (e) {
      error = 'Error al cargar provincias';
      console.error('Error loading provincias:', e);
    } finally {
      isLoadingProvincias = false;
    }
  }

  async function loadMunicipios(provId: number) {
    isLoadingMunicipios = true;

    try {
      const response = await apiClient.get<Municipio[]>(
        `/api/geografia/provincias/${provId}/municipios`
      );
      if (response.success && response.data) {
        municipios = response.data;
      }
    } catch (e) {
      console.error('Error loading municipios:', e);
      municipios = [];
    } finally {
      isLoadingMunicipios = false;
    }
  }

  function handleProvinciaChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const newProvinciaId = select.value ? parseInt(select.value, 10) : null;

    provinciaId = newProvinciaId;
    municipioId = null;
    municipios = [];

    if (newProvinciaId && showMunicipio) {
      loadMunicipios(newProvinciaId);
    }

    onchange?.({ provinciaId: newProvinciaId, municipioId: null });
  }

  function handleMunicipioChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const newMunicipioId = select.value ? parseInt(select.value, 10) : null;

    municipioId = newMunicipioId;
    onchange?.({ provinciaId, municipioId: newMunicipioId });
  }

  // Get selected provincia name for display
  let selectedProvincia = $derived(
    provinciaId ? provincias.find((p) => p.id === provinciaId) : null
  );
</script>

<div class="province-select">
  <div class="select-group">
    <label for="provincia-select" class="select-label">
      {provinciaLabel}
      {#if required}
        <span class="required">*</span>
      {/if}
    </label>
    <div class="select-wrapper">
      <select
        id="provincia-select"
        value={provinciaId || ''}
        onchange={handleProvinciaChange}
        {disabled}
        {required}
        class="select-input"
        class:loading={isLoadingProvincias}
      >
        <option value="">{isLoadingProvincias ? 'Cargando...' : provinciaPlaceholder}</option>
        {#each provincias as provincia}
          <option value={provincia.id}>{provincia.nombre}</option>
        {/each}
      </select>
      <div class="select-icon">
        {#if isLoadingProvincias}
          <div class="spinner"></div>
        {:else}
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        {/if}
      </div>
    </div>
  </div>

  {#if showMunicipio}
    <div class="select-group">
      <label for="municipio-select" class="select-label">
        {municipioLabel}
        {#if required}
          <span class="required">*</span>
        {/if}
      </label>
      <div class="select-wrapper">
        <select
          id="municipio-select"
          value={municipioId || ''}
          onchange={handleMunicipioChange}
          disabled={disabled || !provinciaId || isLoadingMunicipios}
          required={required && !!provinciaId}
          class="select-input"
          class:loading={isLoadingMunicipios}
        >
          <option value="">
            {#if !provinciaId}
              Selecciona primero una provincia
            {:else if isLoadingMunicipios}
              Cargando municipios...
            {:else}
              {municipioPlaceholder}
            {/if}
          </option>
          {#each municipios as municipio}
            <option value={municipio.id}>
              {municipio.nombre}
              {#if municipio.codigo_postal}
                ({municipio.codigo_postal})
              {/if}
            </option>
          {/each}
        </select>
        <div class="select-icon">
          {#if isLoadingMunicipios}
            <div class="spinner"></div>
          {:else}
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if error}
    <p class="error-message">{error}</p>
  {/if}
</div>

<style>
  .province-select {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .select-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .select-label {
    font-size: 14px;
    font-weight: 500;
    color: #374151;
  }

  .required {
    color: #ef4444;
    margin-left: 2px;
  }

  .select-wrapper {
    position: relative;
  }

  .select-input {
    width: 100%;
    padding: 12px 40px 12px 14px;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    font-size: 15px;
    color: #1a1a2e;
    background: white;
    cursor: pointer;
    appearance: none;
    transition: all 0.2s ease;
  }

  .select-input:hover:not(:disabled) {
    border-color: #9ca3af;
  }

  .select-input:focus {
    outline: none;
    border-color: #1a1a2e;
    box-shadow: 0 0 0 3px rgba(26, 26, 46, 0.1);
  }

  .select-input:disabled {
    background: #f9fafb;
    color: #9ca3af;
    cursor: not-allowed;
  }

  .select-input.loading {
    color: #9ca3af;
  }

  .select-icon {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: #6b7280;
  }

  .select-icon svg {
    width: 18px;
    height: 18px;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #e5e7eb;
    border-top-color: #1a1a2e;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-message {
    font-size: 13px;
    color: #ef4444;
    margin: 0;
  }

  /* Responsive: Side by side on larger screens */
  @media (min-width: 640px) {
    .province-select {
      flex-direction: row;
      gap: 16px;
    }

    .select-group {
      flex: 1;
    }
  }
</style>
