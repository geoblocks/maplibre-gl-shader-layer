/**
 * A raster where each pixel is represented by a single float value.
 */
export type FloatRaster = {
  data: Float32Array;
  width: number;
  height: number;
};

/**
 * A RGBA raster where each pixel is the result of:
 * (R * 256^2 + G * 256 + B) * polynomialSlope + polynomialOffset
 * and where the alpha channel is used to indicate nodata values (alpha < 255)
 */
export type MultiChannelRaster = {
  data: Uint8Array;
  width: number;
  height: number;

  /**
   * Encoding step
   */
  polynomialSlope: number;

  /**
   * Lowest value
   */
  polynomialOffset: number;
  nodataValue?: number;
};

export type FloatRasterToMultiChannelRasterOptions = {
  polynomialSlope?: number;
  polynomialOffset?: number;
  nodataValue?: number;
  nbChannels?: number;
};

function getNodataCompareFunction(nodataValue?: number): null | ((value: unknown) => boolean) {
  if (nodataValue === undefined) {
    return null;
  }

  if (Number.isNaN(nodataValue)) {
    return (value: unknown) => Number.isNaN(value);
  }

  return (value: unknown) => value === nodataValue;
}

/**
 * Compute the minimal and maximal value from a FloatRaster
 */
export function computeMinMax(raster: FloatRaster, nodataValue?: number): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  const nodataCompareFn = getNodataCompareFunction(nodataValue);

  for (let i = 0; i < raster.data.length; i += 1) {
    const val = raster.data[i];

    // Skip the nodata values if provided
    if (nodataCompareFn && nodataCompareFn(val)) {
      continue;
    }

    if (val < min) {
      min = val;
    } else if (val > max) {
      max = val;
    }
  }

  return { min, max };
}

/**
 * Compute the offset and slope to convert a float raster to a multi-channel raster.
 * This is usefull to make a reasonable guess when those values are not provided by the user.
 * (Note: most of time, they should be provided by the user, as they are specific to a dataset
 * composed of multiple rasters, and that a unique offset and slope must be provided for an entire dataset)
 */
export function computePolynomialSlopeAndOffset(
  min: number,
  max: number,
  nbChannels: number,
): { polynomialSlope: number; polynomialOffset: number } {
  const numberOfPossibleValues = 256 ** nbChannels;
  const floatValueRange = max - min;
  const polynomialSlope = Math.ceil((floatValueRange / numberOfPossibleValues) * 10000) / 10000;
  return { polynomialSlope, polynomialOffset: min };
}

/**
 * Decompose a float value into 3 bytes so that it can be stored on RGB channels of a WebGL texture
 */
function decomposeFloatToUint24(
  floatValue: number,
  polynomialSlope: number,
  polynomialOffset: number,
): [number, number, number] {
  const x = (floatValue - polynomialOffset) / polynomialSlope;
  return [x >> 16, (x >> 8) & 0xff, x & 0xff];
}

/**
 * Converts a float raster into a multi-channel RGB-encoded image, where the alpha channel is used as a nodata flag
 */
export function floatRasterToMultiChannelRaster(
  floatRaster: FloatRaster,
  options: FloatRasterToMultiChannelRasterOptions,
): MultiChannelRaster {
  let { polynomialSlope, polynomialOffset, nodataValue } = options;
  const nbChannels = options.nbChannels ?? 3;

  // If the polynomialSlope and polynomialOffset are not provided, we compute them from the raster values
  if (polynomialSlope === undefined || polynomialOffset === undefined) {
    const { min, max } = computeMinMax(floatRaster, nodataValue);
    const computedValues = computePolynomialSlopeAndOffset(min, max, nbChannels);
    polynomialSlope = computedValues.polynomialSlope;
    polynomialOffset = computedValues.polynomialOffset;
  }

  const nodataCompareFn = getNodataCompareFunction(nodataValue);
  const uint8Array = new Uint8Array(floatRaster.width * floatRaster.height * 4);

  for (let i = 0; i < floatRaster.data.length; i += 1) {
    const floatValue = floatRaster.data[i];
    const redIndex = i * 4;

    if (nodataCompareFn && nodataCompareFn(floatValue)) {
      uint8Array[redIndex + 3] = 0;
      continue;
    }

    const RGB = decomposeFloatToUint24(floatValue, polynomialSlope, polynomialOffset);
    uint8Array[redIndex] = RGB[0];
    uint8Array[redIndex + 1] = RGB[1];
    uint8Array[redIndex + 2] = RGB[2];
    uint8Array[redIndex + 3] = 255;
  }


  return {
    data: uint8Array,
    width: floatRaster.width,
    height: floatRaster.height,
    polynomialSlope,
    polynomialOffset,
    nodataValue,
  };
}
