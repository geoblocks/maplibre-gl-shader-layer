import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { weatherDemo } from "./demos/weather";
import { dummyDemo } from "./demos/dummy";
import { weatherDaylightDemo } from "./demos/weatherdaylight";
import { daylightDemo } from "./demos/daylight";
import { simpletextureDemo } from "./demos/remotetexture";
import { canvasTextureDemo } from "./demos/canvastexture";
import { distanceDemo } from "./demos/distance";
import { wgs84ImageDemo } from "./demos/wgs84Image";

const demos = {
  dummy: () => {
    dummyDemo(true);
  },

  "dummy-mercator": () => {
    dummyDemo(false);
  },

  distance: () => {
    distanceDemo(true);
  },

  "day-night": () => {
    daylightDemo();
  },

  "canvas-texture": () => {
    canvasTextureDemo();
  },

  "remote-texture": () => {
    simpletextureDemo();
  },

  temperature: () => {
    weatherDemo("temperature_2m");
  },

  windspeed: () => {
    weatherDemo("wind_speed_10m");
  },

  "temperature-day-night": () => {
    weatherDaylightDemo("temperature_2m");
  },

  "windspeed-day-night": () => {
    weatherDaylightDemo("wind_speed_10m");
  },

  "wgs84-blue-marble": () => {
    wgs84ImageDemo(true, "blue-marble");
  },

  "wgs84-global": () => {
    wgs84ImageDemo(true, "global-magma");
  },

  "wgs84-europe": () => {
    wgs84ImageDemo(true, "europe-magma");
  },

  "wgs84-france": () => {
    wgs84ImageDemo(true, "france-hi-magma");
  },

  "wgs84-global-0-360": () => {
    wgs84ImageDemo(true, "global-0-360");
  },

  "NZ-antemeridian": () => {
    wgs84ImageDemo(true, "NZ-antemeridian");
  },

  "NZ-antemeridian2": () => {
    wgs84ImageDemo(true, "NZ-antemeridian2");
  },

  "NZ-antemeridian3": () => {
    wgs84ImageDemo(true, "NZ-antemeridian3");
  },
} as const;

(() => {
  const params = new URLSearchParams(window.location.search);
  const demoNameParam = params.get("demo");

  if (demoNameParam && demoNameParam in demos) {
    demos[demoNameParam as keyof typeof demos]();
  } else {
    location.href = "?demo=temperature";
  }

  const demoDropdown = document.getElementById("demo-dropdown") as HTMLSelectElement;

  for (const demoName in demos) {
    const demoSelectOption = document.createElement("option");
    demoSelectOption.innerText = demoName;
    demoSelectOption.value = demoName;
    demoDropdown.append(demoSelectOption);

    if (demoNameParam === demoName) {
      demoDropdown.value = demoName;
    }
  }

  demoDropdown.addEventListener("input", () => {
    location.href = `?demo=${demoDropdown.value}`;
  });
})();
