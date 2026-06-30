import { RepeatWrapping, type Texture, TextureLoader } from "three";
import type { UntiledTextureManagerOptions } from "./UntiledTextureManager";
import { UntiledTextureManager } from "./UntiledTextureManager";

export type RemoteUntiledTextureManagerOptions = UntiledTextureManagerOptions;

/**
 * Options to flip or wrap texture when loading it from a URL
 */
export type TextureOptions = {
  flipY?: boolean;
  wrapS?: boolean;
};

export class RemoteUntiledTextureManager extends UntiledTextureManager {
  protected readonly textureLoader = new TextureLoader();
  protected readonly textureInProgress = new Map<string, Texture>();

  constructor(options: RemoteUntiledTextureManagerOptions = {}) {
    super(options);
  }

  /**
   * Get an untiled texture from its URL
   * If a texture is already in the cache, it will be retrieved from the cache.
   * If a texture already failed to be retrieved, it is not trying again.
   */
  getTextureFromUrl(textureId: string, textureUrl: string, options: TextureOptions = {}): Promise<Texture> {
    const texturemaker = (textureId: string): Promise<Texture> => {
      return new Promise<Texture>((resolve, reject) => {
        // The texture is not existing. An unfruitful attempt was made already
        if (this.unavailableTextures.has(textureId)) {
          return reject(new Error("Could not load texture."));
        }

        // A request of this texture has already been made but is not finished yet
        if (this.textureInProgress.has(textureId)) {
          resolve(this.textureInProgress.get(textureId) as Texture);
          return;
        }

        const texInProgress = this.textureLoader.load(
          textureUrl,

          (texture) => {
            texture.flipY = options.flipY ?? false;
            if (options.wrapS) {
              texture.wrapS = RepeatWrapping;
            }
            this.texturePool.set(textureId, texture);
            this.textureInProgress.delete(textureId);
            resolve(texture);
          },

          // onProgress callback currently not supported
          undefined,

          // onError callback
          (_err) => {
            this.unavailableTextures.add(textureId);
            this.textureInProgress.delete(textureId);
            reject(new Error("Could not load texture."));
          },
        );
        this.textureInProgress.set(textureId, texInProgress);
      });
    };

    return super.getTexture(textureId, texturemaker);
  }
}
