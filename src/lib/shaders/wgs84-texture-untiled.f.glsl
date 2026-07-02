precision highp float;
precision highp int;

uniform sampler2D u_tex;
uniform bool u_bicubic;
uniform float u_opacity;
uniform float u_lonMin;
uniform float u_lonMax;
uniform float u_latMin;
uniform float u_latMax;
in vec2 v_uv;
in vec2 v_lonLat;
out vec4 fragColor;

/**
  * Returns true if the given lonLat is inside the bounding box defined by lonMin, lonMax, latMin, latMax.
  */
bool isInsideBoundingBox(vec2 lonLat, float lonMin, float lonMax, float latMin, float latMax) {
  return (lonLat.x >= lonMin && lonLat.x <= lonMax && lonLat.y >= latMin && lonLat.y <= latMax);
}

// This cubic interpolation was borrowed from https://stackoverflow.com/a/42179924/5885003
vec4 cubic(float v){
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) * (1.0/6.0);
}

// This cubic interpolation was borrowed from https://stackoverflow.com/a/42179924/5885003
vec4 textureBicubic(sampler2D tex, vec2 texCoords){
  vec2 texSize = vec2(textureSize(tex, 0));
  vec2 invTexSize = 1.0 / texSize;

  texCoords = texCoords * texSize - 0.5;
  vec2 fxy = fract(texCoords);
  texCoords -= fxy;
  vec4 xcubic = cubic(fxy.x);
  vec4 ycubic = cubic(fxy.y);
  vec4 c = texCoords.xxyy + vec2 (-0.5, +1.5).xyxy;
  vec4 s = vec4(xcubic.xz + xcubic.yw, ycubic.xz + ycubic.yw);
  vec4 offset = c + vec4 (xcubic.yw, ycubic.yw) / s;
  offset *= invTexSize.xxyy;
  vec4 sample0 = texture(tex, offset.xz);
  vec4 sample1 = texture(tex, offset.yz);
  vec4 sample2 = texture(tex, offset.xw);
  vec4 sample3 = texture(tex, offset.yw);
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);

  return mix(
    mix(sample3, sample2, sx), mix(sample1, sample0, sx)
  ,sy);
}

void main()  {
  float bboxLonMin = u_lonMin;
  float bboxLonMax = u_lonMax;
  float bboxLatMin = u_latMin;
  float bboxLatMax = u_latMax;
  vec2 lonLat = v_lonLat;

  // handle the different cases for the bounding box.
  // 0: basic case, no antimeridian crossing, lonMin < lonMax and both are in [-180, 180] (e.g., lonMin = -160, lonMax = 160)
  // 1: crosses the antimeridian, lonMin > lonMax (e.g., lonMin = 160, lonMax = -160)
  // 2: crosses the antimeridian, lonMin < lonMax and both are positive (e.g., lonMin = 160, lonMax = 200 or lonMin = 0, lonMax = 360)
  // 3: crosses the antimeridian, lonMin < lonMax and both are negative (e.g., lonMin = -200, lonMax = -160)
  // 4: crosses the antimeridian, lonMin < lonMax but lonMin is lower than -180 (e.g. lonMin = -180.125, lonMax = 179.875)

  bool isBasicCase = bboxLonMin < bboxLonMax && bboxLonMin >= -180.0 && bboxLonMax <= 180.0;

  // With a non standard case, we need to wrap the lonLat.x value to be inside the bounding box,
  // so that it can be used to sample the texture.
  // Note: in theory, this should work well with the basic case too, but there are minor edge of texture rendering case
  // that can happen when the lonLat.x is exactly equal to the bboxLonMin or bboxLonMax, so we avoid doing it in that case.
  if (!isBasicCase) {
    if (bboxLonMax < bboxLonMin) {
      bboxLonMax += 360.0;
    }
    lonLat.x = mod(lonLat.x - bboxLonMin, 360.0) + bboxLonMin;
  }

  // Discard the fragment if the lonLat is outside the bounding box
  if (!isInsideBoundingBox(lonLat, bboxLonMin, bboxLonMax, bboxLatMin, bboxLatMax)) {
    discard;
    return;
  }

  // Position inside the texture
  vec2 texCoord = vec2(
    (lonLat.x - bboxLonMin) / (bboxLonMax - bboxLonMin),
    1. - (lonLat.y - bboxLatMin) / (bboxLatMax - bboxLatMin)
  );

  // bicubic interpolation is more expensive than bilinear interpolation,
  // so we only use it if the user requested it.
  if (u_bicubic) {
    fragColor = textureBicubic(u_tex, texCoord);
  } else {
    // Bilinear interpolation
    fragColor = texture(u_tex, texCoord);
  }
  fragColor.a *= u_opacity;
}
