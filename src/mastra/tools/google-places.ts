import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import axios from 'axios';

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyAgbQvK5FZC_2liZ9mM6a7-HJSz8lC4CoQ';

// ── Shared place schema ─────────────────────────────────────────────────────
const placeSchema = z.object({
  id: z.string(),
  displayName: z.object({
    text: z.string(),
    languageCode: z.string().optional(),
  }),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  formattedAddress: z.string().optional(),
  types: z.array(z.string()).optional(),
  primaryType: z.string().optional(),
  internationalPhoneNumber: z.string().optional(),
  websiteUri: z.string().optional(),
  regularOpeningHours: z.object({
    openNow: z.boolean().optional(),
    weekdayDescriptions: z.array(z.string()).optional(),
  }).optional(),
  priceLevel: z.string().optional(),
});

// ── getPlaceDetails ─────────────────────────────────────────────────────────
export const getPlaceDetails = createTool({
  id: 'get-place-details',
  description:
    'Fetch detailed information for a specific business using its Google Places place_id. ' +
    'Returns name, rating, review count, address, coordinates, type, and opening hours.',
  inputSchema: z.object({
    place_id: z.string().describe('Google Places API place ID (e.g. ChIJ...)'),
  }),
  outputSchema: placeSchema,
  execute: async ({ place_id }) => {
    const config = {
      method: 'get' as const,
      url: `https://places.googleapis.com/v1/places/${place_id}`,
      params: { languageCode: 'ar' },
      headers: {
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask':
          'id,displayName,rating,userRatingCount,location,formattedAddress,' +
          'types,primaryType,internationalPhoneNumber,websiteUri,' +
          'regularOpeningHours,priceLevel',
      },
    };

    const response = await axios.request(config);
    console.log('Place details fetched:', response.data?.displayName?.text);
    return response.data;
  },
});

// ── getNearbyPlaces ─────────────────────────────────────────────────────────
export const getNearbyPlaces = createTool({
  id: 'get-places-nearby',
  description:
    'Search for nearby competitor cafés/coffee shops using Google Places Nearby Search. ' +
    'Use lat/lon from the target business location and set radius based on business density ' +
    '(500–2000m for urban areas, up to 5000m for less-dense areas). ' +
    'Returns place IDs and basic info for each competitor found.',
  inputSchema: z.object({
    lat: z.number().describe('Latitude of the center point'),
    lon: z.number().describe('Longitude of the center point'),
    radius: z.number().describe('Search radius in meters (500–5000)'),
  }),
  outputSchema: z.object({
    places: z.array(placeSchema),
  }),
  execute: async ({ lat, lon, radius }) => {
    const body = {
      includedTypes: ['cafe', 'coffee_shop', 'coffee_stand'],
      locationRestriction: {
        circle: {
          center: {
            latitude: lat,
            longitude: lon,
          },
          radius,
        },
      },
      languageCode: 'ar',
      rankPreference: 'DISTANCE',
      maxResultCount: 20,
    };

    const config = {
      method: 'post' as const,
      url: 'https://places.googleapis.com/v1/places:searchNearby',
      headers: {
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.rating,places.userRatingCount,' +
          'places.formattedAddress,places.location,places.types,places.primaryType',
        'Content-Type': 'application/json',
      },
      data: body,
    };

    const response = await axios.request(config);
    console.log(
      'Nearby places fetched:',
      response.data?.places?.length ?? 0,
      'competitors',
    );
    return { places: response.data?.places ?? [] };
  },
});
