import { type Texture, TextureLoader } from "three";
import { type TileIndex, wrapTileIndex } from "../core/tools";
import { TileTextureManager, type TileTextureManagerOptions } from "./TileTextureManager";

export type RemoteTextureManagerOptions = TileTextureManagerOptions;

export class RemoteTileTextureManager extends TileTextureManager {
  protected readonly textureLoader = new TextureLoader();
  protected readonly textureInProgress = new Map<string, Texture>();

  constructor(options: RemoteTextureManagerOptions = {}) {
    super(options);
  }

  /**
   * Get a texture from its z/x/y index
   * If a tile is already in the cache, it will be retrieved from the cache.
   * If a texture already failed to be retrieved, it is not trying again.
   */
  getTextureFromUrlPattern(tileIndex: TileIndex, textureUrlPattern: string): Promise<Texture> {
    const tileIndexWrapped = wrapTileIndex(tileIndex);

    // In this case, the textureURL plays the role of unique tile ID
    // (passed to super.getTexture() below)
    const textureURL = textureUrlPattern
      .replace("{x}", tileIndexWrapped.x.toString())
      .replace("{y}", tileIndexWrapped.y.toString())
      .replace("{z}", tileIndexWrapped.z.toString());

    const texturemaker = (_tileIndex: TileIndex, tileId: string): Promise<Texture> => {
      return new Promise<Texture>((resolve, reject) => {
        // The texture is not existing. An unfruitful attempt was made already
        if (this.unavailableTextures.has(tileId)) {
          return reject(new Error("Could not load texture."));
        }

        // A request of this texture has already been made but is not finished yet
        if (this.textureInProgress.has(tileId)) {
          resolve(this.textureInProgress.get(tileId) as Texture);
          return;
        }

        const texInProgress = this.textureLoader.load(
          textureURL,

          (texture) => {
            texture.flipY = false;
            this.texturePool.set(tileId, texture);
            this.textureInProgress.delete(tileId);
            resolve(texture);
          },

          // onProgress callback currently not supported
          undefined,

          // onError callback
          (_err) => {
            this.unavailableTextures.add(tileId);
            this.textureInProgress.delete(tileId);
            reject(new Error("Could not load texture."));
          },
        );
        this.textureInProgress.set(tileId, texInProgress);
      });
    };

    return super.getTexture(tileIndex, texturemaker, textureURL);
  }
}
