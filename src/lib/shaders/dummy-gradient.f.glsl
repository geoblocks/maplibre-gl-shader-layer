precision highp float;
precision highp int;

uniform float u_zoom;
uniform float u_opacity;
in vec2 v_uv;
out vec4 fragColor;

void main()  {
  vec2 tileCenter = vec2(0.5, 0.5);
  float distanceToCenter = sqrt(pow(v_uv.x - tileCenter.x, 2.) + pow(v_uv.y - tileCenter.y, 2.));

  fragColor = vec4(v_uv.x, v_uv.y, 1., 0.6 * u_opacity);

	float radius = fract(u_zoom + 0.5) / 2.;

  if (distanceToCenter < radius) {
    fragColor.a = 0.0;
  }
}