import { mkdir, writeFile } from "node:fs/promises";

const API_BASE = "https://qingpowuwu.goatcounter.com/api/v0";
const OUTPUT_FILE = "data/visitor-locations.json";
const START_DATE = "2020-01-01T00:00:00Z";
const PAGE_SIZE = 100;

const token = process.env.GOATCOUNTER_API_TOKEN;
if (!token) {
  throw new Error("GOATCOUNTER_API_TOKEN is required");
}

const endDate = new Date();
endDate.setUTCMinutes(0, 0, 0);

const countryTotals = new Map();
let offset = 0;
let hasMore = true;

while (hasMore) {
  const url = new URL(`${API_BASE}/stats/locations`);
  url.searchParams.set("start", START_DATE);
  url.searchParams.set("end", endDate.toISOString());
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`GoatCounter API returned ${response.status}: ${await response.text()}`);
  }

  const page = await response.json();
  for (const item of page.stats || []) {
    const code = String(item.id || "").split("-")[0].toUpperCase();
    const previous = countryTotals.get(code) || { code, name: item.name || code || "Unknown", count: 0 };
    previous.count += Number(item.count) || 0;
    countryTotals.set(code, previous);
  }

  hasMore = Boolean(page.more);
  offset += PAGE_SIZE;
}

const allLocations = [...countryTotals.values()];
const output = {
  generatedAt: new Date().toISOString(),
  totalVisitors: allLocations.reduce((total, item) => total + item.count, 0),
  countries: allLocations
    .filter(item => /^[A-Z]{2}$/.test(item.code))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
};

await mkdir("data", { recursive: true });
await writeFile(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Updated ${OUTPUT_FILE} with ${output.totalVisitors} visits from ${output.countries.length} countries/regions.`);
