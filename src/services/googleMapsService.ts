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

export async function getDistanceBetween(origins: Coordinates | string, destinations: Coordinates | string): Promise<DistanceResult> {
  // Accept either coordinates or address strings. Convert coordinates to 'lat,lng'
  const originParam = typeof origins === 'string' ? origins : `${origins.lat},${origins.lng}`;
  const destParam = typeof destinations === 'string' ? destinations : `${destinations.lat},${destinations.lng}`;

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

  const res = await axios.get(url, { params });
  const data = res.data;

  if (!data || data.status !== 'OK') {
    throw new Error(`Distance Matrix API error: ${data?.status || 'no response'}`);
  }

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    throw new Error(`Distance Matrix element error: ${element?.status || 'no element'}`);
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
