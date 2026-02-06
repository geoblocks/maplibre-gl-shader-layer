import maplibregl from "maplibre-gl";
import { getStyle } from "basemapkit";
import { Protocol } from "pmtiles";

import { glyphs, lang, pmtiles, sprite } from "./constant";
import { RemoteTextureTiledLayer } from "../lib";

export async function simpletextureDemo() {
  maplibregl.addProtocol("pmtiles", new Protocol().tile);

  const container = document.getElementById("map");
  if (!container) throw new Error('There is no div with the id: "map" ');

  const seriesSlider = document.getElementById("series-slider") as HTMLInputElement;
  if (!seriesSlider) throw new Error("Slider not working");

  const opacitySlider = document.getElementById("opacity-slider") as HTMLInputElement;
  if (!opacitySlider) throw new Error("Slider not working");
  opacitySlider.value = "0.6";

  const pickindDisplay = document.getElementById("picking-display");
  if (!pickindDisplay) throw new Error("Picking display not working");

  const dateDisplay = document.getElementById("date-display");
  if (!dateDisplay) throw new Error("Date display not working");

  [seriesSlider, pickindDisplay, dateDisplay].forEach((el) => el.style.setProperty("display", "none"));

  const style = getStyle("avenue", {
    pmtiles,
    sprite,
    glyphs,
    lang,
    hidePOIs: true,
  });

  const map = new maplibregl.Map({
    container,
    hash: false,
    zoom: 4,
    center: [27.35, 38.92],
    style: style,
    maxPitch: 89,
  });

  await new Promise((resolve) => map.on("load", resolve));

  // const layer = new RemoteTextureTiledLayer("texture-layer", {
  //   textureUrlPattern: "/demo-tilesets/wind_speed_10m/2025-11-03T12:00:00Z/{z}/{x}/{y}.webp",
  //   minZoom: 0,
  //   maxZoom: 4,
  // });

  const layer = new RemoteTextureTiledLayer("texture-layer", {
    textureUrlPattern:
      "https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg?access_token=pk.eyJ1Ijoiam9uYXRoYW5sdXJpZSIsImEiOiJyQ0ZEVnZVIn0.1AhMgc1ZIGhsc_HCSSgL-w",
    minZoom: 0,
    maxZoom: 20,
  });

  layer.setOpacity(Number.parseFloat(opacitySlider.value));
  map.addLayer(layer);

  opacitySlider.addEventListener("input", () => {
    layer.setOpacity(Number.parseFloat(opacitySlider.value));
  });
}
