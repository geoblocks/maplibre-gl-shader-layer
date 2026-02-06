import maplibregl, { type LngLat, MercatorCoordinate } from "maplibre-gl";

export type TileIndex = {
  z: number;
  x: number;
  y: number;
};

export type TileBoundsUnwrapped = {
  min: TileIndex;
  max: TileIndex;
};

export type TileUnwrappedPosition = {
  /**
   * Position in mercator coordinate. Since it's unwrapped, x can be lower then 0 or higher than 1
   */
  center: [number, number];

  /**
   * both height and width, because tiles are square-shaped
   */
  size: number;
};

/**
 * Get a string ID from a given tile index
 */
export function tileIndexToString(tileIndex: TileIndex): string {
  return `${tileIndex.z}_${tileIndex.x}_${tileIndex.y}`;
}

/**
 * Given a mercator coordinates and a zoom level, get a tile index
 */
function mercatorToTileIndex(
  /**
   * Mercator coordinates (north-west is [0, 0], sourth-east is [1, 1])
   */
  position: [number, number],
  /**
   * Zoom level
   */
  zoom: number,
  /**
   * Returns integer tile indices if `true` or floating-point values if `false`
   */
  strict = true,
): TileIndex {
  const numberOfTilePerAxis = 2 ** zoom;

  const tileIndex: TileIndex = {
    z: zoom,
    x: position[0] * numberOfTilePerAxis,
    y: position[1] * numberOfTilePerAxis,
  };

  if (strict) {
    tileIndex.x = Math.floor(tileIndex.x);
    tileIndex.y = Math.floor(tileIndex.y);
  }

  return tileIndex;
}

/**
 * Given a wgs84 coordinate and a zoom level, get a tile index
 */
export function wgs84ToTileIndex(position: LngLat, zoom: number, strict = true): TileIndex {
  const merCoord = MercatorCoordinate.fromLngLat(position);
  return mercatorToTileIndex([merCoord.x, merCoord.y], zoom, strict);
}

/**
 * Get the tile index (unwrapped) bounds for a given Maplibre map view
 */
export function getTileBoundsUnwrapped(map: maplibregl.Map, z: number): TileBoundsUnwrapped {
  const bounds = map.getBounds();
  const nwMerc = maplibregl.MercatorCoordinate.fromLngLat(bounds.getNorthWest());
  const seMerc = maplibregl.MercatorCoordinate.fromLngLat(bounds.getSouthEast());

  // Y is always in [0, 1]
  const eps = 0.000001;
  nwMerc.y = Math.max(nwMerc.y, 0);
  nwMerc.y = Math.min(nwMerc.y, 1 - eps);
  seMerc.y = Math.max(seMerc.y, 0);
  seMerc.y = Math.min(seMerc.y, 1 - eps);

  // Compute unwrapped tile indices for a given z
  const nwTile = mercatorToTileIndex([nwMerc.x, nwMerc.y], z, true);
  const seTile = mercatorToTileIndex([seMerc.x, seMerc.y], z, true);

  return {
    min: {
      z: z,
      x: nwTile.x,
      y: nwTile.y,
    },
    max: {
      z: z,
      x: seTile.x,
      y: seTile.y,
    },
  };
}

/**
 * Get the list of tile (unwrapped) from a given tile bounds
 */
export function tileBoundsUnwrappedToTileList(tbu: TileBoundsUnwrapped): TileIndex[] {
  const allTileIndices: TileIndex[] = [];
  const z = tbu.min.z;

  for (let y = tbu.min.y; y <= tbu.max.y; y += 1) {
    for (let x = tbu.min.x; x <= tbu.max.x; x += 1) {
      allTileIndices.push({ z, x, y });
    }
  }
  return allTileIndices;
}

/**
 * Get the mercator position of the center of a given tile
 */
export function tileIndexToMercatorPosition(ti: TileIndex): TileUnwrappedPosition {
  const size = 1 / 2 ** ti.z;
  const centerX = (ti.x + 0.5) * size;
  const centerY = (ti.y + 0.5) * size;
  return {
    size,
    center: [centerX, centerY],
  };
}

/**
 * Wrap a tile index
 */
export function wrapTileIndex(tileIndex: TileIndex): TileIndex {
  const nbTilePerAxis = 2 ** tileIndex.z;
  let x = tileIndex.x % nbTilePerAxis;
  if (x < 0) {
    x = nbTilePerAxis + x;
  }
  return {
    x: x,
    y: tileIndex.y,
    z: tileIndex.z,
  } as TileIndex;
}

/**
 * Given a tile index, get the mercator tile size
 */
export function tileIndexToMercatorCenterAndSize(ti: TileIndex): {
  mercCenter: maplibregl.MercatorCoordinate;
  mercSize: number;
} {
  const nbTiles = 2 ** ti.z;
  const mercSize = 1 / nbTiles;
  const mercCenter = new maplibregl.MercatorCoordinate(ti.x * mercSize + mercSize / 2, ti.y * mercSize + mercSize / 2);

  return {
    mercSize,
    mercCenter,
  };
}

/**
 * Checks if the center and the corners of a tile are visible in viewport
 */
export function isTileInViewport(
  ti: TileIndex,
  map: maplibregl.Map,
  mapcanvasWidth: number,
  mapCanvasHeight: number,
): boolean {
  const { mercCenter, mercSize } = tileIndexToMercatorCenterAndSize(ti);

  // using a 5% margin around the
  const canvasMarginW = mapcanvasWidth * 0.05;
  const canvasMarginH = mapCanvasHeight * 0.05;
  const mapCanvasWidthLowerBound = -canvasMarginW;
  const mapCanvasWidthUpperBound = mapcanvasWidth + canvasMarginW;
  const mapCanvasHeightLowerBound = -canvasMarginH;
  const mapCanvasHeightUpperBound = mapCanvasHeight + canvasMarginH;
  let screenPos = map.project(mercCenter.toLngLat());

  if (
    screenPos.x >= mapCanvasWidthLowerBound &&
    screenPos.x <= mapCanvasWidthUpperBound &&
    screenPos.y >= mapCanvasHeightLowerBound &&
    screenPos.y <= mapCanvasHeightUpperBound
  ) {
    return true;
  }

  const halfMercSize = mercSize / 2;
  const mercTopLeft = new maplibregl.MercatorCoordinate(mercCenter.x - halfMercSize, mercCenter.y - halfMercSize);
  screenPos = map.project(mercTopLeft.toLngLat());

  if (
    screenPos.x >= mapCanvasWidthLowerBound &&
    screenPos.x <= mapCanvasWidthUpperBound &&
    screenPos.y >= mapCanvasHeightLowerBound &&
    screenPos.y <= mapCanvasHeightUpperBound
  ) {
    return true;
  }

  const mercTopRight = new maplibregl.MercatorCoordinate(mercCenter.x + halfMercSize, mercCenter.y - halfMercSize);
  screenPos = map.project(mercTopRight.toLngLat());

  if (
    screenPos.x >= mapCanvasWidthLowerBound &&
    screenPos.x <= mapCanvasWidthUpperBound &&
    screenPos.y >= mapCanvasHeightLowerBound &&
    screenPos.y <= mapCanvasHeightUpperBound
  ) {
    return true;
  }

  const mercBottomLeft = new maplibregl.MercatorCoordinate(mercCenter.x - halfMercSize, mercCenter.y + halfMercSize);
  screenPos = map.project(mercBottomLeft.toLngLat());

  if (
    screenPos.x >= mapCanvasWidthLowerBound &&
    screenPos.x <= mapCanvasWidthUpperBound &&
    screenPos.y >= mapCanvasHeightLowerBound &&
    screenPos.y <= mapCanvasHeightUpperBound
  ) {
    return true;
  }

  const mercBottomRight = new maplibregl.MercatorCoordinate(mercCenter.x + halfMercSize, mercCenter.y + halfMercSize);
  screenPos = map.project(mercBottomRight.toLngLat());

  if (
    screenPos.x >= mapCanvasWidthLowerBound &&
    screenPos.x <= mapCanvasWidthUpperBound &&
    screenPos.y >= mapCanvasHeightLowerBound &&
    screenPos.y <= mapCanvasHeightUpperBound
  ) {
    return true;
  }

  return false;
}

/**
 * Modulo function, as opposed to javascript's `%`, which is a remainder.
 * This functions will return positive values, even if the first operand is negative.
 */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Projects a point within a tile to the surface of the unit sphere globe.
 * @param inTileX - X coordinate inside the tile in range [0 .. 8192].
 * @param inTileY - Y coordinate inside the tile in range [0 .. 8192].
 * @param tileIdX - Tile's X coordinate in range [0 .. 2^zoom - 1].
 * @param tileIdY - Tile's Y coordinate in range [0 .. 2^zoom - 1].
 * @param tileIdZ - Tile's zoom.
 * @returns A 3D vector - coordinates of the projected point on a unit sphere.
 */
export function projectTileCoordinatesToSphere(
  inTileX: number,
  inTileY: number,
  tileIdX: number,
  tileIdY: number,
  tileIdZ: number,
  nbSections: number,
): [number, number, number] {
  // This code could be assembled from 3 fuctions, but this is a hot path for symbol placement,
  // so for optimization purposes everything is inlined by hand.
  //
  // Non-inlined variant of this function would be this:
  //     const mercator = tileCoordinatesToMercatorCoordinates(inTileX, inTileY, tileID);
  //     const angular = mercatorCoordinatesToAngularCoordinatesRadians(mercator.x, mercator.y);
  //     const sphere = angularCoordinatesRadiansToVector(angular[0], angular[1]);
  //     return sphere;
  const scale = 1.0 / (1 << tileIdZ);
  const mercatorX = (inTileX / nbSections) * scale + tileIdX * scale;
  const mercatorY = (inTileY / nbSections) * scale + tileIdY * scale;
  const sphericalX = mod(mercatorX * Math.PI * 2.0 + Math.PI, Math.PI * 2);
  const sphericalY = 2.0 * Math.atan(Math.exp(Math.PI - mercatorY * Math.PI * 2.0)) - Math.PI * 0.5;
  const len = Math.cos(sphericalY);
  return [Math.sin(sphericalX) * len, Math.sin(sphericalY), Math.cos(sphericalX) * len];
}

export function projectTileCoordinatesToSphereUV(
  u: number,
  v: number,
  tileIdX: number,
  tileIdY: number,
  tileIdZ: number,
): [number, number, number] {
  // This code could be assembled from 3 fuctions, but this is a hot path for symbol placement,
  // so for optimization purposes everything is inlined by hand.
  //
  // Non-inlined variant of this function would be this:
  //     const mercator = tileCoordinatesToMercatorCoordinates(inTileX, inTileY, tileID);
  //     const angular = mercatorCoordinatesToAngularCoordinatesRadians(mercator.x, mercator.y);
  //     const sphere = angularCoordinatesRadiansToVector(angular[0], angular[1]);
  //     return sphere;
  const scale = 1.0 / (1 << tileIdZ);
  const mercatorX = u * scale + tileIdX * scale;
  const mercatorY = v * scale + tileIdY * scale;
  const sphericalX = mod(mercatorX * Math.PI * 2.0 + Math.PI, Math.PI * 2);
  const sphericalY = 2.0 * Math.atan(Math.exp(Math.PI - mercatorY * Math.PI * 2.0)) - Math.PI * 0.5;
  const len = Math.cos(sphericalY);
  return [Math.sin(sphericalX) * len, Math.sin(sphericalY), Math.cos(sphericalX) * len];
}

export function clamp(range: [number, number], value: number): number {
  if (value < range[0]) {
    return range[0];
  }

  if (value > range[1]) {
    return range[1];
  }

  return value;
}

/**
 * Get the pixel value in an HTMLImageElement with a nearest neighbor approach.
 * unitPosition is a texture position, meaning in interval [0, 1]
 */
export function pickImg(img: HTMLImageElement, unitPosition: [number, number]): Uint8ClampedArray | null {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  const x = Math.floor(unitPosition[0] * img.width);
  const y = Math.floor(unitPosition[1] * img.height);

  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(x, y, 1, 1).data;
}

/**
 * Returns true is two matrices are equal
 */
export function matricesEqual(a: number[], b: number[], tolerance = 1e-6): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > tolerance) return false;
  }
  return true;
}
