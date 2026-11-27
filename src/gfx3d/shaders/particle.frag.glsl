#version 300 es
precision mediump float;

in vec4 v_color;
in vec2 v_corner;

out vec4 fragColor;

void main() {
  // Round particles: drop the corners of the quad.
  if (dot(v_corner, v_corner) > 0.25) discard;
  fragColor = v_color;
}
