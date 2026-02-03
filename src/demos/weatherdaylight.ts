import maplibregl, { type MapMouseEvent } from "maplibre-gl";
import { getStyle, setLayerOpacity, swapLayers } from "basemapkit";
import { Protocol } from "pmtiles";
import {
  Colormap,
  MultiChannelSeriesTiledLayer,
  type MultiChannelSeriesTiledLayerSpecification,
  ColormapDescriptionLibrary,
  DaylightTiledLayer,
} from "../lib";
import { glyphs, lang, pmtiles, sprite } from "./constant";

const seriesConfig = {
  temperature_2m: {
    colormap: Colormap.fromColormapDescription(ColormapDescriptionLibrary.turbo, { min: -25, max: 40, reverse: false }),
    style: "spectre-purple",
    swapWaterEarth: false,
    placelayerBeforeId: "water",
    layerOpacity: [{ layerId: "water", opacity: 0.2 }],
  },

  wind_speed_10m: {
    colormap: Colormap.fromColormapDescription(ColormapDescriptionLibrary.bathymetry, { min: 0, max: 22 }),
    style: "spectre-negative",
    swapWaterEarth: true,
    placelayerBeforeId: "earth",
    layerOpacity: [{ layerId: "earth", opacity: 0.3 }],
  },
} as const;

type WeatherVariableId = keyof typeof seriesConfig;

export async function weatherDaylightDemo(weatherVariableId: WeatherVariableId) {
  maplibregl.addProtocol("pmtiles", new Protocol().tile);

  const container = document.getElementById("map");
  if (!container) throw new Error('There is no div with the id: "map" ');

  const seriesSlider = document.getElementById("series-slider") as HTMLInputElement;
  if (!seriesSlider) throw new Error("Slider not working");

  const opacitySlider = document.getElementById("opacity-slider") as HTMLInputElement;
  if (!opacitySlider) throw new Error("Slider not working");

  const pickindDisplay = document.getElementById("picking-display");
  if (!pickindDisplay) throw new Error("Picking display not working");

  const dateDisplay = document.getElementById("date-display");
  if (!dateDisplay) throw new Error("Date display not working");

  const tileUrlPrefix = `/demo-tilesets/${weatherVariableId}/`;
  const seriesInfoUrl = `${tileUrlPrefix}/index.json`;
  const seriesInfoResponse = await fetch(seriesInfoUrl);
  const seriesInfo = (await seriesInfoResponse.json()) as MultiChannelSeriesTiledLayerSpecification;

  seriesSlider.min = seriesInfo.series[0].seriesAxisValue.toString();
  seriesSlider.max = seriesInfo.series[seriesInfo.series.length - 1].seriesAxisValue.toString();

  let style = getStyle(seriesConfig[weatherVariableId].style, {
    pmtiles,
    sprite,
    glyphs,
    lang,
    hidePOIs: true,
  });

  if ("layerOpacity" in seriesConfig[weatherVariableId]) {
    for (const opacityInstruction of seriesConfig[weatherVariableId].layerOpacity as unknown as Array<{
      layerId: string;
      opacity: number;
    }>) {
      style = setLayerOpacity(opacityInstruction.layerId, opacityInstruction.opacity, style);
    }
  }

  if (seriesConfig[weatherVariableId].swapWaterEarth) {
    style = swapLayers("earth", "water", style);
  }

  const map = new maplibregl.Map({
    container,
    hash: true,
    zoom: 4,
    center: [27.35, 38.92],
    style: style,
    maxPitch: 89,
  });

  await new Promise((resolve) => map.on("load", resolve));

  const daylightLayer = new DaylightTiledLayer("daylight", { opacity: 0.9 });
  map.addLayer(daylightLayer, "earth_line");

  const layer = new MultiChannelSeriesTiledLayer("custom-layer", {
    datasetSpecification: seriesInfo,
    colormap: seriesConfig[weatherVariableId].colormap,
    colormapGradient: true,
    tileUrlPrefix,
  });

  if (seriesConfig[weatherVariableId].placelayerBeforeId) {
    map.addLayer(layer, seriesConfig[weatherVariableId].placelayerBeforeId);
  } else {
    map.addLayer(layer);
  }

  seriesSlider.addEventListener("input", () => {
    const sliderTimestamp = Number.parseFloat(seriesSlider.value);
    layer.setSeriesAxisValue(sliderTimestamp);
    updateDisplay();
  });

  const updateDisplay = () => {
    // We could take the one from the slider, but the layer add a safety clapming
    const seriesAxisValue = layer.getSeriesAxisValue();
    const sliderDate = new Date(seriesAxisValue * 1000);

    const dateStr = new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(sliderDate);

    daylightLayer.setDate(sliderDate);
    dateDisplay.innerText = dateStr;
  };

  updateDisplay();

  seriesSlider.addEventListener("pointerenter", () => {
    layer.prefetchSeriesTexture(-15, 15);
  });

  opacitySlider.addEventListener("input", () => {
    daylightLayer.setOpacity(Number.parseFloat(opacitySlider.value));
  });

  map.on("mousemove", async (e: MapMouseEvent) => {
    try {
      const pickingInfo = await layer.pick(e.lngLat);
      if (pickingInfo) {
        pickindDisplay.innerText = `${pickingInfo?.value.toFixed(2)}${pickingInfo?.unit}`;
      } else {
        pickindDisplay.innerText = "[no data]";
      }
    } catch (err) {
      console.log(err);
      pickindDisplay.innerText = "-";
    }
  });
}
