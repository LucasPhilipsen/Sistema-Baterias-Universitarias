precision highp float;

varying vec2 v_uv;
varying vec2 v_resolution;

uniform sampler2D u_paletteTexture;

uniform float u_colorSaturation;
uniform float u_colorContrast;
uniform float u_colorHueShift;

uniform float u_glowAmount;
uniform float u_glowPower;
uniform float u_glowRamp;

// Stefan Gustavson's version;
// https://www.shadertoy.com/view/43tBDr
// https://www.researchgate.net/publication/216813608_Simplex_noise_demystified

// https://xxhash.com/
// https://github.com/Cyan4973/xxHash/blob/dev/LICENSE

float xxhash(vec2 x) {
  uvec2 t = floatBitsToUint(x);
  uint h = 0xc2b2ae3du * t.x + 0x165667b9u;
  h = (h << 17u | h >> 15u) * 0x27d4eb2fu;
  h += 0xc2b2ae3du * t.y;
  h = (h << 17u | h >> 15u) * 0x27d4eb2fu;
  h ^= h >> 15u;
  h *= 0x85ebca77u;
  h ^= h >> 13u;
  h *= 0xc2b2ae3du;
  h ^= h >> 16u;
  return uintBitsToFloat(h >> 9u | 0x3f800000u) - 1.0;
}

vec2 hash(vec2 x) {
  float k = 6.283185307 * xxhash(x);
  return vec2(cos(k), sin(k));
}

float simplexNoise(in vec2 p) {
  const float K1 = 0.366025404; // (sqrt(3)-1)/2;
  const float K2 = 0.211324865; // (3-sqrt(3))/6;

  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2 o = vec2(m, 1.0 - m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * vec3(dot(a, hash(i + 0.0)), dot(b, hash(i + o)), dot(c, hash(i + 1.0))); // changed to h^3 [1]

  return dot(n, vec3(32.99)); // analytic factor (= 2916*sqrt(2)/125)
}

// Shaping functions by Inigo Quilez
// https://iquilezles.org/articles/functions/
// https://thebookofshaders.com/05/

float parabola(float x, float k) {
  return pow(4.0 * x * (1.0 - x), k);
}

vec3 contrast(in vec3 v, in float a) {
  return (v - 0.5) * a + 0.5;
}

vec3 desaturate(vec3 color, float factor) {
  // generic, rgb values are arbitrary
  vec3 lum = vec3(0.299, 0.587, 0.114);
  vec3 gray = vec3(dot(lum, color));
  return mix(color, gray, factor);
}

// https://godotshaders.com/shader/hue-shift/
// CC0 license, https://creativecommons.org/publicdomain/zero/1.0/
vec3 hueShift(vec3 color, float shift) {
  vec3 gray = vec3(0.57735);
  vec3 projection = gray * dot(gray, color);
  vec3 U = color - projection;
  vec3 V = cross(gray, U);
  vec3 shifted = U * cos(shift) + V * sin(shift) + projection;
  return shifted;
}

float mapLinear(float value, float min1, float max1, float min2, float max2) {
  return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

vec3 surfaceColor(vec2 uv, float pdy) {
  vec3 color = texture2D(u_paletteTexture, vec2(uv.x, uv.y)).rgb;

  float strength = 0.2;
  float freq = 600.0;
  float colorAtten = 0.9;
  float paraPow = 3.0;

  float p = 1.0 - parabola(uv.x, paraPow);
  float n0 = simplexNoise(vec2(v_uv.x * 0.1, v_uv.y * 0.5));
  float n1 = simplexNoise(vec2(v_uv.x * (freq + (freq * 0.5 * n0)), v_uv.y * 4.0 * n0));
  n1 = mapLinear(n1, -1.0, 1.0, 0.0, 1.0);

  vec3 textureColor = color;
  textureColor += (n1 * strength * (1.0 - textureColor.b * colorAtten) * pdy * p);

  color = textureColor;
  return color;
}

void main(void) {
  vec2 dy = dFdy(v_uv);
  float pdy = dy.y * v_resolution.y * u_glowAmount;
  pdy = mapLinear(pdy, -1.0, 1.0, 0.0, 1.0);
  pdy = clamp(pdy, 0.0, 1.0);
  pdy = pow(pdy, u_glowPower);
  pdy = smoothstep(0.0, u_glowRamp, pdy);
  pdy = clamp(pdy, 0.0, 1.0);

  vec4 color = vec4(surfaceColor(v_uv, pdy), 1.0);

  color.rgb = contrast(color.rgb, u_colorContrast);
  color.rgb = desaturate(color.rgb, 1.0 - u_colorSaturation);
  color.rgb = hueShift(color.rgb, u_colorHueShift);

  color += (1.0 - pdy) * 0.25;
  gl_FragColor = clamp(color, 0.0, 1.0);
}
