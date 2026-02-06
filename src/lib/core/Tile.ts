import { type Material, Matrix4, Mesh, PlaneGeometry, Quaternion, Vector3 } from "three";
import type { TileIndex } from "./tools";

let masterTileGeometry: PlaneGeometry | null = null;
function getTileGeometry() {
  masterTileGeometry ??= new PlaneGeometry(1, 1, 32, 32);
  return masterTileGeometry.clone();
}

export class Tile extends Mesh {
  private readonly tileIndex: TileIndex = { z: 0, x: 0, y: 0 };

  constructor(material: Material | Material[] | undefined) {
    super(getTileGeometry(), material);
    this.matrixAutoUpdate = true;
    this.matrixWorldAutoUpdate = true;
  }

  /**
   * Defines the tile index and position the tile in the mercator space
   */
  setTileIndex(ti: TileIndex) {
    this.tileIndex.x = ti.x;
    this.tileIndex.y = ti.y;
    this.tileIndex.z = ti.z;
  }

  /**
   * Get the tile index (a copy)
   */
  getTileIndex(): TileIndex {
    return {
      x: this.tileIndex.x,
      y: this.tileIndex.y,
      z: this.tileIndex.z,
    };
  }

  /**
   * Get the tile index as an array
   */
  getTileIndexAsArray(): [number, number, number] {
    return [this.tileIndex.x, this.tileIndex.y, this.tileIndex.z];
  }
}

export function replaceMatrixScale(matrix: Matrix4, newScale: number) {
  // Create holders for position, quaternion, and scale
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();

  // Decompose the original matrix
  matrix.decompose(position, quaternion, scale);

  // Create a new matrix
  const newMatrix = new Matrix4();

  // If newScale is a number, convert it to Vector3
  const scaleVector = typeof newScale === "number" ? new Vector3(newScale, newScale, newScale) : newScale;

  // Compose with the new scale
  newMatrix.compose(position, quaternion, scaleVector);

  return newMatrix;
}
