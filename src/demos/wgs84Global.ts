import maplibregl from "maplibre-gl";
import { getStyle, setLayerOpacity } from "basemapkit";
import { Protocol } from "pmtiles";

import { glyphs, lang, pmtiles, sprite } from "./constant";
import { RemoteWgs84TextureTiledLayer } from "../lib/layers/RemoteWgs84TextureTiledLayer";

export async function wgs84GlobalDemo(globe: boolean) {
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
    hash: false,
    zoom: 4,
    center: [27.35, 38.92],
    style: style,
    maxPitch: 89,
  });

  console.log(style);

  await new Promise((resolve) => map.on("load", resolve));

  // const layer = new RemoteWgs84TextureTiledLayer("wgs84-layer", {
  //   textureUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/3840px-Blue_Marble_2002.png",
  //   geoBoundingBox: {
  //     lonMin: -180,
  //     lonMax: 180,
  //     latMin: -90,
  //     latMax: 90,
  //   },
  // });
  // map.addLayer(layer, "water");

  /*
  const layer = new RemoteWgs84TextureTiledLayer("wgs84-layer", {
    textureUrl: "/demo-tilesets/wgs84/global_magma.png",
    geoBoundingBox: {
      lonMin: -180,
      lonMax: 180,
      latMin: -90,
      latMax: 90,
      // lonMin: -180.125,
      // lonMax: 179.875,
      // latMin: -90.125,
      // latMax: 90.125,
    },
  });
  map.addLayer(layer, "earth");
  */

  // const layer = new RemoteWgs84TextureTiledLayer("wgs84-layer", {
  //   textureUrl: "/demo-tilesets/wgs84/europe_magma.png",
  //   geoBoundingBox: {
  //     lonMin: -32.05,
  //     lonMax: 42.05,
  //     latMin: 19.95,
  //     latMax: 72.05,
  //   },
  // });
  // map.addLayer(layer, "earth");

  const layer = new RemoteWgs84TextureTiledLayer("wgs84-layer", {
    textureUrl: "/demo-tilesets/wgs84/france_hi_magma.png",
    geoBoundingBox: {
      lonMin: -12.005,
      lonMax: 16.005,
      latMin: 37.495,
      latMax: 55.405,
    },
  });
  map.addLayer(layer, "earth");

  opacitySlider.addEventListener("input", () => {
    layer.setOpacity(Number.parseFloat(opacitySlider.value));
  });
}
