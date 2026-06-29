import QuickLRU from "quick-lru";
import type { Texture } from "three";

export type UntiledTextureManagerOptions = {
  cacheSize?: number;
};

/**
 * Type of async function that input a texture id and output a ThreeJS texture
 */
export type UntiledTextureMaker = (textureId: string) => Promise<Texture | null>;

export class UntiledTextureManager {
  protected readonly texturePool: QuickLRU<string, Texture>;
  protected readonly unavailableTextures = new Set();

  constructor(options: UntiledTextureManagerOptions = {}) {
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
   * If a texture is already in the cache, it will be retrieved from the cache.
   * If a texture already failed to be retrieved, it is not trying again.
   *
   * If necessary, a textureId can be passed to uniquely identify the given texture.
   * If not provided, an id will ne formed using the {zxy}, but that's not always the
   * best as multiple textures will have the same {zxy} but eg. at different timestamp.
   */
  getTexture(textureId: string, textureMaker: UntiledTextureMaker): Promise<Texture> {
    return new Promise((resolve, reject) => {
      // The texture is not existing. An unfruitful attempt was made already
      if (this.unavailableTextures.has(textureId)) {
        return reject(new Error("Could not load texture."));
      }

      // The texture is in the pool of already fetched textures
      if (this.texturePool.has(textureId)) {
        resolve(this.texturePool.get(textureId) as Texture);
        return;
      }

      textureMaker(textureId)
        .then((texture: Texture | null) => {
          if (!texture) {
            reject(new Error("Could not load texture."));
            return;
          }

          texture.flipY = false;
          this.texturePool.set(textureId, texture);
          resolve(texture);
        })
        .catch(() => {
          this.unavailableTextures.add(textureId);
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
