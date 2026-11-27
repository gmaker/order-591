#version 300 es
precision mediump float;

const int MAX_LIGHTS = 16;

uniform vec3 u_ambient;
uniform vec3 u_sunDir;     // direction toward the sun, normalised
uniform vec3 u_sunColor;
uniform int u_lightCount;
uniform vec4 u_lightPos[MAX_LIGHTS];    // xyz position, w radius
uniform vec3 u_lightColor[MAX_LIGHTS];

in vec3 v_normal;
in vec3 v_worldPos;
in vec3 v_color;
in float v_bright;
in float v_emissive;
in float v_flash;
in float v_alpha;

out vec4 fragColor;

// 4×4 Bayer matrix: transparency as a screen-door pattern, no sorting needed
// and it suits the chunky pixels.
const float BAYER[16] = float[16](
   0.0,  8.0,  2.0, 10.0,
  12.0,  4.0, 14.0,  6.0,
   3.0, 11.0,  1.0,  9.0,
  15.0,  7.0, 13.0,  5.0
);

void main() {
  if (v_alpha < 1.0) {
    int bx = int(mod(gl_FragCoord.x, 4.0));
    int by = int(mod(gl_FragCoord.y, 4.0));
    float threshold = (BAYER[by * 4 + bx] + 0.5) / 16.0;
    if (v_alpha < threshold) discard;
  }

  vec3 n = normalize(v_normal);
  vec3 light = u_ambient + u_sunColor * max(dot(n, u_sunDir), 0.0);
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= u_lightCount) break;
    vec3 d = u_lightPos[i].xyz - v_worldPos;
    float dist = length(d);
    float att = clamp(1.0 - dist / u_lightPos[i].w, 0.0, 1.0);
    att *= att;
    light += u_lightColor[i] * att * max(dot(n, d / max(dist, 0.001)), 0.25);
  }
  vec3 col = v_color * light * v_bright + v_color * v_emissive;
  col = mix(col, vec3(1.0), v_flash);
  fragColor = vec4(col, 1.0);
}
