/**
 * TODO: layer type description
 */

import type { RawShaderMaterial, ShaderMaterialParameters } from "three";
import { BaseShaderTiledLayer } from "../core/BaseShaderTiledLayer";
import type { TileIndex } from "../core/tools";
// @ts-ignore
import fragmentShader from "../shaders/wgs84-texture-untiled.f.glsl?raw";
import { RemoteUntiledTextureManager } from "../core/RemoteUntiledTextureManager";

export type GeoBoundingBox = {
  /**
   * Longitude of the west-most edge of the image.
   */
  lonMin: number;

  /**
   * Longitude of the east-most edge of the image
   */
  lonMax: number;

  /**
   * Latitude of the south-most edge of the image
   */
  latMin: number;

  /**
   * Latitude of the north-most edge of the image
   */
  latMax: number;
};

export type RemoteWgs84TextureTiledLayerOptions = {
  minZoom?: number;
  maxZoom?: number;

  /**
   * URL to the texture to be used for this layer. The texture must be in WGS84 projection.
   * It can be cover only a partial part of the globe, as long as the bbox is specified
   * in the option `geoBoundingBox`
   */
  textureUrl: string;

  /**
   * Bounding box covered by the image, in WGS84 coordinates
   */
  geoBoundingBox: GeoBoundingBox;

  /**
   * Performs a bicubic interpolation of the texture, which leads to a more accurate
   * and visualy smooth rendering (at some minor performance cost)
   * Default: false
   */
  bicubic?: boolean;

  /**
   * A texture manager can be provided. This can be interesting when multiple
   * layers are using the same textures.
   * If not provided, a default one will be added internaly to this layer.
   */
  remoteUntiledTextureManager?: RemoteUntiledTextureManager;
};

export class RemoteWgs84TextureTiledLayer extends BaseShaderTiledLayer {
  private readonly textureUrl: string;
  private readonly remoteUntiledTextureManager: RemoteUntiledTextureManager;
  private readonly geoBoundingBox: GeoBoundingBox;
  private readonly wrapLongitude: boolean;
  private readonly bicubic: boolean;

  constructor(id: string, options: RemoteWgs84TextureTiledLayerOptions) {
    super(id, {
      minZoom: options.minZoom ?? 0,
      maxZoom: options.maxZoom ?? 22,
    });

    this.remoteUntiledTextureManager = options.remoteUntiledTextureManager ?? new RemoteUntiledTextureManager();
    this.textureUrl = options.textureUrl;
    this.geoBoundingBox = options.geoBoundingBox;
    const longitudeSpan = Math.abs(this.geoBoundingBox.lonMax - this.geoBoundingBox.lonMin);
    this.wrapLongitude = Math.abs(longitudeSpan - 360) < 1e-6;
    this.bicubic = options.bicubic ?? false;
  }

  onSetTileShaderParameters(_tileIndex: TileIndex): ShaderMaterialParameters {
    return {
      uniforms: {
        u_tex: { value: null },
        u_lonMin: { value: this.geoBoundingBox.lonMin },
        u_lonMax: { value: this.geoBoundingBox.lonMax },
        u_latMin: { value: this.geoBoundingBox.latMin },
        u_latMax: { value: this.geoBoundingBox.latMax },
        u_bicubic: { value: this.bicubic },
      },
      fragmentShader: fragmentShader,
    };
  }

  // TODO: this function is called for each tile, but the texture is the same for all tiles. It should be optimized to only load the texture once.
  async onTileUpdate(_tileIndex: TileIndex, material: RawShaderMaterial) {
    material.uniforms.u_tex.value = await this.remoteUntiledTextureManager.getTextureFromUrl(
      this.textureUrl, // Using the URL as ID
      this.textureUrl,
      {
        wrapS: this.wrapLongitude,
      },
    );
  }
}
