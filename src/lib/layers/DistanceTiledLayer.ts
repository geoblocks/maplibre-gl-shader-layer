import { type Texture, Vector2, type RawShaderMaterial, type ShaderMaterialParameters } from "three";
import { BaseShaderTiledLayer, type BaseShaderTiledLayerOptions } from "../core/BaseShaderTiledLayer";

// @ts-ignore
import fragmentShader from "../shaders/distance.f.glsl?raw";
import type { TileIndex } from "../core/tools";
import { Colormap } from "../core/Colormap";

export type DistanceTiledLayerOptions = Omit<BaseShaderTiledLayerOptions, "tileZoomFitting"> & {
  colormap?: Colormap;
  referencePosition?: { lng: number; lat: number };
};

export class DistanceTiledLayer extends BaseShaderTiledLayer {
  private colormap: Colormap;
  private readonly referencePosition: Vector2;
  private colormapTexture: Texture;

  constructor(id: string, options: DistanceTiledLayerOptions = {}) {
    super(id, options);

    this.colormap =
      options.colormap ??
      Colormap.fromColormapDescription([
        0,
        "rgba(9, 14, 31, 0.0)",
        100,
        "rgba(9, 14, 31, 0.0)",
        101,
        "rgba(9, 14, 31, 0.6)",
        200,
        "rgba(9, 14, 31, 0.6)",
      ]);

    this.referencePosition = new Vector2(0, 0);
    if (options.referencePosition !== undefined) {
      this.referencePosition.set(options.referencePosition.lng, options.referencePosition.lat);
    }

    this.colormapTexture = this.colormap.getTexture({ size: 4096 });
  }

  // Must be implemented.
  // The fragment shader for DummyGradientTiledLayer only depends on uniforms
  // initialized on the parent class BaseShaderTiledLayer such as zoom, tileIndex, etc.
  // For this reason, there is no need to pass a uniform object as part of the returned value
  onSetTileShaderParameters(_tileIndex: TileIndex): ShaderMaterialParameters {
    return {
      uniforms: {
        u_colormapTex: { value: this.colormapTexture },
        u_referencePosition: { value: new Vector2(0, 0) },
        u_colormapRangeMin: { value: this.colormap.getRange().min },
        u_colormapRangeMax: { value: this.colormap.getRange().max },
      },
      fragmentShader: fragmentShader,
    };
  }

  // Must be implemented
  async onTileUpdate(_tileIndex: TileIndex, material: RawShaderMaterial) {
    material.uniforms.u_referencePosition.value = this.referencePosition;

    // Generating a colormap texture is costly, we need to make
    // sure it happens only when necessary
    if (material.uniforms.u_colormapTex.value !== this.colormapTexture) {
      material.uniforms.u_colormapTex.value = this.colormapTexture;
      material.uniforms.u_colormapRangeMin.value = this.colormap.getRange().min;
      material.uniforms.u_colormapRangeMax.value = this.colormap.getRange().max;
    }
  }

  setRefeferenceLocation(position: { lng: number; lat: number }) {
    this.referencePosition.set(position.lng, position.lat);

    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  setColormap(colormap: Colormap) {
    this.colormap = colormap;
    // The method colormap.getTexture() generates a ThreeJS texture on the fly,
    // using a canvas as a source. Neither the canvas nor the texture are cached
    // as colormap attribute, meaning calling .getTexture() will again re-generate
    // a texture from scratch. For this reason, it is better to store the texture seprarately
    // rather than regenerating it for evey tile as part of the onTileUpdate() hook.
    this.colormapTexture = this.colormap.getTexture({ size: 4096 });

    if (this.map) {
      this.map.triggerRepaint();
    }
  }
}
