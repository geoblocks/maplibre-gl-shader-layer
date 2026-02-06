import maplibregl from "maplibre-gl";
import {
  Camera,
  Matrix4,
  type MeshBasicMaterial,
  RawShaderMaterial,
  Scene,
  WebGLRenderer,
  type ShaderMaterialParameters,
  GLSL3,
  Vector3,
  BackSide,
} from "three";
import {
  type TileIndex,
  getTileBoundsUnwrapped,
  tileBoundsUnwrappedToTileList,
  isTileInViewport,
  wrapTileIndex,
  tileIndexToMercatorCenterAndSize,
  wgs84ToTileIndex,
  matricesEqual,
  tileIndexToString,
} from "./tools";
import { Tile } from "./Tile";

// @ts-ignore
import defaultVertexShader from "../shaders/tile.v.glsl?raw";
import QuickLRU from "quick-lru";

/**
 * Tile stategy to change (integer) zoom level depending on ramping map zoom level.
 * - FLOOR: tileZ = floor(mapZ) => fairly low resolution tile, a tile can take up to most of the viewport
 * - ROUND: tileZ = round(mapZ) => medium resoltuion, tiles are smaller on screen
 * - CEIL: tileZ = ceil(mapZ) => the highest resolution, +1 Z compared to FLOOR
 */
export type TileZoomFitting = "FLOOR" | "ROUND" | "CEIL";

export type Mat4 =
  | [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ]
  | Float32Array;

export type BaseShaderTiledLayerOptions = {
  /**
   * Default: 0
   */
  minZoom?: number;

  /**
   * Default: 22
   */
  maxZoom?: number;

  /**
   * Default: false
   * Setting to `true` will create plenty of tiles smaller than optimal size and may
   * lead to performance issue.
   */
  showBelowMinZoom?: boolean;

  /**
   * Default: true
   * Beyond the maxZoom, tiles will show enlarged and possibly not great-looking
   * if too zoomed-in.
   */
  showBeyondMaxZoom?: boolean;

  tileZoomFitting?: TileZoomFitting;

  /**
   * Opacity of the layer
   */
  opacity?: number;
};

export abstract class BaseShaderTiledLayer implements maplibregl.CustomLayerInterface {
  public id: string;
  public readonly type = "custom";
  public renderingMode: "2d" | "3d" = "3d";
  protected map!: maplibregl.Map;
  protected renderer!: WebGLRenderer;
  protected camera!: Camera;
  protected scene!: Scene;
  protected debugMaterial!: MeshBasicMaterial;
  protected minZoom: number;
  protected maxZoom: number;
  protected showBelowMinZoom: boolean;
  protected showBeyondMaxZoom: boolean;
  protected shouldShowCurrent!: boolean;
  protected currentlyUsedTiles = new Map<string, Tile>();
  protected readonly tilePool: QuickLRU<string, Tile>;
  protected unusedTileList: Array<Tile> = [];
  private readonly tileZoomFittingFunction: (v: number) => number = Math.floor;
  protected opacity = 1;
  protected altitude = 0;
  protected isVisible = true;
  protected readonly defaultVertexShader = defaultVertexShader;
  protected renderCallCounter = 0;
  private lastRenderProjectionMatrix: number[] = [];
  private lastRenderTileIndicesForMapBounds: TileIndex[] = [];

  constructor(id: string, options: BaseShaderTiledLayerOptions = {}) {
    this.id = id;
    this.initScene();
    this.minZoom = options.minZoom ?? 0;
    this.maxZoom = options.maxZoom ?? 22;
    this.showBelowMinZoom = options.showBelowMinZoom ?? false;
    this.showBeyondMaxZoom = options.showBeyondMaxZoom ?? true;
    this.opacity = Math.max(0, Math.min(options.opacity ?? 1, 1));

    if (options?.tileZoomFitting) {
      if (options.tileZoomFitting === "CEIL") {
        this.tileZoomFittingFunction = Math.ceil;
      } else if (options.tileZoomFitting === "ROUND") {
        this.tileZoomFittingFunction = Math.round;
      }
    }

    this.tilePool = new QuickLRU<string, Tile>({
      maxSize: 300,
      onEviction(_key: string, tile: Tile) {
        tile.geometry.dispose();
        const material = tile.material;
        if (Array.isArray(material)) {
          material.forEach((el) => el.dispose());
        } else {
          material.dispose();
        }
      },
    });
  }

  /**
   * Method to assign ThreeJS ShaderMaterialParameters to the internaly created RawShaderMaterial
   */
  protected abstract onSetTileShaderParameters(tileIndex: TileIndex): ShaderMaterialParameters;

  /**
   * Method to update the material of a tile Mesh before a tile is rendered
   */
  protected abstract onTileUpdate(tileIndex: TileIndex, material: RawShaderMaterial): Promise<void>;

  setVisible(v: boolean) {
    this.isVisible = v;
    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  protected initScene() {
    this.camera = new Camera();
    this.scene = new Scene();
  }

  /**
   * Compute the correct zoom level based on the map zoom level and the provided options.
   * The returned value is an integer.
   */
  protected getAppropriateZoomLevel(): number {
    const current = this.tileZoomFittingFunction(this.map.getZoom());
    if (current < this.minZoom) return this.minZoom;
    if (current > this.maxZoom) return this.maxZoom;
    return current;
  }

  protected shouldShow(): boolean {
    const current = Math.max(0, Math.floor(this.map.getZoom()));
    if (current < this.minZoom && !this.showBelowMinZoom) return false;
    if (current > this.maxZoom && !this.showBeyondMaxZoom) return false;
    return true;
  }

  onAdd?(map: maplibregl.Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.renderer = new WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
      precision: "highp",
    });

    this.renderer.autoClear = false;
  }

  protected listTilesIndicesForMapBounds() {
    const mapProjection = this.map.getProjection();
    const zoom = this.map.getZoom();
    const isGlobe = mapProjection && mapProjection.type === "globe" && zoom < 12;

    const z = this.getAppropriateZoomLevel();
    const tbu = getTileBoundsUnwrapped(this.map, z);
    // The candidates are strictly based on axis-align bounding box, so when map is pitched and rotated,
    // the list of candidates needs to be pruned from all the tiles that are not in viewport
    let tileIndicesCandidates = tileBoundsUnwrappedToTileList(tbu);

    if (isGlobe) {
      const tileMap = new Map<string, TileIndex>();
      for (const tile of tileIndicesCandidates) {
        const wrappedTile = wrapTileIndex(tile);
        tileMap.set(tileIndexToString(wrappedTile), wrappedTile);
      }

      tileIndicesCandidates = Array.from(tileMap.values());
    }

    // Sorting tiles from the distance to center so have a more user-centric tile
    // display order
    const c = wgs84ToTileIndex(this.map.getCenter(), z, false);
    tileIndicesCandidates.sort((a, b) => {
      const cToA = Math.sqrt((a.x + 0.5 - c.x) ** 2 + (a.y + 0.5 - c.y) ** 2);
      const bToA = Math.sqrt((b.x + 0.5 - c.x) ** 2 + (b.y + 0.5 - c.y) ** 2);
      return cToA - bToA;
    });

    if (this.map.getZoom() >= z) {
      return tileIndicesCandidates;
    }

    const canvas = this.map.getCanvas();
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const tileIndicesFiltered = tileIndicesCandidates.filter((ti) =>
      isTileInViewport(ti, this.map, canvasWidth, canvasHeight),
    );

    return tileIndicesFiltered;
  }

  onRemove(_map: maplibregl.Map, _gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    console.warn("not implemented yet");
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: maplibregl.CustomRenderMethodInput) {
    if (!this.isVisible) {
      return;
    }

    this.shouldShowCurrent = this.shouldShow();

    // Escape if not rendering
    if (!this.shouldShowCurrent) return;

    const projectionMatrix = options.defaultProjectionData.mainMatrix as number[];
    const hasMovedSinceLastRender = !matricesEqual(this.lastRenderProjectionMatrix, projectionMatrix, 1e-3);

    this.lastRenderProjectionMatrix = projectionMatrix;
    this.renderCallCounter++;

    this.scene.clear();
    const tileIndicesForMapBounds = hasMovedSinceLastRender
      ? this.listTilesIndicesForMapBounds()
      : this.lastRenderTileIndicesForMapBounds;
    this.lastRenderTileIndicesForMapBounds = tileIndicesForMapBounds;

    const mapProjection = this.map.getProjection();
    const zoom = this.map.getZoom();
    // At z12+, the globe is no longer globe in Maplibre
    const isGlobe = mapProjection && mapProjection.type === "globe" && zoom < 12;

    // From z12+ the tile positioning is computed as relative to the center of the map
    const relativeTilePosition = zoom >= 12;
    const tileUpdatePromises = [];
    this.camera.matrixWorldAutoUpdate = false;
    const sceneOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(this.map.getCenter(), 0);

    const updatePositioningMethod = (tile: Tile, tileIndex: TileIndex) => {
      if (relativeTilePosition) {
        const { mercSize, mercCenter } = tileIndexToMercatorCenterAndSize(tileIndex);
        const mercUnitsPerMeter = mercCenter.meterInMercatorCoordinateUnits();
        const tileSizeMeters = mercSize / mercUnitsPerMeter;
        const easting = (mercCenter.x - sceneOriginMercator.x) / mercUnitsPerMeter;
        const northing = (mercCenter.y - sceneOriginMercator.y) / mercUnitsPerMeter;
        tile.scale.set(tileSizeMeters, tileSizeMeters, tileSizeMeters);
        tile.position.set(easting, -northing, 0);
        tile.rotation.set(Math.PI, 0, 0);
      } else {
        tile.position.set(0, 0, 0);
        tile.scale.set(1, 1, 1);
        tile.rotation.set(0, 0, 0);
      }
    };

    this.currentlyUsedTiles.clear();

    for (const tileIndex of tileIndicesForMapBounds) {
      const tileID = `${tileIndex.z}_${tileIndex.x}_${tileIndex.y}`;
      let tile = this.tilePool.get(tileID);

      if (!tile) {
        const mapProjection = this.map.getProjection();
        const providedShaderMaterialParameters: ShaderMaterialParameters = this.onSetTileShaderParameters(tileIndex);
        const shaderMaterialParameters: ShaderMaterialParameters = {
          // Param that are allowed to be overwritten
          side: BackSide,
          transparent: true,
          depthTest: false,
          ...providedShaderMaterialParameters,

          // Mandatory params
          vertexShader: this.defaultVertexShader,
          glslVersion: GLSL3,
        };

        shaderMaterialParameters.uniforms = {
          ...shaderMaterialParameters.uniforms,

          // Mandatory uniforms
          u_zoom: { value: this.map.getZoom() },
          u_tileIndex: { value: new Vector3(tileIndex.x, tileIndex.y, tileIndex.z) },
          u_isGlobe: { value: mapProjection && mapProjection.type === "globe" },
          u_opacity: { value: this.opacity },
          u_altitude: { value: this.altitude },
          u_relativeTilePosition: { value: relativeTilePosition },
        };

        const material = new RawShaderMaterial(shaderMaterialParameters);
        tile = new Tile(material);
        tile.setTileIndex(tileIndex);
        this.tilePool.set(tileID, tile);
      }

      updatePositioningMethod(tile, tileIndex);
      this.scene.add(tile);
      this.currentlyUsedTiles.set(tileID, tile);
      tileUpdatePromises.push(this.updateTileMaterial(tile, zoom, isGlobe, relativeTilePosition));
    }

    this.renderScene(relativeTilePosition, sceneOriginMercator, projectionMatrix);

    const localRenderCallCounter = this.renderCallCounter;
    Promise.allSettled(tileUpdatePromises).then(() => {
      // It may happen that some tileUpdatePromises ar only resolved
      // on a render call that happens much later. This is especially
      // true when these contain remote file loading. We track these
      // async event so that a re-render can be done
      if (localRenderCallCounter !== this.renderCallCounter) {
        this.map.triggerRepaint();
      }
    });
  }

  private renderScene(
    relativeTilePosition: boolean,
    sceneOriginMercator: maplibregl.MercatorCoordinate,
    projectionMatrix: number[],
  ) {
    if (relativeTilePosition) {
      const sceneScale = sceneOriginMercator.meterInMercatorCoordinateUnits();
      const m = new Matrix4().fromArray(projectionMatrix);
      const l = new Matrix4()
        .makeTranslation(sceneOriginMercator.x, sceneOriginMercator.y, sceneOriginMercator.z)
        .scale(new Vector3(sceneScale, -sceneScale, sceneScale));

      this.camera.projectionMatrix = m.multiply(l);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
    } else {
      this.camera.projectionMatrix = new Matrix4().fromArray(projectionMatrix);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
    }
  }

  private async updateTileMaterial(tile: Tile, zoom: number, isGlobe: boolean, relativeTilePosition: boolean) {
    const tileRawMaterial = tile.material as RawShaderMaterial;

    // Update built-in uniforms
    const tileIndeArray = tile.getTileIndexAsArray();
    tileRawMaterial.uniforms.u_zoom.value = zoom;
    tileRawMaterial.uniforms.u_isGlobe.value = isGlobe;
    tileRawMaterial.uniforms.u_opacity.value = this.opacity;
    (tileRawMaterial.uniforms.u_tileIndex.value as Vector3).set(tileIndeArray[0], tileIndeArray[1], tileIndeArray[2]);
    tileRawMaterial.uniforms.u_altitude.value = this.altitude;
    tileRawMaterial.uniforms.u_relativeTilePosition.value = relativeTilePosition;

    await this.onTileUpdate(tile.getTileIndex(), tileRawMaterial);
  }

  setOpacity(opacity: number) {
    this.opacity = Math.max(0, Math.min(opacity, 1));
    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  /**
   * Set the altitude of the layer in meters.
   * (Only for globe mode)
   */
  setAltitude(altitude: number) {
    this.altitude = Math.max(altitude, 0);
    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  /**
   * Get the tile currently in use, as an array
   */
  getCurrentlyUsedTiles() {
    return Array.from(this.currentlyUsedTiles.values());
  }

  /**
   * Get the indices of the tile in use, as an array
   */
  getCurrentlyUsedTileIndices() {
    return this.getCurrentlyUsedTiles().map((t) => t.getTileIndex());
  }

  /**
   * Get the zoom level of the tiles in use
   */
  getCurrentlyUsedTileZoom() {
    return this.getCurrentlyUsedTileIndices()[0].z;
  }
}
