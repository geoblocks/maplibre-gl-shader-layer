/**
 * This is a demo of how to extend ShaderTiledLayer
 * TextureTiledLayer is a layer that simply contains a texture per tile
 */
import type { RawShaderMaterial, ShaderMaterialParameters, Texture } from "three";
import { BaseShaderTiledLayer } from "../core/BaseShaderTiledLayer";
import { clamp, pickImg, wgs84ToTileIndex, type TileIndex } from "../core/tools";
// @ts-ignore
import fragmentShader from "../shaders/multi-channel-series-tile.f.glsl?raw";
import type { Colormap } from "../core/Colormap";
import type { LngLat } from "maplibre-gl";
import { RemoteTileTextureManager } from "../core/RemoteTileTextureManager";

export type Bounds = [number, number, number, number];
export type SeriesElement = {
  /**
   * Pattern to load individual tiles. Assumed to be at the same location
   * as this payload, unless starting by "http://" or "https://"
   * Example: "some-tile/{z}/{x}/{y}.webp"
   */
  tileUrlPattern: string;

  /**
   * Value of this timeset along the dimension that this series defines
   * (since the element of the series are not required to be all equaly spaced)
   * Example:a unix timestamp value, an altitude elevation, etc.
   */
  seriesAxisValue: number;

  /**
   * Custom metadata the user can add and that apply to this particular tileset
   * or "position" along this series axis
   */
  metadata?: Record<string, unknown>;
};

export type RasterEncoding = {
  /**
   * The image channels to be used to obtain the raster value
   */
  channels: string;

  /**
   * If equal to 1, the raster value to compute is a scalar (can use 1, 2 or 3 `channels`)
   * If equal to 2, the raster value to compute is a 2D vector. (must use 2 `channels`)
   * If equal to 3, the raster value to compute is a 3D vector. (must use 3 `channels`)
   */
  vectorDimension?: number;

  /**
   * This is the "a" in "y = ax + b",
   * where:
   *   "x" is the raw value computed from the `channels`
   *   "y" is the value is real world unit (eg. degree celcius)
   *   "b" see below
   */
  polynomialSlope: number;

  /**
   * This is the "b" in "y = ax + b",
   * where:
   *   "x" is the raw value computed from the `channels`
   *   "y" is the value is real world unit (eg. degree celcius)
   *   "a" see above
   */
  polynomialOffset: number;
};

export type MultiChannelSeriesTiledLayerSpecification = {
  /**
   * Name of the dataset
   */
  name: string;

  /**
   * Description of the dataset
   */
  description?: string;

  /**
   * Attribution associated to the dataset
   */
  attribution?: string[];

  /**
   * Bounds of the dataset, in meters, in Mercator projection
   * eg. `[minX, minY, maxX, maxY]`, a.k.a. `[west, south, east, north]`
   */
  bounds: Bounds;

  /**
   * Informative only, should be "EPSG:3857"
   */
  crs?: string;

  /**
   * Minimum zoom level in which tiles are available
   */
  minZoom: number;

  /**
   * Maximum zoom level in which tiles are available
   */
  maxZoom: number;

  /**
   * Size of the tile in pixels (for both width and height)
   */
  tileSize: number;

  /**
   * File format of the tiles. Likely to be png or webp.
   * (Most likely not jpeg due to lossy compression)
   */
  rasterFormat: "png" | "webp";

  /**
   * This section is used for decoding the data
   */
  rasterEncoding: RasterEncoding;

  /**
   * The real world unit of the value computed for each pixel.
   * Could be left empty.
   */
  pixelUnit?: string;

  /**
   * Name to give to the series axis (eg. "time", "depth", "altitude", etc.)
   */
  seriesAxisName: string;

  /**
   * Real world unit of the series axis (eg. "second", "meter", etc.)
   */
  seriesAxisUnit: string;

  /**
   * Extra metadata the use can add to this tileset and that would apply to
   * the whole series
   */
  metadata?: Record<string, unknown>;

  /**
   * The series includes all the tilesets in the relevant order
   */
  series: SeriesElement[];
};

export type CustomSeriesTileTextureLoader = (tileIndex: TileIndex, seriesAxisValue: number) => Promise<Texture | null>;

export type MultiChannelSeriesTiledLayerOptions = {
  datasetSpecification: MultiChannelSeriesTiledLayerSpecification;
  colormap: Colormap;

  /**
   * Whether the colormap should be rendered with gradient (true)
   * or with classes (false)
   * default: true
   */
  colormapGradient?: boolean;

  /**
   * Position to start with when initializing the layer.
   * If not provided, the begining of the series will be used instead
   */
  seriesAxisValue?: number;

  /**
   * Prefix to the tile url
   */
  tileUrlPrefix?: string;

  /**
   * A texture manager can be provided. This can be interesting when multiple
   * layers are using the same textures.
   * If not provided, a default one will be added internaly to this layer.
   */
  remoteTileTextureManager?: RemoteTileTextureManager;

  /**
   * Optionnaly, a custom tile texture loader can be provided if tile textures are not directly
   * stored remotely as single files, require credentials, etc.
   */
  customTileTextureLoader?: CustomSeriesTileTextureLoader;
};

export class MultiChannelSeriesTiledLayer extends BaseShaderTiledLayer {
  private readonly rasterEncoding: RasterEncoding;
  private readonly colormap: Colormap;
  private seriesAxisValue!: number;
  private readonly datasetSpecification: MultiChannelSeriesTiledLayerSpecification;
  private seriesElementBefore!: SeriesElement;
  private indexSeriesElementBefore = 0;
  private seriesElementAfter!: SeriesElement;
  private readonly tileUrlPrefix: string;
  private readonly colormapGradient;
  private readonly remoteTileTextureManager: RemoteTileTextureManager;
  private readonly customTileTextureLoader: CustomSeriesTileTextureLoader | null = null;

  constructor(id: string, options: MultiChannelSeriesTiledLayerOptions) {
    super(id, {
      minZoom: options.datasetSpecification.minZoom,
      maxZoom: options.datasetSpecification.maxZoom,
    });

    if (options.customTileTextureLoader) {
      this.customTileTextureLoader = options.customTileTextureLoader;
    }

    this.colormapGradient = options.colormapGradient ?? true;
    this.tileUrlPrefix = options.tileUrlPrefix ?? "";
    this.datasetSpecification = options.datasetSpecification;
    this.rasterEncoding = options.datasetSpecification.rasterEncoding;
    this.colormap = options.colormap;
    this.setSeriesAxisValue(options.seriesAxisValue ?? this.datasetSpecification.series[0].seriesAxisValue);
    this.remoteTileTextureManager = options.remoteTileTextureManager ?? new RemoteTileTextureManager();
  }

  // Must be implemented
  onSetTileShaderParameters(_tileIndex: TileIndex): ShaderMaterialParameters {
    return {
      uniforms: {
        u_texBefore: { value: null },
        u_texAfter: { value: null },
        u_seriesAxisValueBefore: { value: this.seriesElementBefore.seriesAxisValue },
        u_seriesAxisValueAfter: { value: this.seriesElementAfter.seriesAxisValue },
        u_seriesAxisValue: { value: this.seriesAxisValue },
        u_rasterEncodingPolynomialSlope: { value: this.rasterEncoding.polynomialSlope },
        u_rasterEncodingPolynomialOffset: { value: this.rasterEncoding.polynomialOffset },
        u_colormapRangeMin: { value: this.colormap.getRange().min },
        u_colormapRangeMax: { value: this.colormap.getRange().max },
        u_colormapTex: {
          value: this.colormap.getTexture({
            gradient: this.colormapGradient,
            size: this.colormapGradient ? 512 : 4096,
          }),
        },
      },
      fragmentShader: fragmentShader,
      defines: {
        RASTER_ENCODING_CHANNELS: this.rasterEncoding.channels,
        RASTER_ENCODING_NB_CHANNELS: this.rasterEncoding.channels.length,
      },
    };
  }

  // Must be implemented
  async onTileUpdate(tileIndex: TileIndex, material: RawShaderMaterial) {
    // TODO: Add a signal to cancel the fetching of the texture in case the series axis moves too fast
    // and needs to skip/jump further.

    const texBeforeAfter = await Promise.allSettled([
      this.dualTextureFetcher(tileIndex, this.seriesElementBefore),
      this.dualTextureFetcher(tileIndex, this.seriesElementAfter),
    ]);

    material.uniforms.u_texBefore.value = texBeforeAfter[0].status === "fulfilled" ? texBeforeAfter[0].value : null;
    material.uniforms.u_texAfter.value = texBeforeAfter[1].status === "fulfilled" ? texBeforeAfter[1].value : null;
    material.uniforms.u_seriesAxisValueBefore.value = this.seriesElementBefore.seriesAxisValue;
    material.uniforms.u_seriesAxisValueAfter.value = this.seriesElementAfter.seriesAxisValue;
    material.uniforms.u_seriesAxisValue.value = this.seriesAxisValue;
  }

  /**
   * Get the range of values along the series axis.
   * It is assumed that the first element of the series has a smaller value
   * than the last.
   */
  private getSerieAxisRange(): [number, number] | null {
    const series = this.datasetSpecification.series;
    if (!series.length) {
      return null;
    }

    return [series[0].seriesAxisValue, series[series.length - 1].seriesAxisValue];
  }

  setSeriesAxisValue(pos: number) {
    const range = this.getSerieAxisRange();
    if (!range) {
      return;
    }
    this.seriesAxisValue = clamp(range, pos);
    this.defineCurrentSeriesElement();

    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  getSeriesAxisValue(): number {
    return this.seriesAxisValue;
  }

  private defineCurrentSeriesElement() {
    const series = this.datasetSpecification.series;
    if (!series.length) {
      return null;
    }

    if (series.length === 1) {
      this.indexSeriesElementBefore = 0;
      this.seriesElementBefore = series[0];
      this.seriesElementAfter = series[0];
      return;
    }

    const range = this.getSerieAxisRange();
    if (!range) {
      return;
    }

    if (this.seriesAxisValue <= range[0]) {
      this.indexSeriesElementBefore = 0;
      this.seriesElementBefore = series[0];
      this.seriesElementAfter = series[0];
      return;
    }

    if (this.seriesAxisValue >= range[1]) {
      this.indexSeriesElementBefore = series.length - 1;
      this.seriesElementBefore = series[series.length - 1];
      this.seriesElementAfter = series[series.length - 1];
      return;
    }

    for (let i = 0; i < series.length - 1; i += 1) {
      const seriesI = series[i];
      const seriesNext = series[i + 1];

      if (this.seriesAxisValue >= seriesI.seriesAxisValue && this.seriesAxisValue < seriesNext.seriesAxisValue) {
        this.indexSeriesElementBefore = i;
        this.seriesElementBefore = seriesI;
        this.seriesElementAfter = seriesNext;
        break;
      }
    }
  }

  /**
   * Prefetch texture along the series dimensions for the same tile coverage as the curent.
   * deltaBefore is the number of series elements before the curent position and deltaAfter
   * is the number of elements after the curent position.
   */
  async prefetchSeriesTexture(deltaBefore: number, deltaAfter: number) {
    // Tile indices {x, y, z} of the current tile coverage
    const tileIndices = Array.from(this.usedTileMap.values()).map((tile) => tile.getTileIndex());
    const series = this.datasetSpecification.series;
    const fetchingPromiseList = [];

    const seriesIndexStart = Math.max(0, this.indexSeriesElementBefore + deltaBefore);
    const seriesIndexEnd = Math.min(series.length - 1, this.indexSeriesElementBefore + deltaAfter);

    let counter = 0;

    for (let i = seriesIndexStart; i < seriesIndexEnd + 1; i += 1) {
      if (i < 0) continue;
      if (i >= series.length) break;

      for (const tileIndex of tileIndices) {
        counter++;
        fetchingPromiseList.push(this.dualTextureFetcher(tileIndex, series[i]));
      }
    }

    await Promise.allSettled(fetchingPromiseList);
  }

  /**
   * Get the value and unit at a given position, for the current series axis position.
   */
  async pick(lngLat: LngLat): Promise<{ value: number; unit: string | undefined } | null> {
    const tileIndices = Array.from(this.usedTileMap.values()).map((tile) => tile.getTileIndex());

    // Getting zoom level of current displayed tiles
    const z = tileIndices[0].z;

    const tileToPickUnstrict = wgs84ToTileIndex(lngLat, z, false);
    const tileIndexStrict = {
      z,
      x: Math.floor(tileToPickUnstrict.x),
      y: Math.floor(tileToPickUnstrict.y),
    } as TileIndex;

    const texturesBeforeAfter = await Promise.allSettled([
      this.dualTextureFetcher(tileIndexStrict, this.seriesElementBefore),
      this.dualTextureFetcher(tileIndexStrict, this.seriesElementAfter),
    ]);

    if (texturesBeforeAfter[0].status === "rejected" || texturesBeforeAfter[1].status === "rejected") {
      return null;
    }

    const textureBefore = texturesBeforeAfter[0].value;
    const textureAfter = texturesBeforeAfter[1].value;

    const textureUnitPosition = [
      tileToPickUnstrict.x - tileIndexStrict.x,
      tileToPickUnstrict.y - tileIndexStrict.y,
    ] as [number, number];

    const valuePixelBefore = pickImg(textureBefore.image, textureUnitPosition);
    const valuePixelAfter = pickImg(textureAfter.image, textureUnitPosition);

    if (!valuePixelBefore || !valuePixelAfter) return null;

    const channels = Array.from(this.datasetSpecification.rasterEncoding.channels);
    const valuePixelBeforeObj: Record<string, number> = {
      r: valuePixelBefore[0],
      g: valuePixelBefore[1],
      b: valuePixelBefore[2],
      a: valuePixelBefore[3],
    };

    const valuePixelAfterObj: Record<string, number> = {
      r: valuePixelAfter[0],
      g: valuePixelAfter[1],
      b: valuePixelAfter[2],
      a: valuePixelAfter[3],
    };

    // Nodata
    if (valuePixelBeforeObj.a === 0 || valuePixelAfterObj.a === 0) {
      return null;
    }

    let encodedValueBefore = 0;
    let encodedValueAfter = 0;

    if (channels.length === 1) {
      encodedValueBefore = valuePixelBeforeObj[channels[0]];
      encodedValueAfter = valuePixelAfterObj[channels[0]];
    } else if (channels.length === 2) {
      encodedValueBefore = valuePixelBeforeObj[channels[0]] * 256 + valuePixelBeforeObj[channels[1]];
      encodedValueAfter = valuePixelAfterObj[channels[0]] * 256 + valuePixelAfterObj[channels[1]];
    } else if (channels.length === 3) {
      encodedValueBefore =
        valuePixelBeforeObj[channels[0]] * 256 * 256 +
        valuePixelBeforeObj[channels[1]] * 256 +
        valuePixelBeforeObj[channels[2]];
      encodedValueAfter =
        valuePixelAfterObj[channels[0]] * 256 * 256 +
        valuePixelAfterObj[channels[1]] * 256 +
        valuePixelAfterObj[channels[2]];
    } else {
      return null;
    }

    const { polynomialOffset, polynomialSlope } = this.datasetSpecification.rasterEncoding;
    const realWorldValueBefore = encodedValueBefore * polynomialSlope + polynomialOffset;
    const realWorldValueAfter = encodedValueAfter * polynomialSlope + polynomialOffset;
    const ratioAfter =
      this.seriesElementAfter.seriesAxisValue === this.seriesElementBefore.seriesAxisValue
        ? realWorldValueBefore
        : (this.seriesAxisValue - this.seriesElementBefore.seriesAxisValue) /
          (this.seriesElementAfter.seriesAxisValue - this.seriesElementBefore.seriesAxisValue);
    const realWorldValue = ratioAfter * realWorldValueAfter + (1 - ratioAfter) * realWorldValueBefore;

    return {
      value: realWorldValue,
      unit: this.datasetSpecification.pixelUnit,
    };
  }

  private dualTextureFetcher(tileIndex: TileIndex, seriesElement: SeriesElement): Promise<Texture> {
    // Use the custom loader (provided as option)
    const customTileTextureLoader = this.customTileTextureLoader;
    if (customTileTextureLoader) {
      const seriesTileId = `${seriesElement.seriesAxisValue.toString()}_${tileIndex.z}_${tileIndex.x}_${tileIndex.y}`;
      const textureMaker = (tileIndex: TileIndex, _tileId: string) => {
        return customTileTextureLoader(tileIndex, seriesElement.seriesAxisValue);
      };
      return this.remoteTileTextureManager.getTexture(tileIndex, textureMaker, seriesTileId);
    }

    // use the regular tile URL loader
    return this.remoteTileTextureManager.getTextureFromUrlPattern(
      tileIndex,
      `${this.tileUrlPrefix}${seriesElement.tileUrlPattern}`,
    );
  }
}
