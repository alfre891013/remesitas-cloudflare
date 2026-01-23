<script lang="ts">
  import { browser } from '$app/environment';
  import Header from '$components/layout/Header.svelte';
  import { apiClient } from '$utils/api';
  import {
    isGeolocationSupported,
    requestGeolocationPermission,
    getCurrentPosition,
    GeolocationTracker,
    getGeolocationErrorMessage,
    type LocationData,
  } from '$lib/services/geolocation';
  import { toastStore } from '$stores/toast';

  interface RemesaEnProceso {
    id: number;
    codigo: string;
    beneficiario_nombre: string;
    beneficiario_direccion: string;
    monto_entrega: number;
    moneda_entrega: string;
  }

  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let currentLocation = $state<LocationData | null>(null);
  let isTracking = $state(false);
  let isSharing = $state(false);
  let permissionStatus = $state<PermissionState>('prompt');
  let remesasEnProceso: RemesaEnProceso[] = $state([]);
  let selectedRemesa: RemesaEnProceso | null = $state(null);
  let tracker: GeolocationTracker | null = $state(null);
  let map: any = $state(null);
  let mapContainer: HTMLDivElement | null = $state(null);
  let marker: any = $state(null);

  // Initialize on mount
  $effect(() => {
    if (browser) {
      init();
      return () => {
        if (tracker) {
          tracker.stop();
        }
      };
    }
  });

  // Initialize map when container is ready
  $effect(() => {
    if (browser && mapContainer && !map) {
      initMap();
    }
  });

  async function init() {
    isLoading = true;

    // Check geolocation support
    if (!isGeolocationSupported()) {
      error = 'Tu dispositivo no soporta geolocalizacion';
      isLoading = false;
      return;
    }

    // Check permission status
    permissionStatus = await requestGeolocationPermission();

    // Load remesas en proceso
    await loadRemesas();

    // Try to get current location
    try {
      currentLocation = await getCurrentPosition();
    } catch (e: any) {
      if (e.code !== 1) {
        // Not permission denied
        console.warn('Could not get initial location:', e);
      }
    }

    // Check sharing status
    await checkSharingStatus();

    isLoading = false;
  }

  async function loadRemesas() {
    try {
      const response = await apiClient.get<{ data: RemesaEnProceso[] }>(
        '/api/repartidor/remesas?estado=en_proceso'
      );

      if (response.success && response.data) {
        remesasEnProceso = response.data;
      }
    } catch (e) {
      console.error('Error loading remesas:', e);
    }
  }

  async function checkSharingStatus() {
    try {
      const response = await apiClient.get<{ data: { compartir_ubicacion: boolean } }>(
        '/api/repartidor/dispositivo'
      );

      if (response.success && response.data) {
        isSharing = response.data.compartir_ubicacion;
      }
    } catch (e) {
      console.error('Error checking sharing status:', e);
    }
  }

  async function initMap() {
    if (!browser || !mapContainer) return;

    try {
      const L = await import('leaflet');

      // Import Leaflet CSS
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Default to Havana
      const center = currentLocation
        ? [currentLocation.latitude, currentLocation.longitude]
        : [23.1136, -82.3666];

      map = L.map(mapContainer).setView(center as [number, number], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      if (currentLocation) {
        updateMarker(currentLocation);
      }
    } catch (e) {
      console.error('Error initializing map:', e);
    }
  }

  async function updateMarker(location: LocationData) {
    if (!map) return;

    try {
      const L = await import('leaflet');

      const myIcon = L.divIcon({
        className: 'my-location-marker',
        html: `
          <div class="marker-dot">
            <div class="marker-pulse"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      if (marker) {
        marker.setLatLng([location.latitude, location.longitude]);
      } else {
        marker = L.marker([location.latitude, location.longitude], { icon: myIcon }).addTo(map);
      }

      map.setView([location.latitude, location.longitude], map.getZoom());
    } catch (e) {
      console.error('Error updating marker:', e);
    }
  }

  function handleLocationUpdate(location: LocationData) {
    currentLocation = location;
    updateMarker(location);
  }

  function handleLocationError(error: GeolocationPositionError) {
    toastStore.error(getGeolocationErrorMessage(error));
  }

  async function toggleTracking() {
    if (isTracking) {
      // Stop tracking
      if (tracker) {
        tracker.stop();
      }
      isTracking = false;
      toastStore.info('Rastreo detenido');
    } else {
      // Start tracking
      if (!tracker) {
        tracker = new GeolocationTracker({ updateInterval: 30000 });
      }

      const started = tracker.start(
        handleLocationUpdate,
        handleLocationError,
        selectedRemesa?.id
      );

      if (started) {
        isTracking = true;
        toastStore.success('Rastreo iniciado');
      } else {
        toastStore.error('No se pudo iniciar el rastreo');
      }
    }
  }

  async function toggleSharing() {
    try {
      const newValue = !isSharing;
      const response = await apiClient.put('/api/ubicacion/compartir', {
        compartir: newValue,
      });

      if (response.success) {
        isSharing = newValue;
        toastStore.success(
          newValue ? 'Ubicacion compartida con clientes' : 'Ya no se comparte ubicacion'
        );
      } else {
        toastStore.error('Error al cambiar configuracion');
      }
    } catch (e) {
      toastStore.error('Error de conexion');
    }
  }

  function selectRemesa(remesa: RemesaEnProceso) {
    selectedRemesa = remesa;
    if (tracker) {
      tracker.setRemesaId(remesa.id);
    }
  }

  function centerOnMe() {
    if (map && currentLocation) {
      map.setView([currentLocation.latitude, currentLocation.longitude], 15);
    }
  }
</script>

<svelte:head>
  <title>Mapa de Entregas - Remesitas</title>
</svelte:head>

<Header title="Mapa de Entregas" />

<main class="p-4 md:p-6">
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="spinner border-primary-600 h-8 w-8"></div>
    </div>
  {:else if error}
    <div class="card p-6 text-center">
      <div class="w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-error-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p class="text-gray-600">{error}</p>
    </div>
  {:else if permissionStatus === 'denied'}
    <div class="card p-6 text-center">
      <div class="w-16 h-16 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        </svg>
      </div>
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Permiso de Ubicacion Requerido</h2>
      <p class="text-gray-600 mb-4">
        Para usar el mapa de entregas, necesitas permitir el acceso a tu ubicacion.
        Por favor, habilita el permiso en la configuracion de tu navegador.
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Map -->
      <div class="lg:col-span-2">
        <div class="card overflow-hidden">
          <div class="map-container" bind:this={mapContainer}></div>

          <!-- Map controls overlay -->
          <div class="map-overlay-controls">
            <button
              onclick={centerOnMe}
              class="map-btn"
              title="Centrar en mi ubicacion"
              disabled={!currentLocation}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </button>
          </div>

          <!-- Location status bar -->
          <div class="location-status-bar">
            {#if currentLocation}
              <div class="status-item">
                <span class="status-dot online"></span>
                GPS activo
              </div>
              <div class="status-item text-xs text-gray-500">
                Precision: ~{Math.round(currentLocation.accuracy)}m
              </div>
            {:else}
              <div class="status-item">
                <span class="status-dot offline"></span>
                Sin ubicacion
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Controls & Remesas -->
      <div class="space-y-4">
        <!-- Tracking Controls -->
        <div class="card p-4">
          <h3 class="font-semibold text-gray-900 mb-4">Control de Ubicacion</h3>

          <div class="space-y-3">
            <!-- Tracking toggle -->
            <button
              onclick={toggleTracking}
              class="w-full flex items-center justify-between p-3 rounded-lg border {isTracking ? 'bg-success-50 border-success-200' : 'bg-gray-50 border-gray-200'}"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full {isTracking ? 'bg-success-100' : 'bg-gray-100'} flex items-center justify-center">
                  <svg class="w-5 h-5 {isTracking ? 'text-success-600' : 'text-gray-500'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
                <div class="text-left">
                  <p class="font-medium text-gray-900">Rastreo GPS</p>
                  <p class="text-xs text-gray-500">
                    {isTracking ? 'Activo' : 'Desactivado'}
                  </p>
                </div>
              </div>
              <div class="w-12 h-6 rounded-full {isTracking ? 'bg-success-500' : 'bg-gray-300'} relative transition-colors">
                <div class="absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform {isTracking ? 'translate-x-6' : 'translate-x-0.5'}"></div>
              </div>
            </button>

            <!-- Sharing toggle -->
            <button
              onclick={toggleSharing}
              class="w-full flex items-center justify-between p-3 rounded-lg border {isSharing ? 'bg-primary-50 border-primary-200' : 'bg-gray-50 border-gray-200'}"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full {isSharing ? 'bg-primary-100' : 'bg-gray-100'} flex items-center justify-center">
                  <svg class="w-5 h-5 {isSharing ? 'text-primary-600' : 'text-gray-500'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </div>
                <div class="text-left">
                  <p class="font-medium text-gray-900">Compartir con Clientes</p>
                  <p class="text-xs text-gray-500">
                    {isSharing ? 'Clientes pueden ver tu ubicacion' : 'Ubicacion privada'}
                  </p>
                </div>
              </div>
              <div class="w-12 h-6 rounded-full {isSharing ? 'bg-primary-500' : 'bg-gray-300'} relative transition-colors">
                <div class="absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform {isSharing ? 'translate-x-6' : 'translate-x-0.5'}"></div>
              </div>
            </button>
          </div>
        </div>

        <!-- Remesas en proceso -->
        <div class="card p-4">
          <h3 class="font-semibold text-gray-900 mb-4">
            Entregas en Proceso
            {#if remesasEnProceso.length > 0}
              <span class="badge bg-primary-100 text-primary-700 ml-2">{remesasEnProceso.length}</span>
            {/if}
          </h3>

          {#if remesasEnProceso.length === 0}
            <p class="text-gray-500 text-sm text-center py-4">
              No tienes entregas en proceso
            </p>
          {:else}
            <div class="space-y-2">
              {#each remesasEnProceso as remesa}
                <button
                  onclick={() => selectRemesa(remesa)}
                  class="w-full text-left p-3 rounded-lg border transition-colors {selectedRemesa?.id === remesa.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}"
                >
                  <div class="flex items-start justify-between">
                    <div>
                      <p class="font-medium text-gray-900">{remesa.beneficiario_nombre}</p>
                      <p class="text-xs text-gray-500 mt-1">{remesa.beneficiario_direccion}</p>
                    </div>
                    <span class="font-semibold text-primary-600">
                      {remesa.monto_entrega.toLocaleString()} {remesa.moneda_entrega}
                    </span>
                  </div>
                  <p class="text-xs text-gray-400 mt-2">#{remesa.codigo}</p>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  .map-container {
    height: 500px;
    width: 100%;
    position: relative;
  }

  @media (max-width: 768px) {
    .map-container {
      height: 350px;
    }
  }

  .map-overlay-controls {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .map-btn {
    width: 40px;
    height: 40px;
    background: white;
    border: none;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
  }

  .map-btn:hover:not(:disabled) {
    background: #f3f4f6;
  }

  .map-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .map-btn svg {
    width: 20px;
    height: 20px;
    color: #374151;
  }

  .location-status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
    font-size: 13px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-dot.online {
    background: #22c55e;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
  }

  .status-dot.offline {
    background: #9ca3af;
  }

  /* Custom marker styles */
  :global(.my-location-marker) {
    background: none !important;
    border: none !important;
  }

  :global(.marker-dot) {
    width: 24px;
    height: 24px;
    position: relative;
  }

  :global(.marker-dot::before) {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 14px;
    height: 14px;
    background: #2563eb;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
  }

  :global(.marker-pulse) {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 40px;
    background: rgba(37, 99, 235, 0.2);
    border-radius: 50%;
    animation: pulse 2s ease-out infinite;
  }

  @keyframes pulse {
    0% {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(1.5);
      opacity: 0;
    }
  }
</style>
