import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { weatherDemo } from "./demos/weather";
import { dummyDemo } from "./demos/dummy";
import { weatherDaylightDemo } from "./demos/weatherdaylight";
import { daylightDemo } from "./demos/daylight";
import { simpletextureDemo } from "./demos/remotetexture";
import { canvasTextureDemo } from "./demos/canvastexture";
import { distanceDemo } from "./demos/distance";
import { wgs84GlobalDemo } from "./demos/wgs84Global";

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

  "wgs84-global": () => {
    wgs84GlobalDemo(true);
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
