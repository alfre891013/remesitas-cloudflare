<script lang="ts">
  import { browser } from '$app/environment';
  import { apiClient } from '$utils/api';

  interface LocationPoint {
    latitude: number;
    longitude: number;
    timestamp?: string;
  }

  interface Props {
    remesaCodigo?: string;
    currentLocation?: LocationPoint | null;
    route?: LocationPoint[];
    height?: string;
    showControls?: boolean;
  }

  let {
    remesaCodigo = '',
    currentLocation = null,
    route = [],
    height = '400px',
    showControls = true,
  }: Props = $props();

  let mapContainer: HTMLDivElement | null = $state(null);
  let map: any = $state(null);
  let marker: any = $state(null);
  let routeLine: any = $state(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let lastUpdate = $state<Date | null>(null);
  let trackingData = $state<{
    tracking_available: boolean;
    current_location?: LocationPoint;
    route?: LocationPoint[];
    message?: string;
  } | null>(null);

  // Default center (Havana, Cuba)
  const DEFAULT_CENTER: [number, number] = [23.1136, -82.3666];
  const DEFAULT_ZOOM = 12;

  // Load tracking data if remesaCodigo is provided
  $effect(() => {
    if (browser && remesaCodigo) {
      loadTrackingData();
      // Refresh every 30 seconds
      const interval = setInterval(loadTrackingData, 30000);
      return () => clearInterval(interval);
    }
  });

  // Initialize map when container is ready
  $effect(() => {
    if (browser && mapContainer && !map) {
      initMap();
    }
  });

  // Update map when location changes
  $effect(() => {
    if (map && (currentLocation || trackingData?.current_location)) {
      updateMapLocation();
    }
  });

  async function loadTrackingData() {
    if (!remesaCodigo) return;

    isLoading = true;
    error = null;

    try {
      const response = await apiClient.get<{ data: typeof trackingData }>(
        `/api/ubicacion/remesa/${remesaCodigo}`
      );

      if (response.success && response.data) {
        trackingData = response.data;
        lastUpdate = new Date();

        if (trackingData.tracking_available) {
          updateMapLocation();
        }
      } else {
        error = response.message || 'Error al cargar ubicacion';
      }
    } catch (e) {
      error = 'Error de conexion';
    } finally {
      isLoading = false;
    }
  }

  async function initMap() {
    if (!browser || !mapContainer) return;

    try {
      // Dynamically import Leaflet
      const L = await import('leaflet');

      // Import Leaflet CSS
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Create map
      map = L.map(mapContainer).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

      // Add tile layer (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Custom marker icon
      const deliveryIcon = L.divIcon({
        className: 'delivery-marker',
        html: `
          <div class="marker-pin">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
            </svg>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

      // Create marker if we have a location
      const location = currentLocation || trackingData?.current_location;
      if (location) {
        marker = L.marker([location.latitude, location.longitude], { icon: deliveryIcon }).addTo(
          map
        );
        map.setView([location.latitude, location.longitude], 15);
      }
    } catch (e) {
      console.error('Error initializing map:', e);
      error = 'Error al cargar el mapa';
    }
  }

  async function updateMapLocation() {
    if (!map) return;

    const location = currentLocation || trackingData?.current_location;
    if (!location) return;

    try {
      const L = await import('leaflet');

      // Update or create marker
      if (marker) {
        marker.setLatLng([location.latitude, location.longitude]);
      } else {
        const deliveryIcon = L.divIcon({
          className: 'delivery-marker',
          html: `
            <div class="marker-pin">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
              </svg>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
        });

        marker = L.marker([location.latitude, location.longitude], { icon: deliveryIcon }).addTo(
          map
        );
      }

      // Draw route if available
      const routePoints = route.length > 0 ? route : trackingData?.route || [];
      if (routePoints.length > 1) {
        if (routeLine) {
          map.removeLayer(routeLine);
        }

        const latLngs = routePoints.map((p) => [p.latitude, p.longitude]);
        routeLine = L.polyline(latLngs as [number, number][], {
          color: '#2563eb',
          weight: 3,
          opacity: 0.7,
          dashArray: '10, 10',
        }).addTo(map);
      }

      // Pan to location
      map.panTo([location.latitude, location.longitude]);
    } catch (e) {
      console.error('Error updating map:', e);
    }
  }

  function centerOnLocation() {
    const location = currentLocation || trackingData?.current_location;
    if (map && location) {
      map.setView([location.latitude, location.longitude], 15);
    }
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<div class="delivery-map-container" style="height: {height}">
  {#if error}
    <div class="map-error">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p>{error}</p>
      <button onclick={loadTrackingData}>Reintentar</button>
    </div>
  {:else if trackingData && !trackingData.tracking_available}
    <div class="map-unavailable">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <p>{trackingData.message || 'Rastreo no disponible'}</p>
    </div>
  {:else}
    <div class="map-wrapper" bind:this={mapContainer}></div>

    {#if showControls}
      <div class="map-controls">
        {#if isLoading}
          <span class="loading-indicator">
            <span class="spinner"></span>
            Actualizando...
          </span>
        {:else if lastUpdate}
          <span class="last-update">
            Actualizado: {formatTime(lastUpdate)}
          </span>
        {/if}

        <button class="center-btn" onclick={centerOnLocation} title="Centrar en ubicacion">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <button class="refresh-btn" onclick={loadTrackingData} title="Actualizar ubicacion">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .delivery-map-container {
    position: relative;
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    background: #f3f4f6;
  }

  .map-wrapper {
    width: 100%;
    height: 100%;
  }

  .map-error,
  .map-unavailable {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 24px;
    text-align: center;
    color: #6b7280;
  }

  .map-error svg,
  .map-unavailable svg {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    color: #9ca3af;
  }

  .map-error p,
  .map-unavailable p {
    margin-bottom: 16px;
    font-size: 14px;
  }

  .map-error button {
    background: #2563eb;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .map-error button:hover {
    background: #1d4ed8;
  }

  .map-controls {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 1000;
  }

  .loading-indicator,
  .last-update {
    background: white;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    color: #6b7280;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid #e5e7eb;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .center-btn,
  .refresh-btn {
    background: white;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
  }

  .center-btn:hover,
  .refresh-btn:hover {
    background: #f3f4f6;
    transform: translateY(-1px);
  }

  .center-btn svg,
  .refresh-btn svg {
    width: 20px;
    height: 20px;
    color: #374151;
  }

  /* Custom marker styles */
  :global(.delivery-marker) {
    background: none !important;
    border: none !important;
  }

  :global(.delivery-marker .marker-pin) {
    width: 40px;
    height: 40px;
    background: #2563eb;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
    animation: bounce 0.5s ease-out;
  }

  :global(.delivery-marker .marker-pin svg) {
    width: 24px;
    height: 24px;
    transform: rotate(45deg);
    color: white;
  }

  @keyframes bounce {
    0%, 100% { transform: rotate(-45deg) translateY(0); }
    50% { transform: rotate(-45deg) translateY(-10px); }
  }
</style>
