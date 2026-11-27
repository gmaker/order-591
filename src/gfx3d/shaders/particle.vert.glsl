#version 300 es
// Camera-facing billboards; one quad per particle via instancing.
in vec2 a_corner;      // -0.5..0.5
in vec3 a_iPos;
in vec4 a_iColor;
in float a_iSize;

uniform mat4 u_viewProj;
uniform vec3 u_right;
uniform vec3 u_up;

out vec4 v_color;
out vec2 v_corner;

void main() {
  vec3 wp = a_iPos + (u_right * a_corner.x + u_up * a_corner.y) * a_iSize;
  v_color = a_iColor;
  v_corner = a_corner;
  gl_Position = u_viewProj * vec4(wp, 1.0);
}
