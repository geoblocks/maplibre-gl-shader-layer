/**
 * This is a demo of how to extend ShaderTiledLayer
 * TextureTiledLayer is a layer that simply contains a texture per tile
 */

import type { RawShaderMaterial, ShaderMaterialParameters } from "three";
import { BaseShaderTiledLayer } from "../core/BaseShaderTiledLayer";
import type { TileIndex } from "../core/tools";
// @ts-ignore
import fragmentShader from "../shaders/texture-tile.f.glsl?raw";
import { RemoteTileTextureManager } from "../core/RemoteTileTextureManager";

export type RemoteTextureTiledLayerOptions = {
  minZoom?: number;
  maxZoom?: number;
  textureUrlPattern: string;
  /**
   * A texture manager can be provided. This can be interesting when multiple
   * layers are using the same textures.
   * If not provided, a default one will be added internaly to this layer.
   */
  remoteTileTextureManager?: RemoteTileTextureManager;
};

export class RemoteTextureTiledLayer extends BaseShaderTiledLayer {
  private readonly textureUrlPattern: string;
  private readonly remoteTileTextureManager: RemoteTileTextureManager;

  constructor(id: string, options: RemoteTextureTiledLayerOptions) {
    super(id, {
      minZoom: options.minZoom ?? 0,
      maxZoom: options.maxZoom ?? 22,
    });

    this.remoteTileTextureManager = options.remoteTileTextureManager ?? new RemoteTileTextureManager();
    this.textureUrlPattern = options.textureUrlPattern;
  }

  // Must be implemented
  onSetTileShaderParameters(_tileIndex: TileIndex): ShaderMaterialParameters {
    return {
      uniforms: {
        u_tex: { value: null },
      },
      fragmentShader: fragmentShader,
    };
  }

  // Must be implemented
  async onTileUpdate(tileIndex: TileIndex, material: RawShaderMaterial) {
    material.uniforms.u_tex.value = await this.remoteTileTextureManager.getTextureFromUrlPattern(
      tileIndex,
      this.textureUrlPattern,
    );
  }
}
