#version 300 es
precision mediump float;

uniform sampler2D u_tex;

in vec2 v_uv;
in vec4 v_color;

out vec4 fragColor;

void main() {
  vec4 texel = texture(u_tex, v_uv);
  fragColor = vec4(v_color.rgb * texel.rgb, v_color.a * texel.a);
}
