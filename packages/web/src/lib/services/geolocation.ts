/**
 * Geolocation Service
 * Handles GPS location tracking for delivery drivers
 */

import { browser } from '$app/environment';
import { apiClient } from '$utils/api';

// Types
export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  timestamp: number;
}

export interface GeolocationServiceOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  updateInterval?: number;
}

export type LocationCallback = (location: LocationData) => void;
export type ErrorCallback = (error: GeolocationPositionError) => void;

// Default options
const DEFAULT_OPTIONS: Required<GeolocationServiceOptions> = {
  enableHighAccuracy: true,
  maximumAge: 10000,      // 10 seconds
  timeout: 15000,         // 15 seconds
  updateInterval: 30000,  // 30 seconds between server updates
};

// Track if geolocation is supported
let _isSupported: boolean | null = null;

/**
 * Check if Geolocation API is supported
 */
export function isGeolocationSupported(): boolean {
  if (_isSupported !== null) {
    return _isSupported;
  }

  _isSupported = browser && 'geolocation' in navigator;
  return _isSupported;
}

/**
 * Request permission for geolocation
 */
export async function requestGeolocationPermission(): Promise<PermissionState> {
  if (!browser) {
    return 'denied';
  }

  try {
    // Try permissions API first
    if ('permissions' in navigator) {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      return permission.state;
    }

    // Fallback: Try to get a single position to trigger permission prompt
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            resolve('denied');
          } else {
            resolve('prompt');
          }
        },
        { timeout: 5000 }
      );
    });
  } catch (error) {
    console.error('[Geolocation] Error checking permission:', error);
    return 'prompt';
  }
}

/**
 * Get current position (single shot)
 */
export async function getCurrentPosition(
  options?: GeolocationServiceOptions
): Promise<LocationData> {
  if (!isGeolocationSupported()) {
    throw new Error('Geolocation no es soportado en este dispositivo');
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(positionToLocationData(position));
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: opts.enableHighAccuracy,
        maximumAge: opts.maximumAge,
        timeout: opts.timeout,
      }
    );
  });
}

/**
 * Convert GeolocationPosition to LocationData
 */
function positionToLocationData(position: GeolocationPosition): LocationData {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    speed: position.coords.speed,
    heading: position.coords.heading,
    altitude: position.coords.altitude,
    timestamp: position.timestamp,
  };
}

/**
 * GeolocationTracker class for continuous tracking
 */
export class GeolocationTracker {
  private watchId: number | null = null;
  private lastServerUpdate: number = 0;
  private options: Required<GeolocationServiceOptions>;
  private locationCallback: LocationCallback | null = null;
  private errorCallback: ErrorCallback | null = null;
  private remesaId: number | null = null;
  private isSharing: boolean = false;

  constructor(options?: GeolocationServiceOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Start tracking location
   */
  start(
    onLocation: LocationCallback,
    onError?: ErrorCallback,
    remesaId?: number
  ): boolean {
    if (!isGeolocationSupported()) {
      console.error('[Geolocation] Not supported');
      return false;
    }

    if (this.watchId !== null) {
      console.warn('[Geolocation] Already tracking');
      return true;
    }

    this.locationCallback = onLocation;
    this.errorCallback = onError || null;
    this.remesaId = remesaId || null;
    this.isSharing = true;

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePosition(position),
      (error) => this.handleError(error),
      {
        enableHighAccuracy: this.options.enableHighAccuracy,
        maximumAge: this.options.maximumAge,
        timeout: this.options.timeout,
      }
    );

    console.log('[Geolocation] Started tracking');
    return true;
  }

  /**
   * Stop tracking location
   */
  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.locationCallback = null;
      this.errorCallback = null;
      this.isSharing = false;
      console.log('[Geolocation] Stopped tracking');
    }
  }

  /**
   * Check if currently tracking
   */
  isTracking(): boolean {
    return this.watchId !== null;
  }

  /**
   * Set the current remesa being delivered
   */
  setRemesaId(remesaId: number | null): void {
    this.remesaId = remesaId;
  }

  /**
   * Handle position update
   */
  private handlePosition(position: GeolocationPosition): void {
    const locationData = positionToLocationData(position);

    // Call the callback
    if (this.locationCallback) {
      this.locationCallback(locationData);
    }

    // Update server if enough time has passed
    const now = Date.now();
    if (this.isSharing && now - this.lastServerUpdate >= this.options.updateInterval) {
      this.sendToServer(locationData);
      this.lastServerUpdate = now;
    }
  }

  /**
   * Handle position error
   */
  private handleError(error: GeolocationPositionError): void {
    console.error('[Geolocation] Error:', error.message);

    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }

  /**
   * Send location to server
   */
  private async sendToServer(location: LocationData): Promise<void> {
    try {
      await apiClient.post('/api/repartidor/ubicacion', {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading,
        altitude: location.altitude,
        remesa_id: this.remesaId,
        timestamp: new Date(location.timestamp).toISOString(),
      });
    } catch (error) {
      console.error('[Geolocation] Failed to send location to server:', error);
    }
  }
}

/**
 * Calculate distance between two points (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Get human-readable error message
 */
export function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Permiso de ubicacion denegado. Por favor, habilita el acceso a la ubicacion en la configuracion de tu dispositivo.';
    case error.POSITION_UNAVAILABLE:
      return 'No se pudo determinar tu ubicacion. Asegurate de tener GPS habilitado.';
    case error.TIMEOUT:
      return 'Se agoto el tiempo de espera para obtener la ubicacion. Intenta de nuevo.';
    default:
      return 'Error desconocido al obtener la ubicacion.';
  }
}

/**
 * Singleton instance for app-wide tracking
 */
let globalTracker: GeolocationTracker | null = null;

export function getGlobalTracker(options?: GeolocationServiceOptions): GeolocationTracker {
  if (!globalTracker) {
    globalTracker = new GeolocationTracker(options);
  }
  return globalTracker;
}

export function disposeGlobalTracker(): void {
  if (globalTracker) {
    globalTracker.stop();
    globalTracker = null;
  }
}
