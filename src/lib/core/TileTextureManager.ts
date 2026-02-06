import QuickLRU from "quick-lru";
import type { Texture } from "three";
import { type TileIndex, tileIndexToString, wrapTileIndex } from "../core/tools";

export type TileTextureManagerOptions = {
  cacheSize?: number;
};

/**
 * Type of asny function that input atile index and output a ThreeJS texture
 */
export type TextureMaker = (tileIndex: TileIndex, tileId: string) => Promise<Texture | null>;

export class TileTextureManager {
  protected readonly texturePool: QuickLRU<string, Texture>;
  protected readonly unavailableTextures = new Set();

  constructor(options: TileTextureManagerOptions = {}) {
    const cacheSize = options.cacheSize ?? 1000;

    this.texturePool = new QuickLRU<string, Texture>({
      // should be replaced by gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
      maxSize: cacheSize,

      onEviction(_key: string, value: Texture) {
        console.log("Freeing texture from GPU memory");
        if (value.source.data instanceof ImageBitmap) {
          value.source.data.close();
        }
        value.dispose();
      },
    });
  }

  /**
   * Get a texture from its z/x/y index and a TextureMaker function
   * If a tile is already in the cache, it will be retrieved from the cache.
   * If a texture already failed to be retrieved, it is not trying again.
   *
   * If necessary, a tileId can be passed to uniquely identify the given tile.
   * If not provided, an id will ne formed using the {zxy}, but that's not always the
   * best as multiple tiles will have the same {zxy} but eg. at different timestamp.
   */
  getTexture(tileIndex: TileIndex, textureMaker: TextureMaker, providedTileId?: string): Promise<Texture> {
    return new Promise((resolve, reject) => {
      const tileIndexWrapped = wrapTileIndex(tileIndex);
      const tileId = providedTileId ?? tileIndexToString(tileIndexWrapped);

      // The texture is not existing. An unfruitful attempt was made already
      if (this.unavailableTextures.has(tileId)) {
        return reject(new Error("Could not load texture."));
      }

      // The texture is in the pool of already fetched textures
      if (this.texturePool.has(tileId)) {
        resolve(this.texturePool.get(tileId) as Texture);
        return;
      }

      textureMaker(tileIndex, tileId)
        .then((texture: Texture | null) => {
          if (!texture) {
            reject(new Error("Could not load texture."));
            return;
          }

          texture.flipY = false;
          this.texturePool.set(tileId, texture);
          resolve(texture);
        })
        .catch(() => {
          this.unavailableTextures.add(tileId);
          reject(new Error("Could not load texture."));
        });
    });
  }

  /**
   * Clear the texture cache
   */
  clear() {
    this.texturePool.clear();
    this.unavailableTextures.clear();
  }
}
