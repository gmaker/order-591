#version 300 es
// Instanced flat-shaded meshes. Per-instance: position, yaw + scale, tint +
// brightness, and extras (emissive, sway amplitude, hit flash, alpha).
in vec3 a_position;
in vec3 a_normal;
in vec3 a_color;
in float a_sway;

in vec3 a_iPos;
in vec4 a_iRotScale;   // yaw, sx, sy, sz
in vec4 a_iTint;       // r, g, b, brightness
in vec4 a_iExtra;      // emissive, swayAmp, flash, alpha

uniform mat4 u_viewProj;
uniform float u_time;

out vec3 v_normal;
out vec3 v_worldPos;
out vec3 v_color;
out float v_bright;
out float v_emissive;
out float v_flash;
out float v_alpha;

void main() {
  float c = cos(a_iRotScale.x);
  float s = sin(a_iRotScale.x);
  vec3 p = a_position * a_iRotScale.yzw;
  vec3 n = a_normal;
  vec3 rp = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  vec3 rn = vec3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z);
  vec3 wp = rp + a_iPos;

  // Wind: phase from the vertex's own world position, so blades in one
  // patch do not move in lockstep.
  float sw = a_sway * a_iExtra.y;
  float px = wp.x;
  float pz = wp.z;
  wp.x += sw * sin(u_time * 2.1 + px * 1.7 + pz * 1.3) * 0.35;
  wp.z += sw * cos(u_time * 1.7 + px * 1.1 + pz * 1.9) * 0.25;

  v_normal = rn;
  v_worldPos = wp;
  v_color = a_color * a_iTint.rgb;
  v_bright = a_iTint.a;
  v_emissive = a_iExtra.x;
  v_flash = a_iExtra.z;
  v_alpha = a_iExtra.w;
  gl_Position = u_viewProj * vec4(wp, 1.0);
}
