// __tests__/api.test.js
// Run with: npm test

const request = require("supertest");
const app     = require("../server");

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("cache");
    expect(res.body.apis).toHaveProperty("eia");
  });
});

describe("GET /api", () => {
  it("returns endpoint index", async () => {
    const res = await request(app).get("/api");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("FuelWatch US API");
    expect(Array.isArray(res.body.endpoints)).toBe(true);
    expect(res.body.endpoints.length).toBeGreaterThan(0);
  });
});

describe("GET /api/prices/states", () => {
  it("returns an object with all 50 state prices", async () => {
    const res = await request(app).get("/api/prices/states");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("prices");
    expect(typeof res.body.prices).toBe("object");
    // Should have at least 48 states (mock has 50)
    expect(Object.keys(res.body.prices).length).toBeGreaterThanOrEqual(48);
    // All prices should be positive numbers
    for (const price of Object.values(res.body.prices)) {
      expect(typeof price).toBe("number");
      expect(price).toBeGreaterThan(0);
    }
    expect(res.body).toHaveProperty("source");
    expect(res.body).toHaveProperty("updatedAt");
  });

  it("second request is served from cache", async () => {
    const res = await request(app).get("/api/prices/states");
    expect(res.status).toBe(200);
    expect(res.body._cached).toBe(true);
  });
});

describe("GET /api/prices/national", () => {
  it("returns a national average price", async () => {
    const res = await request(app).get("/api/prices/national");
    expect(res.status).toBe(200);
    expect(typeof res.body.average).toBe("number");
    expect(res.body.average).toBeGreaterThan(1);
    expect(res.body.average).toBeLessThan(10);
  });
});

describe("GET /api/prices/state/:code", () => {
  it("returns price for a valid state code", async () => {
    const res = await request(app).get("/api/prices/state/CA");
    expect(res.status).toBe(200);
    expect(res.body.state).toBe("CA");
    expect(typeof res.body.price).toBe("number");
  });

  it("is case-insensitive", async () => {
    const res = await request(app).get("/api/prices/state/ca");
    expect(res.status).toBe(200);
    expect(res.body.state).toBe("CA");
  });

  it("returns 400 for invalid state codes", async () => {
    const res = await request(app).get("/api/prices/state/ZZ");
    expect(res.status).toBe(404);
  });

  it("returns 400 for malformed state codes", async () => {
    const res = await request(app).get("/api/prices/state/CALIFORNIA");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/stations", () => {
  it("returns stations for valid lat/lng", async () => {
    const res = await request(app).get("/api/stations?lat=30.27&lng=-97.74");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stations)).toBe(true);
    expect(res.body.stations.length).toBeGreaterThan(0);
    // Check station shape
    const s = res.body.stations[0];
    expect(s).toHaveProperty("id");
    expect(s).toHaveProperty("name");
    expect(s).toHaveProperty("lat");
    expect(s).toHaveProperty("lng");
    expect(s).toHaveProperty("prices");
    expect(s.prices).toHaveProperty("regular");
  });

  it("returns stations by ZIP code", async () => {
    const res = await request(app).get("/api/stations?zip=78701");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stations)).toBe(true);
  });

  it("returns 400 when neither lat/lng nor zip is provided", async () => {
    const res = await request(app).get("/api/stations");
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid fuel type", async () => {
    const res = await request(app).get("/api/stations?lat=30.27&lng=-97.74&fuel=avgas");
    expect(res.status).toBe(400);
  });

  it("caps radius at 50 miles", async () => {
    const res = await request(app).get("/api/stations?lat=30.27&lng=-97.74&radius=999");
    expect(res.status).toBe(200);
    expect(res.body.query.radiusMiles).toBeLessThanOrEqual(50);
  });
});

describe("GET /api/stations/search", () => {
  it("geocodes a city name and returns stations", async () => {
    const res = await request(app).get("/api/stations/search?q=Austin%20TX");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stations)).toBe(true);
    expect(res.body).toHaveProperty("geocode");
    expect(res.body.geocode).toHaveProperty("lat");
    expect(res.body.geocode).toHaveProperty("lng");
  });

  it("returns 400 when q is missing", async () => {
    const res = await request(app).get("/api/stations/search");
    expect(res.status).toBe(400);
  });
});

describe("404 handler", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/api/unknown-route");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
});
