import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_API_KEY =
  process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyAgbQvK5FZC_2liZ9mM6a7-HJSz8lC4CoQ';

export async function POST(req: NextRequest) {
  const { input } = await req.json();

  if (!input?.trim()) {
    return NextResponse.json({ suggestions: [] });
  }

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input, languageCode: 'ar', regionCode: 'sa' }),
  });

  const data = await res.json();
  return NextResponse.json(data);
}
