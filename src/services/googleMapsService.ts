import axios from 'axios';
import { cacheGet, cacheSet } from '../config/redis';

const BASE_URL = 'https://maps.googleapis.com/maps/api';
const API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

if (!API_KEY) {
  // Do not throw at import-time in case environment is set later, but warn.
  console.warn('GOOGLE_MAPS_API_KEY is not set. Google Maps requests will fail until the key is provided.');
} else {
  console.log(`Google Maps API Key loaded: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`);
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * This provides straight-line distance (as the crow flies)
 */
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Fallback distance calculation when Google Maps API is not available
 * Uses Haversine formula for coordinate-based calculation
 */
function getFallbackDistance(origin: string, destination: string): DistanceResult {
  // Try to parse coordinates from strings (format: "lat,lng")
  const originCoords = origin.split(',').map(s => parseFloat(s.trim()));
  const destCoords = destination.split(',').map(s => parseFloat(s.trim()));

  let distanceMeters = 10000; // Default 10km if parsing fails

  if (originCoords.length === 2 && destCoords.length === 2 &&
      !isNaN(originCoords[0]!) && !isNaN(originCoords[1]!) &&
      !isNaN(destCoords[0]!) && !isNaN(destCoords[1]!)) {
    // Calculate actual straight-line distance
    distanceMeters = calculateHaversineDistance(
      originCoords[0]!, originCoords[1]!,
      destCoords[0]!, destCoords[1]!
    );

    // Add 30% to account for roads not being straight lines
    distanceMeters = distanceMeters * 1.3;
  }

  const distanceKm = (distanceMeters / 1000).toFixed(1);
  // Estimate duration assuming average speed of 25 km/h in Lagos traffic
  const durationSeconds = Math.round((distanceMeters / 1000) * (60 / 25) * 60);

  return {
    distanceMeters: Math.round(distanceMeters),
    durationSeconds,
    distanceText: `${distanceKm} km`,
    durationText: `${Math.round(durationSeconds / 60)} mins`
  };
}

export async function getDistanceBetween(origins: Coordinates | string, destinations: Coordinates | string): Promise<DistanceResult> {
  // Accept either coordinates or address strings. Convert coordinates to 'lat,lng'
  const originParam = typeof origins === 'string' ? origins : `${origins.lat},${origins.lng}`;
  const destParam = typeof destinations === 'string' ? destinations : `${destinations.lat},${destinations.lng}`;

  // Check if we should use fallback (no API key or USE_FALLBACK_DISTANCE env var set)
  const useFallback = !API_KEY || process.env.USE_FALLBACK_DISTANCE === 'true';

  if (useFallback) {
    console.log('Using fallback distance calculation (Google Maps API not configured)');
    return getFallbackDistance(originParam, destParam);
  }

  const url = `${BASE_URL}/distancematrix/json`;
  const params = {
    origins: originParam,
    destinations: destParam,
    key: API_KEY,
    mode: 'driving',
    units: 'metric'
  } as any;

  const cacheKey = `gm:dist:${originParam}:${destParam}`;
  const cached = await cacheGet<DistanceResult>(cacheKey);
  if (cached) return cached;

  try {
    const res = await axios.get(url, { params });
    const data = res.data;

    if (!data || data.status !== 'OK') {
      // Fallback on API error
      console.warn(`Distance Matrix API error: ${data?.status || 'no response'}. Using fallback calculation.`);
      return getFallbackDistance(originParam, destParam);
    }

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      console.warn(`Distance Matrix element error: ${element?.status || 'no element'}. Using fallback calculation.`);
      return getFallbackDistance(originParam, destParam);
    }

    const result = {
      distanceMeters: element.distance.value,
      durationSeconds: element.duration.value,
      distanceText: element.distance.text,
      durationText: element.duration.text
    };

    // Cache the result for 1 hour
    await cacheSet(cacheKey, result, 3600);
    return result;
  } catch (error: any) {
    // Fallback on request failure
    console.warn(`Distance Matrix API request failed: ${error.message}. Using fallback calculation.`);
    return getFallbackDistance(originParam, destParam);
  }
}


// export async function getPlaceDetails(placeId: string, sessiontoken?: string): Promise<any> {
//   const cacheKey = `gm:place:${placeId}`;
//   const cached = await cacheGet<any>(cacheKey);
//   if (cached) return cached;

//   const url = `${BASE_URL}/place/details/json`;
//   const params: any = {
//     place_id: placeId,
//     key: API_KEY,
//     fields: 'formatted_address,geometry,address_component'
//   };
//   if (sessiontoken) params.sessiontoken = sessiontoken;

//   const res = await axios.get(url, { params });
//   const data = res.data;
//   if (!data || data.status !== 'OK') {
//     throw new Error(`Places Details API error: ${data?.status || 'no response'}`);
//   }

//   await cacheSet(cacheKey, data.result, 60 * 60 * 24); // cache 24 hours
//   return data.result;
// }

// export async function autocompletePlace(input: string, sessiontoken?: string, components?: string): Promise<any> {
//   const url = `${BASE_URL}/place/autocomplete/json`;
//   const params: any = {
//     input,
//     key: API_KEY,
//     types: 'address'
//   };
//   if (sessiontoken) params.sessiontoken = sessiontoken;
//   if (components) params.components = components; // e.g. 'country:ng'

//   const res = await axios.get(url, { params });
//   const data = res.data;
//   if (!data || data.status !== 'OK') {
//     throw new Error(`Places Autocomplete API error: ${data?.status || 'no response'}`);
//   }

//   return data; // caller can pick predictions
// }
