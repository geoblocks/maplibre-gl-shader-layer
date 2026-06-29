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
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
};

export type RemoteWgs84TextureTiledLayerOptions = {
  minZoom?: number;
  maxZoom?: number;
  textureUrl: string;
  geoBoundingBox: GeoBoundingBox;

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

  constructor(id: string, options: RemoteWgs84TextureTiledLayerOptions) {
    super(id, {
      minZoom: options.minZoom ?? 0,
      maxZoom: options.maxZoom ?? 22,
    });

    this.remoteUntiledTextureManager = options.remoteUntiledTextureManager ?? new RemoteUntiledTextureManager();
    this.textureUrl = options.textureUrl;
    this.geoBoundingBox = options.geoBoundingBox;
  }

  onSetTileShaderParameters(_tileIndex: TileIndex): ShaderMaterialParameters {
    return {
      uniforms: {
        u_tex: { value: null },
        u_lonMin: { value: this.geoBoundingBox.lonMin },
        u_lonMax: { value: this.geoBoundingBox.lonMax },
        u_latMin: { value: this.geoBoundingBox.latMin },
        u_latMax: { value: this.geoBoundingBox.latMax },
      },
      fragmentShader: fragmentShader,
    };
  }

  // TODO: this function is called for each tile, but the texture is the same for all tiles. It should be optimized to only load the texture once.
  async onTileUpdate(_tileIndex: TileIndex, material: RawShaderMaterial) {
    material.uniforms.u_tex.value = await this.remoteUntiledTextureManager.getTextureFromUrl(
      this.textureUrl, // Using the URL as ID
      this.textureUrl,
    );
  }
}
