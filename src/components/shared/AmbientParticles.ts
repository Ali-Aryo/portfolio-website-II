import * as THREE from 'three'
import { createGlowPointsMaterial } from '@/lib/glowPointsMaterial'

type AmbientParticlesOptions = {
    count: number
    /** Radial band the motes occupy, in world units around the group origin. */
    innerRadius: number
    outerRadius: number
    /** Dominant color and sprinkle color (e.g. primary purple + cyan). */
    baseColor: THREE.Color
    accentColor: THREE.Color
    /** Fraction of motes tinted with the accent color. */
    accentRatio: number
    texture: THREE.Texture
}

type Mote = {
    base: THREE.Vector3
    amp: THREE.Vector3
    speed: THREE.Vector3
    phase: THREE.Vector3
    twinkleSpeed: number
    twinklePhase: number
    baseAlpha: number
    explodeDir: THREE.Vector3
    explodeDist: number
}

/**
 * A drifting cloud of tiny additive glow motes surrounding the neural
 * network — the "alive" atmosphere. Motion is layered sine drift (organic,
 * fully deterministic per mote), each mote twinkles on its own rhythm, and
 * during the morph the cloud is blasted outward and dissolves.
 *
 * Add `points` to the network group so the cloud tilts and shifts with it.
 */
export class AmbientParticles {
    readonly points: THREE.Points

    private geometry: THREE.BufferGeometry
    private material: THREE.ShaderMaterial
    private motes: Mote[] = []
    private positions: Float32Array
    private alphas: Float32Array

    constructor(opts: AmbientParticlesOptions) {
        const { count, innerRadius, outerRadius, baseColor, accentColor, accentRatio, texture } = opts

        this.positions = new Float32Array(count * 3)
        this.alphas = new Float32Array(count)
        const sizes = new Float32Array(count)
        const colors = new Float32Array(count * 3)

        const dir = new THREE.Vector3()
        const tmpColor = new THREE.Color()
        for (let i = 0; i < count; i++) {
            dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
            // pow < 1 biases motes toward the middle of the band, where the
            // network lives, with a thinning outer shell.
            const radius = innerRadius + (outerRadius - innerRadius) * Math.pow(Math.random(), 0.7)
            const base = dir.clone().multiplyScalar(radius)

            // A few oversized, faint "bokeh" motes add depth; the rest are dust.
            const isBokeh = Math.random() < 0.06
            sizes[i] = isBokeh ? 0.14 + Math.random() * 0.12 : 0.025 + Math.random() * 0.07

            tmpColor
                .copy(Math.random() < accentRatio ? accentColor : baseColor)
                .offsetHSL((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.15)
            colors[i * 3] = tmpColor.r
            colors[i * 3 + 1] = tmpColor.g
            colors[i * 3 + 2] = tmpColor.b

            this.motes.push({
                base,
                amp: new THREE.Vector3(
                    0.15 + Math.random() * 0.4,
                    0.15 + Math.random() * 0.4,
                    0.15 + Math.random() * 0.4,
                ),
                speed: new THREE.Vector3(
                    0.1 + Math.random() * 0.4,
                    0.1 + Math.random() * 0.4,
                    0.1 + Math.random() * 0.4,
                ),
                phase: new THREE.Vector3(
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                ),
                twinkleSpeed: 0.8 + Math.random() * 1.8,
                twinklePhase: Math.random() * Math.PI * 2,
                baseAlpha: isBokeh ? 0.05 + Math.random() * 0.06 : 0.09 + Math.random() * 0.2,
                explodeDir: dir.clone(),
                explodeDist: 3 + Math.random() * 4,
            })
            this.positions.set([base.x, base.y, base.z], i * 3)
            this.alphas[i] = this.motes[i].baseAlpha
        }

        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
        )
        this.geometry.setAttribute(
            'aAlpha',
            new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage),
        )
        this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
        this.geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))

        this.material = createGlowPointsMaterial(texture)
        this.points = new THREE.Points(this.geometry, this.material)
        this.points.frustumCulled = false
    }

    /** See glowPointsMaterial: drawingBufferHeight / (2 * tan(fovY / 2)). */
    setPixelScale(value: number) {
        this.material.uniforms.uPixelScale.value = value
    }

    update(time: number, morph: number, reducedMotion: boolean) {
        // The cloud is blasted outward with the explosion and dissolves well
        // before the dot grid forms.
        const explodeT = Math.min(1, morph / 0.3)
        const explodeEase = explodeT * (2 - explodeT)
        const fade = Math.max(0, 1 - morph / 0.35)

        // Fully dissolved: hide and skip the per-mote work. Scrubbing back
        // re-enters the loop and rewrites the buffers on the next frame.
        this.points.visible = fade > 0.001
        if (!this.points.visible) return

        for (let i = 0; i < this.motes.length; i++) {
            const p = this.motes[i]
            let x = p.base.x
            let y = p.base.y
            let z = p.base.z
            if (!reducedMotion) {
                x += Math.sin(time * p.speed.x + p.phase.x) * p.amp.x
                y += Math.sin(time * p.speed.y + p.phase.y) * p.amp.y
                z += Math.sin(time * p.speed.z + p.phase.z) * p.amp.z
            }
            if (explodeEase > 0) {
                x += p.explodeDir.x * p.explodeDist * explodeEase
                y += p.explodeDir.y * p.explodeDist * explodeEase
                z += p.explodeDir.z * p.explodeDist * explodeEase
            }
            const o = i * 3
            this.positions[o] = x
            this.positions[o + 1] = y
            this.positions[o + 2] = z

            let a = p.baseAlpha * fade
            if (!reducedMotion) {
                a *= 0.55 + 0.45 * Math.sin(time * p.twinkleSpeed + p.twinklePhase)
            }
            this.alphas[i] = a
        }
        this.geometry.attributes.position.needsUpdate = true
        this.geometry.attributes.aAlpha.needsUpdate = true
    }

    dispose() {
        this.geometry.dispose()
        this.material.dispose()
    }
}
