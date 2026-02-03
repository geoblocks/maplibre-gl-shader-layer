import maplibregl, { type MapMouseEvent } from "maplibre-gl";
import { getStyle } from "basemapkit";
import { Protocol } from "pmtiles";
import { glyphs, lang, pmtiles, sprite } from "./constant";
import { DistanceTiledLayer, Colormap } from "../lib";

function createDistanceColormap(distanceKm: number): Colormap {
  return Colormap.fromColormapDescription([
    0,
    "rgba(9, 14, 31, 0.0)",
    distanceKm,
    "rgba(9, 14, 31, 0.0)",
    distanceKm * 1.05,
    "rgba(9, 14, 31, 0.6)",
    Math.max(distanceKm * 2, 10),
    "rgba(9, 14, 31, 0.6)",
  ]);
}

function sliderValueToRadius(sliderVal: string): number {
  return Math.max(0.1, Number.parseFloat(sliderVal) ** 2 * 3000);
}

export async function distanceDemo(globe: boolean) {
  maplibregl.addProtocol("pmtiles", new Protocol().tile);

  const container = document.getElementById("map");
  if (!container) throw new Error('There is no div with the id: "map" ');

  const seriesSlider = document.getElementById("series-slider") as HTMLInputElement;
  if (!seriesSlider) throw new Error("Slider not working");

  const opacitySlider = document.getElementById("opacity-slider") as HTMLInputElement;
  if (!opacitySlider) throw new Error("Slider not working");
  opacitySlider.min = "0.01";
  opacitySlider.max = "1";
  opacitySlider.step = "0.01";
  opacitySlider.value = "0.2";

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
    globe,
  });

  const center = { lng: 27.35, lat: 38.92 };

  const map = new maplibregl.Map({
    container,
    hash: false,
    zoom: 4,
    center,
    style: style,
    maxPitch: 89,
  });

  await new Promise((resolve) => map.on("load", resolve));

  const radius = sliderValueToRadius(opacitySlider.value);
  const layer = new DistanceTiledLayer("distance-layer", {
    referencePosition: center,
    colormap: createDistanceColormap(radius),
  });
  map.addLayer(layer);

  opacitySlider.addEventListener("input", () => {
    const radius = sliderValueToRadius(opacitySlider.value);
    createDistanceColormap(Number.parseFloat(opacitySlider.value));
    layer.setColormap(createDistanceColormap(radius));
  });

  map.on("mousemove", async (e: MapMouseEvent) => {
    layer.setRefeferenceLocation(e.lngLat);
  });
}
