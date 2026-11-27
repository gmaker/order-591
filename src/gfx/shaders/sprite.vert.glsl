#version 300 es
// Pixel-space quads → clip space. a_pos is in backbuffer pixels, origin top-left.
in vec2 a_pos;
in vec2 a_uv;
in vec4 a_color;

uniform vec2 u_resolution;

out vec2 v_uv;
out vec4 v_color;

void main() {
  v_uv = a_uv;
  v_color = a_color;
  vec2 clip = (a_pos / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
