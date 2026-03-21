// services/stationService.js
// Fetches nearby gas station prices from MyGasFeed API.
// Docs: http://www.mygasfeed.com/keys/app/request

const axios = require("axios");

const MYGASFEED_BASE = "http://api.mygasfeed.com/stations";

// Fuel type codes used by MyGasFeed
const FUEL_TYPES = {
  regular: "reg",
  midgrade: "mid",
  premium: "pre",
  diesel: "dsl",
};

/**
 * Find gas stations within a radius of a lat/lng coordinate.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusMiles – Default 10
 * @param {string} fuelType    – "regular" | "midgrade" | "premium" | "diesel"
 * @param {string} sortBy      – "distance" | "price"
 */
async function getStationsByLocation({ lat, lng, radiusMiles = 10, fuelType = "regular", sortBy = "distance" }) {
  const apiKey = process.env.MYGASFEED_API_KEY;
  const fuelCode = FUEL_TYPES[fuelType] || "reg";

  if (!apiKey || apiKey === "your_mygasfeed_api_key_here") {
    console.warn("[MyGasFeed] No API key — serving mock data");
    return buildMockStations(lat, lng);
  }

  try {
    const url = `${MYGASFEED_BASE}/radius/${lat}/${lng}/${radiusMiles}/${fuelCode}/${sortBy}/${apiKey}.json`;
    const { data } = await axios.get(url, { timeout: 8000 });

    if (!data?.stations || data.status?.code !== "200") {
      throw new Error(data?.status?.message || "Invalid response from MyGasFeed");
    }

    return {
      stations: data.stations.map(normalizeStation),
      count: data.stations.length,
      query: { lat, lng, radiusMiles, fuelType, sortBy },
      source: "MyGasFeed",
    };
  } catch (err) {
    console.error("[MyGasFeed] error:", err.message);
    return buildMockStations(lat, lng);
  }
}

/**
 * Find stations by ZIP code.
 */
async function getStationsByZip({ zip, radiusMiles = 10, fuelType = "regular", sortBy = "distance" }) {
  const apiKey = process.env.MYGASFEED_API_KEY;
  const fuelCode = FUEL_TYPES[fuelType] || "reg";

  if (!apiKey || apiKey === "your_mygasfeed_api_key_here") {
    return buildMockStations(null, null, zip);
  }

  try {
    const url = `${MYGASFEED_BASE}/zip/${zip}/${radiusMiles}/${fuelCode}/${sortBy}/${apiKey}.json`;
    const { data } = await axios.get(url, { timeout: 8000 });

    if (!data?.stations) throw new Error("No stations in response");

    return {
      stations: data.stations.map(normalizeStation),
      count: data.stations.length,
      query: { zip, radiusMiles, fuelType, sortBy },
      source: "MyGasFeed",
    };
  } catch (err) {
    console.error("[MyGasFeed] ZIP error:", err.message);
    return buildMockStations(null, null, zip);
  }
}

/**
 * Normalize a raw MyGasFeed station object into a consistent shape.
 */
function normalizeStation(raw) {
  return {
    id:        raw.id || raw.station_id,
    name:      raw.station  || raw.name || "Unknown",
    address:   raw.address  || "",
    city:      raw.city     || "",
    state:     raw.region   || raw.state || "",
    zip:       raw.postal_code || raw.zip || "",
    lat:       parseFloat(raw.lat),
    lng:       parseFloat(raw.lng),
    distance:  parseFloat(raw.distance || 0),
    prices: {
      regular: raw.reg_price  ? parseFloat(raw.reg_price)  : null,
      midgrade:raw.mid_price  ? parseFloat(raw.mid_price)  : null,
      premium: raw.pre_price  ? parseFloat(raw.pre_price)  : null,
      diesel:  raw.dsl_price  ? parseFloat(raw.dsl_price)  : null,
    },
    updatedAt: raw.reg_date || raw.updated || null,
  };
}

function buildMockStations(lat, lng, zip) {
  const baseLat = lat || 30.27;
  const baseLng = lng || -97.74;
  return {
    stations: [
      { id:"m1", name:"Shell",      address:"1234 Main St",   city:"Austin", state:"TX", zip:"78701", lat:baseLat+0.01, lng:baseLng-0.01, distance:0.6, prices:{regular:2.85,midgrade:3.05,premium:3.35,diesel:3.15}, updatedAt:new Date().toISOString() },
      { id:"m2", name:"Chevron",    address:"5678 Oak Ave",   city:"Austin", state:"TX", zip:"78701", lat:baseLat+0.02, lng:baseLng-0.02, distance:1.2, prices:{regular:2.89,midgrade:3.09,premium:3.39,diesel:3.19}, updatedAt:new Date().toISOString() },
      { id:"m3", name:"ExxonMobil", address:"9012 Elm Rd",    city:"Austin", state:"TX", zip:"78702", lat:baseLat-0.01, lng:baseLng+0.01, distance:1.8, prices:{regular:2.91,midgrade:3.11,premium:3.41,diesel:3.21}, updatedAt:new Date().toISOString() },
      { id:"m4", name:"BP",         address:"3456 Pine Blvd", city:"Austin", state:"TX", zip:"78702", lat:baseLat+0.03, lng:baseLng-0.03, distance:2.1, prices:{regular:2.87,midgrade:3.07,premium:3.37,diesel:3.17}, updatedAt:new Date().toISOString() },
      { id:"m5", name:"Marathon",   address:"7890 Cedar Ln",  city:"Austin", state:"TX", zip:"78703", lat:baseLat-0.02, lng:baseLng+0.02, distance:2.5, prices:{regular:2.83,midgrade:3.03,premium:3.33,diesel:3.13}, updatedAt:new Date().toISOString() },
      { id:"m6", name:"Valero",     address:"2345 Sunset Dr", city:"Austin", state:"TX", zip:"78703", lat:baseLat-0.03, lng:baseLng+0.03, distance:3.0, prices:{regular:2.79,midgrade:2.99,premium:3.29,diesel:3.09}, updatedAt:new Date().toISOString() },
    ],
    count: 6,
    query: { lat, lng, zip },
    source: "mock — add MYGASFEED_API_KEY to .env for live data",
  };
}

module.exports = { getStationsByLocation, getStationsByZip };
