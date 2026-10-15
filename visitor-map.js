import * as d3 from "https://esm.sh/d3@7.9.0";
import { feature } from "https://esm.sh/topojson-client@3.1.0";
import world from "https://esm.sh/@d3-maps/atlas@1.0.0/world/countries/countries-110m";
import isoCountries from "https://esm.sh/i18n-iso-countries@7.14.0";

const mapElement = document.getElementById("visitor-map");
const summaryElement = document.getElementById("visitor-map-summary");
const topElement = document.getElementById("visitor-map-top");

const formatNumber = new Intl.NumberFormat("en-US");
const width = 960;
const height = 470;

function showError(message) {
  mapElement.innerHTML = `<div class="visitor-map-status">${message}</div>`;
  summaryElement.textContent = "";
  topElement.textContent = "";
}

async function drawVisitorMap() {
  let visitorData;
  try {
    const response = await fetch("data/visitor-locations.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    visitorData = await response.json();
  } catch (error) {
    showError("Visitor statistics are temporarily unavailable.");
    return;
  }

  const counts = new Map();
  const names = new Map();
  for (const item of visitorData.countries || []) {
    const iso3 = isoCountries.alpha2ToAlpha3(item.code);
    if (!iso3) continue;
    counts.set(iso3, Number(item.count) || 0);
    names.set(iso3, item.name || item.code);
  }

  const countries = feature(world, world.objects.features).features;
  const maximum = d3.max(counts.values()) || 1;
  const color = d3.scaleSequentialLog([1, Math.max(2, maximum)], d3.interpolateBlues);
  const projection = d3.geoNaturalEarth1().fitExtent([[8, 8], [width - 8, height - 8]], {
    type: "FeatureCollection",
    features: countries
  });
  const path = d3.geoPath(projection);

  mapElement.replaceChildren();
  const svg = d3.select(mapElement)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-labelledby", "visitor-map-svg-title visitor-map-svg-desc");

  svg.append("title")
    .attr("id", "visitor-map-svg-title")
    .text("Visitor locations by country");
  svg.append("desc")
    .attr("id", "visitor-map-svg-desc")
    .text("Countries are shaded according to the number of visits recorded by GoatCounter.");

  svg.selectAll("path")
    .data(countries)
    .join("path")
    .attr("class", "visitor-map-country")
    .attr("d", path)
    .attr("fill", country => {
      const count = counts.get(country.properties.id) || 0;
      return count > 0 ? color(count) : "#eef1f4";
    })
    .attr("tabindex", country => counts.has(country.properties.id) ? 0 : null)
    .attr("aria-label", country => {
      const id = country.properties.id;
      const count = counts.get(id) || 0;
      const name = names.get(id) || country.properties.name_long || country.properties.name;
      return `${name}: ${formatNumber.format(count)} visits`;
    })
    .append("title")
    .text(country => {
      const id = country.properties.id;
      const name = names.get(id) || country.properties.name_long || country.properties.name;
      return `${name}: ${formatNumber.format(counts.get(id) || 0)} visits`;
    });

  const countryCount = counts.size;
  const total = Number(visitorData.totalVisitors) || 0;
  summaryElement.textContent = `${formatNumber.format(total)} visits · ${formatNumber.format(countryCount)} countries/regions`;

  const topCountries = [...(visitorData.countries || [])]
    .filter(item => item.code && item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  topElement.replaceChildren();
  for (const item of topCountries) {
    const entry = document.createElement("span");
    entry.textContent = `${item.name}: ${formatNumber.format(item.count)}`;
    topElement.append(entry);
  }

  if (total === 0) {
    topElement.textContent = "Collecting the first visits…";
  }
}

drawVisitorMap().catch(() => {
  showError("Visitor statistics are temporarily unavailable.");
});
