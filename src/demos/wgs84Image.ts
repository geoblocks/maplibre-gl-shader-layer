import maplibregl from "maplibre-gl";
import { getStyle, setLayerOpacity } from "basemapkit";
import { Protocol } from "pmtiles";

import { glyphs, lang, pmtiles, sprite } from "./constant";
import {
  RemoteWgs84TextureTiledLayer,
  type RemoteWgs84TextureTiledLayerOptions,
} from "../lib/layers/RemoteWgs84TextureTiledLayer";

const demoConfig: Record<string, RemoteWgs84TextureTiledLayerOptions> = {
  "france-hi-magma": {
    textureUrl: "/demo-tilesets/wgs84/france_hi_magma.png",
    geoBoundingBox: {
      lonMin: -12.005,
      lonMax: 16.005,
      latMin: 37.495,
      latMax: 55.405,
    },
    bicubic: true,
  },

  "europe-magma": {
    textureUrl: "/demo-tilesets/wgs84/europe_magma.png",
    geoBoundingBox: {
      lonMin: -32.05,
      lonMax: 42.05,
      latMin: 19.95,
      latMax: 72.05,
    },
    bicubic: true,
  },

  "global-magma": {
    textureUrl: "/demo-tilesets/wgs84/global_magma.png",
    geoBoundingBox: {
      lonMin: -180,
      lonMax: 180,
      latMin: -90,
      latMax: 90,
    },
    bicubic: true,
  },

  "global-0-360": {
    textureUrl: "/demo-tilesets/wgs84/rh_0-360.png",
    geoBoundingBox: {
      lonMin: 0,
      lonMax: 360,
      latMin: -90,
      latMax: 90,
    },
    bicubic: true,
  },

  "NZ-antemeridian": {
    textureUrl: "/demo-tilesets/wgs84/NZ.png",
    geoBoundingBox: {
      lonMin: 160,
      lonMax: -160,
      latMin: -50,
      latMax: -30,
    },
    bicubic: true,
  },

  "NZ-antemeridian2": {
    textureUrl: "/demo-tilesets/wgs84/NZ.png",
    geoBoundingBox: {
      lonMin: 160,
      lonMax: 200,
      latMin: -50,
      latMax: -30,
    },
    bicubic: true,
  },

  "NZ-antemeridian3": {
    textureUrl: "/demo-tilesets/wgs84/NZ.png",
    geoBoundingBox: {
      lonMin: -200,
      lonMax: -160,
      latMin: -50,
      latMax: -30,
    },
    bicubic: true,
  },

  "blue-marble": {
    textureUrl:
      "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/june/world.200406.3x5400x2700.jpg",
    geoBoundingBox: {
      lonMin: -180,
      lonMax: 180,
      latMin: -90,
      latMax: 90,
    },
    bicubic: true,
  },
};

export async function wgs84ImageDemo(globe: boolean, demoName: keyof typeof demoConfig) {
  maplibregl.addProtocol("pmtiles", new Protocol().tile);

  const container = document.getElementById("map");
  if (!container) throw new Error('There is no div with the id: "map" ');

  const seriesSlider = document.getElementById("series-slider") as HTMLInputElement;
  if (!seriesSlider) throw new Error("Slider not working");

  const opacitySlider = document.getElementById("opacity-slider") as HTMLInputElement;
  if (!opacitySlider) throw new Error("Slider not working");
  opacitySlider.value = "1";

  const pickindDisplay = document.getElementById("picking-display");
  if (!pickindDisplay) throw new Error("Picking display not working");

  const dateDisplay = document.getElementById("date-display");
  if (!dateDisplay) throw new Error("Date display not working");

  [seriesSlider, pickindDisplay, dateDisplay].forEach((el) => el.style.setProperty("display", "none"));

  let style = getStyle("spectre", {
    pmtiles,
    sprite,
    glyphs,
    lang,
    hidePOIs: true,
    globe,
  });

  // Adjust style for the demo
  style = setLayerOpacity("water", 0.2, style);

  const map = new maplibregl.Map({
    container,
    hash: true,
    // zoom: 4,
    // center: [27.35, 38.92],
    style: style,
    maxPitch: 89,
  });

  console.log(style);

  await new Promise((resolve) => map.on("load", resolve));

  // Add the WGS84 image layer
  const layer = new RemoteWgs84TextureTiledLayer("wgs84-layer", demoConfig[demoName]);
  map.addLayer(layer, "earth");

  opacitySlider.addEventListener("input", () => {
    layer.setOpacity(Number.parseFloat(opacitySlider.value));
  });
}
