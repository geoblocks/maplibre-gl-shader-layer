precision highp float;
precision highp int;

uniform sampler2D u_texBefore;
uniform sampler2D u_texAfter;
uniform bool u_bicubic;
uniform float u_opacity;
uniform float u_seriesAxisValueBefore;
uniform float u_seriesAxisValueAfter;
uniform float u_seriesAxisValue;
uniform float u_rasterEncodingPolynomialSlope;
uniform float u_rasterEncodingPolynomialOffset;
uniform float u_colormapRangeMin;
uniform float u_colormapRangeMax;
uniform sampler2D u_colormapTex;
in vec2 v_uv;
out vec4 fragColor;



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



// Scales a value from the colormap range (in real-world unit)
// to [0, 1]
float rescaleToTexture(float realWorldValue) {
  return (realWorldValue - u_colormapRangeMin) / (u_colormapRangeMax - u_colormapRangeMin);
}

// Looks up the colormaps color from a given real world unit
vec4 getTextureColor(float realWorldValue) {
  float unitPosition = rescaleToTexture(realWorldValue);
  return texture(u_colormapTex, vec2(unitPosition, 0.5));
}


float getRealWorldValue(sampler2D tex, inout bool isNodata) {
  vec4 texColor = u_bicubic ? textureBicubic(tex, v_uv) : texture(tex, v_uv);
  isNodata = (texColor.a == 0.0);

  // For this test, we use the define RASTER_ENCODING_CHANNELS to know on what channel
  // the value to display is encoded
  // those channels will then be addressed as relevantChannels.x .y and .z

  float x = 0.;

  #if RASTER_ENCODING_NB_CHANNELS == 1
    x = texColor.RASTER_ENCODING_CHANNELS * 255.;
  #elif RASTER_ENCODING_NB_CHANNELS == 2
    vec2 relevantChannels = texColor.RASTER_ENCODING_CHANNELS;
    x = (relevantChannels.x * 255.) * 256. + (relevantChannels.y * 255.);
  #elif RASTER_ENCODING_NB_CHANNELS == 3
    vec3 relevantChannels = texColor.RASTER_ENCODING_CHANNELS;
    x = (relevantChannels.x * 255.) * 256. * 256. + (relevantChannels.y * 255.) * 256. + (relevantChannels.z * 255.);
  #endif

  // The value in real world unit
  float y = u_rasterEncodingPolynomialSlope * x + u_rasterEncodingPolynomialOffset;
  return y;
}




void main()  {
  bool u_texBeforeIsNodata = false;
  bool u_texAfterIsNodata = false;
  float realWorldValueBefore = getRealWorldValue(u_texBefore, u_texBeforeIsNodata);
  float realWorldValueAfter = getRealWorldValue(u_texAfter, u_texAfterIsNodata);

  if (u_texBeforeIsNodata || u_texAfterIsNodata) {
    // fragColor = vec4(1., 0., 0., 0.3);
    discard;
    return;
  }

  float ratioAfter = u_seriesAxisValueAfter == u_seriesAxisValueBefore ? 0.0 : (u_seriesAxisValue - u_seriesAxisValueBefore) / (u_seriesAxisValueAfter - u_seriesAxisValueBefore);
  float interpolatedRealWorldValue = ratioAfter * realWorldValueAfter + (1. - ratioAfter) * realWorldValueBefore;
  fragColor = getTextureColor(interpolatedRealWorldValue);
  fragColor.a *= u_opacity; 
}