// services/geocodeService.js
// Converts a city name or ZIP code into lat/lng coordinates.
// Uses Google Geocoding API when available; falls back to a static ZIP lookup.

const axios = require("axios");

/**
 * Geocode a query string (city, ZIP, or address) → { lat, lng, formattedAddress }
 */
async function geocode(query) {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;

  if (apiKey && apiKey !== "your_google_api_key_here") {
    return googleGeocode(query, apiKey);
  }

  // Fallback: match US ZIP codes client-side with a minimal lookup table
  return fallbackGeocode(query);
}

async function googleGeocode(query, apiKey) {
  try {
    const { data } = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: { address: query, components: "country:US", key: apiKey },
        timeout: 6000,
      }
    );

    if (data.status !== "OK" || !data.results.length) {
      throw new Error(`Geocoding failed: ${data.status}`);
    }

    const result = data.results[0];
    const { lat, lng } = result.geometry.location;

    // Extract state abbreviation from address components
    const stateComp = result.address_components.find(c =>
      c.types.includes("administrative_area_level_1")
    );

    return {
      lat,
      lng,
      formattedAddress: result.formatted_address,
      state: stateComp?.short_name || null,
      source: "google",
    };
  } catch (err) {
    console.error("[Geocode] Google error:", err.message);
    return fallbackGeocode(query);
  }
}

// Minimal fallback: major US city centroids + ZIP prefix mapping
const CITY_COORDS = {
  "new york":    { lat:40.7128, lng:-74.0060, state:"NY" },
  "los angeles": { lat:34.0522, lng:-118.2437, state:"CA" },
  "chicago":     { lat:41.8781, lng:-87.6298, state:"IL" },
  "houston":     { lat:29.7604, lng:-95.3698, state:"TX" },
  "phoenix":     { lat:33.4484, lng:-112.0740, state:"AZ" },
  "philadelphia":{ lat:39.9526, lng:-75.1652, state:"PA" },
  "san antonio": { lat:29.4241, lng:-98.4936, state:"TX" },
  "san diego":   { lat:32.7157, lng:-117.1611, state:"CA" },
  "dallas":      { lat:32.7767, lng:-96.7970, state:"TX" },
  "austin":      { lat:30.2672, lng:-97.7431, state:"TX" },
  "san jose":    { lat:37.3382, lng:-121.8863, state:"CA" },
  "seattle":     { lat:47.6062, lng:-122.3321, state:"WA" },
  "denver":      { lat:39.7392, lng:-104.9903, state:"CO" },
  "boston":      { lat:42.3601, lng:-71.0589, state:"MA" },
  "miami":       { lat:25.7617, lng:-80.1918, state:"FL" },
  "atlanta":     { lat:33.7490, lng:-84.3880, state:"GA" },
  "minneapolis": { lat:44.9778, lng:-93.2650, state:"MN" },
  "portland":    { lat:45.5231, lng:-122.6765, state:"OR" },
  "las vegas":   { lat:36.1699, lng:-115.1398, state:"NV" },
  "nashville":   { lat:36.1627, lng:-86.7816, state:"TN" },
};

// ZIP prefix → approximate centre
const ZIP_PREFIX_COORDS = {
  "0": { lat:42.0, lng:-72.0, state:"MA" },
  "1": { lat:40.7, lng:-74.0, state:"NY" },
  "2": { lat:38.9, lng:-77.0, state:"DC" },
  "3": { lat:33.5, lng:-84.0, state:"GA" },
  "4": { lat:41.5, lng:-83.0, state:"OH" },
  "5": { lat:44.0, lng:-93.0, state:"MN" },
  "6": { lat:41.8, lng:-87.6, state:"IL" },
  "7": { lat:32.0, lng:-97.0, state:"TX" },
  "8": { lat:39.7, lng:-104.9, state:"CO" },
  "9": { lat:37.0, lng:-120.0, state:"CA" },
};

function fallbackGeocode(query) {
  const q = query.trim().toLowerCase();

  // Try city name match
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (q.includes(city)) {
      return {
        ...coords,
        formattedAddress: query,
        source: "fallback-city",
      };
    }
  }

  // Try ZIP code (5 digits)
  const zipMatch = q.match(/\b(\d{5})\b/);
  if (zipMatch) {
    const prefix = zipMatch[1][0];
    const coords = ZIP_PREFIX_COORDS[prefix] || { lat:39.5, lng:-98.35, state:"KS" };
    return { ...coords, formattedAddress: zipMatch[1], source: "fallback-zip" };
  }

  // Default to US geographic centre
  return { lat:39.5, lng:-98.35, state:"KS", formattedAddress:query, source:"fallback-default" };
}

module.exports = { geocode };
