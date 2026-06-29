precision highp float;
precision highp int;

uniform sampler2D u_tex;
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

void main()  {
  // Discard the fragment if the lonLat is outside the bounding box
  if (!isInsideBoundingBox(v_lonLat, u_lonMin, u_lonMax, u_latMin, u_latMax)) {
    discard;
  }

  float texPositionX = (v_lonLat.x - u_lonMin) / (u_lonMax - u_lonMin);
  float texPositionY = 1. - (v_lonLat.y - u_latMin) / (u_latMax - u_latMin);
  vec2 texCoord = vec2(texPositionX, texPositionY);
  fragColor = texture(u_tex, texCoord);
  fragColor.a *= u_opacity;
}