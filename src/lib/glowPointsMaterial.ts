import * as THREE from 'three'

/**
 * Additive point-sprite material with per-point WORLD-SPACE size, color, and
 * alpha, supplied as geometry attributes `aSize` / `aColor` / `aAlpha`.
 *
 * Set the `uPixelScale` uniform to
 * `drawingBufferHeight / (2 * tan(fovY / 2))` whenever the canvas resizes so
 * `aSize` keeps meaning world units regardless of resolution or DPR.
 */
export function createGlowPointsMaterial(map: THREE.Texture): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        uniforms: {
            uMap: { value: map },
            uPixelScale: { value: 400 },
        },
        vertexShader: /* glsl */ `
            attribute float aSize;
            attribute vec3 aColor;
            attribute float aAlpha;
            uniform float uPixelScale;
            varying vec3 vColor;
            varying float vAlpha;
            void main() {
                vColor = aColor;
                vAlpha = aAlpha;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = aSize * uPixelScale / -mv.z;
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform sampler2D uMap;
            varying vec3 vColor;
            varying float vAlpha;
            void main() {
                gl_FragColor = vec4(vColor, vAlpha) * texture2D(uMap, gl_PointCoord);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    })
}
