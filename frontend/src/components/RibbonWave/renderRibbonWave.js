import * as THREE from 'three';
import vertexShader from './wave.vert.glsl?raw';
import fragmentShader from './wave.frag.glsl?raw';

// Folded ribbon geometry in world coordinates.
function ribbonGeometry() {
  const geometry = new THREE.PlaneGeometry(400, 400, 128, 256);
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const vertex = new THREE.Vector3();
  const xAxis = new THREE.Vector3(1, 0, 0);
  const yAxis = new THREE.Vector3(0, 1, 0);
  for (let index = 0; index < positions.count; index++) {
    vertex.fromBufferAttribute(positions, index);
    const v = uv.getY(index);
    const radius = 4 - 2 * Math.pow(4 * v * (1 - v), 9.5);
    if (vertex.x < -16) vertex.z += radius;
    else if (vertex.x < 16) {
      const angle = (vertex.x + 16) / 32 * Math.PI;
      vertex.z = Math.cos(angle) * radius;
      vertex.x = Math.cos(angle - Math.PI / 2) * radius - 16;
    } else { vertex.z -= radius; vertex.x = -vertex.x; }
    vertex.x += 100;
    vertex.applyAxisAngle(xAxis, -Math.PI / 2).applyAxisAngle(yAxis, -Math.PI / 2);
    positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }
  positions.needsUpdate = true;
  return geometry;
}

function loadPalette(signal) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load('/ribbon-wave/palette-light.webp', texture => {
      if (signal.aborted) { texture.dispose(); reject(new DOMException('Aborted', 'AbortError')); return; }
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      resolve(texture);
    }, undefined, reject);
  });
}

export async function createRibbonWave(canvas, { signal, onReady, onError }) {
  if (!canvas || signal.aborted) return () => {};
  const palette = await loadPalette(signal);
  if (signal.aborted) { palette.dispose(); return () => {}; }
  let renderer;
  let geometry;
  let material;
  let observer;
  let frame = 0;
  let disposed = false;
  const contextLost = event => {
    event.preventDefault();
    dispose();
    onError();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    canvas.removeEventListener('webglcontextlost', contextLost);
    observer?.disconnect();
    geometry?.dispose();
    material?.dispose();
    palette.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
  };

  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    canvas.addEventListener('webglcontextlost', contextLost);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.debug.onShaderError = () => { throw new Error('ribbon wave shader unavailable.'); };
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 10000);
    camera.position.set(100, 0, 5000);
    camera.lookAt(0, 0, 0);

    const settings = {
      speed: 0.00004,
      twistFrequencyX: -0.65, twistFrequencyY: 0.41, twistFrequencyZ: -0.58,
      twistPowerX: 3.63, twistPowerY: 0.7, twistPowerZ: 3.95,
      displaceFrequencyX: 0.005831, displaceFrequencyZ: 0.016001, displaceAmount: -7.821,
      colorContrast: 1, colorSaturation: 1, colorHueShift: -0.00159265358979299,
      glowAmount: 1.98, glowPower: 0.806, glowRamp: 0.834,
    };
    const uniforms = Object.fromEntries(Object.entries(settings).map(([key, value]) => [`u_${key}`, { value }]));
    Object.assign(uniforms, {
      u_time: { value: 35000 },
      u_resolution: { value: new THREE.Vector2() },
      u_paletteTexture: { value: palette },
    });
    geometry = ribbonGeometry();
    material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, side: THREE.DoubleSide, transparent: true });
    const ribbon = new THREE.Mesh(geometry, material);
    scene.add(ribbon);

    const resize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setSize(width, height, false);
      uniforms.u_resolution.value.set(width * renderer.getPixelRatio(), height * renderer.getPixelRatio());
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      const mobile = window.innerWidth < 640;
      const tablet = !mobile && window.innerWidth < 1264;
      ribbon.position.set(mobile ? 525 : tablet ? 320 : 380, tablet ? -315 : -301.7, -11.1);
      ribbon.rotation.set(mobile ? -0.64 : tablet ? -0.5 : -0.449592653589793, -0.117592653589793, mobile ? 1.68 : tablet ? 1.64 : 1.87440734641021);
      ribbon.scale.set(9, 8, 5);
      renderer.render(scene, camera);
    };
    resize();
    observer = new ResizeObserver(() => {
      if (disposed || signal.aborted) return;
      try { resize(); }
      catch { dispose(); onError(); }
    });
    observer.observe(canvas);
    const start = performance.now();
    let previous = 0;
    const draw = now => {
      if (disposed || signal.aborted) return;
      if (now - previous >= 1000 / 30) {
        uniforms.u_time.value = 35000 + now - start;
        try { renderer.render(scene, camera); }
        catch { dispose(); onError(); return; }
        previous = now;
      }
      frame = requestAnimationFrame(draw);
    };
    onReady();
    frame = requestAnimationFrame(draw);
    return dispose;
  } catch (error) { dispose(); throw error; }
}
