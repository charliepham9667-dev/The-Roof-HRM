/**
 * Geofence utilities for clock-in/out at The Roof
 * Location: 1A Vo Nguyen Giap, Da Nang, Vietnam
 * Default coordinates: 16.0544° N, 108.2022° E
 * Default radius: 100 meters
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeofenceResult {
  isWithinGeofence: boolean;
  distanceMeters: number;
  accuracy?: number;
  error?: string;
}

// The Roof venue default location
export const THE_ROOF_LOCATION: Coordinates = {
  latitude: 16.054400,
  longitude: 108.202200,
};

export const DEFAULT_GEOFENCE_RADIUS = 100; // meters

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param coord1 - First coordinate
 * @param coord2 - Second coordinate
 * @returns Distance in meters
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371000; // Earth's radius in meters
  
  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);
  const deltaLat = toRadians(coord2.latitude - coord1.latitude);
  const deltaLon = toRadians(coord2.longitude - coord1.longitude);
  
  const a = 
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if coordinates are within the venue geofence
 * @param userCoords - User's current coordinates
 * @param venueCoords - Venue coordinates (defaults to The Roof)
 * @param radiusMeters - Geofence radius in meters (default 100m)
 */
export function isWithinGeofence(
  userCoords: Coordinates,
  venueCoords: Coordinates = THE_ROOF_LOCATION,
  radiusMeters: number = DEFAULT_GEOFENCE_RADIUS
): GeofenceResult {
  const distance = calculateDistance(userCoords, venueCoords);
  
  return {
    isWithinGeofence: distance <= radiusMeters,
    distanceMeters: Math.round(distance),
  };
}

/**
 * Get current position using browser Geolocation API
 * @param options - Geolocation options
 * @returns Promise with coordinates or error
 */
export function getCurrentPosition(
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000, // 1 minute cache
  }
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/**
 * Check if user is at the venue (combines geolocation + geofence check)
 * @param venueCoords - Venue coordinates
 * @param radiusMeters - Geofence radius
 */
export async function checkVenuePresence(
  venueCoords: Coordinates = THE_ROOF_LOCATION,
  radiusMeters: number = DEFAULT_GEOFENCE_RADIUS
): Promise<GeofenceResult> {
  try {
    const position = await getCurrentPosition();
    
    const userCoords: Coordinates = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    
    const result = isWithinGeofence(userCoords, venueCoords, radiusMeters);
    
    return {
      ...result,
      accuracy: position.coords.accuracy,
    };
  } catch (error) {
    const geoError = error as GeolocationPositionError;
    
    let errorMessage = 'Unable to determine location';
    
    switch (geoError.code) {
      case GeolocationPositionError.PERMISSION_DENIED:
        errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
        break;
      case GeolocationPositionError.POSITION_UNAVAILABLE:
        errorMessage = 'Location unavailable. Please try again.';
        break;
      case GeolocationPositionError.TIMEOUT:
        errorMessage = 'Location request timed out. Please try again.';
        break;
    }
    
    return {
      isWithinGeofence: false,
      distanceMeters: -1,
      error: errorMessage,
    };
  }
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 0) return 'Unknown';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Get device info string for clock records
 */
export function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  
  // Simple parsing for common devices
  let device = 'Unknown';
  let browser = 'Unknown';
  
  // Device detection
  if (/iPhone/.test(ua)) device = 'iPhone';
  else if (/iPad/.test(ua)) device = 'iPad';
  else if (/Android/.test(ua)) device = 'Android';
  else if (/Mac/.test(ua)) device = 'Mac';
  else if (/Windows/.test(ua)) device = 'Windows';
  else if (/Linux/.test(ua)) device = 'Linux';
  
  // Browser detection
  if (/Chrome/.test(ua) && !/Chromium|Edge/.test(ua)) browser = 'Chrome';
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Firefox/.test(ua)) browser = 'Firefox';
  else if (/Edge/.test(ua)) browser = 'Edge';
  
  return `${device}, ${browser}`;
}

/**
 * Check if geolocation is available in this browser
 */
export function isGeolocationAvailable(): boolean {
  return 'geolocation' in navigator;
}

/**
 * Request location permission (prompts user if not already granted)
 */
export async function requestLocationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch {
    // Permissions API not supported, try to get position which will prompt
    return 'prompt';
  }
}
