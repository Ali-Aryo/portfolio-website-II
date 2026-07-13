import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { DOT_GRID_DEFAULTS } from '@/lib/dotGridLayout'
import { computeMorphLayout } from '@/lib/morphTargets'
import { createGlowTexture } from '@/lib/glowTexture'
import { createGlowPointsMaterial } from '@/lib/glowPointsMaterial'
import { AmbientParticles } from './AmbientParticles'

export type NeuralNetworkHandle = {
    /**
     * Drives the network-to-dot-grid morph. 0 = living network,
     * ~0.3 = fully exploded, 1 = a complete dot grid matching DotGrid.
     */
    setMorph: (progress: number) => void
    /**
     * Slides the network from its resting originX toward the canvas
     * center: 0 = at originX, 1 = centered. Run it before the morph so
     * the explosion happens center-screen.
     */
    setShift: (progress: number) => void
}

type NeuralNetworkProps = {
    /** Base color of nodes and connection lines. */
    primaryColor?: string
    /** Highlight color sprinkled on ~20% of nodes. */
    accentColor?: string
    /** Color of the data pulses traveling along connections. */
    pulseColor?: string
    /** Color nodes glow toward when the cursor is near. */
    glowColor?: string
    /** Number of nodes in the network. */
    nodeCount?: number
    /** Ambient atmosphere motes drifting around the network. */
    particleCount?: number
    /** Average seconds between neural firing events. */
    fireInterval?: number
    /** Max distance between two nodes for a connection to form. */
    connectionDistance?: number
    /** How far the whole network tilts toward the cursor, in radians. */
    mouseFollow?: number
    /** World-space radius around the cursor ray in which nodes react. */
    interactionRadius?: number
    /** Horizontal center of the network as a fraction of the canvas width
     *  (0.5 = centered, 0.75 = center of the right half). */
    originX?: number
    /** Fraction of the canvas width the network must fit inside. */
    fitFraction?: number
    /** Morph destination: must match the real DotGrid's props for a
     *  seamless handoff. */
    gridDotSize?: number
    gridGap?: number
    gridColor?: string
    className?: string
    ref?: Ref<NeuralNetworkHandle>
}

type NodeData = {
    position: THREE.Vector3
    renderPos: THREE.Vector3
    originalPos: THREE.Vector3
    velocity: THREE.Vector3
    pull: THREE.Vector3
    baseColor: THREE.Color
    glow: number
    /** Neural-firing flash, 1 -> 0 decay. */
    fire: number
    /** Per-node rhythm offset for the breathing scale. */
    phase: number
    /** Indices into `pairs` of the connections touching this node. */
    edges: number[]
    /** Explode-phase direction and travel distance. */
    explodeDir: THREE.Vector3
    explodeDist: number
    /** Per-node delay so the reform rains in organically. */
    stagger: number
    /** Dot-grid lattice destination, in group-local space. */
    target: THREE.Vector3
}

/** A dot that only exists during the morph: it materializes on a lattice
 *  cell the network nodes don't cover, completing the grid. */
type Filler = {
    target: THREE.Vector3
    /** True: bursts outward from the blast center like the real nodes.
     *  False: pops in independently, in place, at a random moment. */
    isShockwave: boolean
    /** Jittered near-center point a shockwave filler flies out from.
     *  Unused (equals target) for non-shockwave fillers. */
    start: THREE.Vector3
    stagger: number
    /** Starting z (toward the camera) a non-shockwave filler settles in
     *  from. */
    zFrom: number
}

type Connection = { a: number; b: number }

type Pulse = {
    sprite: THREE.Sprite
    connection: Connection | null
    /** Travel direction: true = a -> b. Firing nodes emit outward. */
    fromA: boolean
    progress: number
    speed: number
}

const NODE_RADIUS = 0.04
/** Halo diameter in world units at rest (scales with glow/firing). */
const HALO_SIZE = 1.0
/** World diameter the camera must keep in frame (cloud + drift + pull). */
const NETWORK_DIAMETER = 8.2
/** Morph phase boundaries: explode finishes at 0.3, reform fills 0.3..1. */
const EXPLODE_END = 0.3
/** Fraction of lattice-filling dots swept outward by the shockwave (vs.
 *  popping in independently, in place, at a random moment). */
const FILLER_SHOCKWAVE_RATIO = 0.7
/** Radius of the cluster shockwave-driven fillers appear to burst from. */
const FILLER_BLAST_JITTER = 0.6

const smoothstep = (t: number) => {
    const x = Math.min(1, Math.max(0, t))
    return x * x * (3 - 2 * x)
}

/**
 * A sci-fi neural network: breathing glow nodes on a spherical cloud inside
 * a drifting particle nebula, linked by shimmering connections that carry
 * light pulses. Nodes randomly "fire" — flashing and emitting pulses down
 * their edges — the whole network tilts toward the cursor, and nodes near
 * the cursor brighten, swell, and get gently attracted.
 *
 * Via the `setMorph` ref handle the network can explode apart and reform as
 * a flat dot grid: halos, lines, pulses, and atmosphere dissolve in the
 * blast, and the node cores (plus lattice fillers) land dot-for-dot on the
 * DotGrid component's grid.
 *
 * Renders on a transparent canvas that fills its parent, so the parent must
 * have a real height.
 */
export default function NeuralNetwork({
    primaryColor = '#7c3aed',
    accentColor = '#00f2ff',
    pulseColor = '#ffffff',
    glowColor = '#ffffff',
    nodeCount = 400,
    particleCount = 4000,
    fireInterval = 0.3,
    connectionDistance = 1.8,
    mouseFollow = 0.4,
    interactionRadius = 1.6,
    originX = 0.5,
    fitFraction = 1,
    gridDotSize = DOT_GRID_DEFAULTS.dotSize,
    gridGap = DOT_GRID_DEFAULTS.gap,
    gridColor = DOT_GRID_DEFAULTS.baseColor,
    className,
    ref,
}: NeuralNetworkProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const morphRef = useRef(0)
    const shiftRef = useRef(0)

    useImperativeHandle(ref, () => ({
        setMorph: (progress: number) => {
            morphRef.current = Math.min(1, Math.max(0, progress))
        },
        setShift: (progress: number) => {
            shiftRef.current = Math.min(1, Math.max(0, progress))
        },
    }), [])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const prefersReducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches

        const primary = new THREE.Color(primaryColor)
        const accent = new THREE.Color(accentColor)
        const glowCol = new THREE.Color(glowColor)
        const gridCol = new THREE.Color(gridColor)

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
        const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        container.appendChild(renderer.domElement)

        const group = new THREE.Group()
        scene.add(group)

        const glowTex = createGlowTexture()

        // --- Nodes: positions on a jittered fibonacci sphere so the cloud
        // reads as organic rather than gridded. Slight per-node hue/lightness
        // variation keeps the palette from looking flat.
        const nodes: NodeData[] = []
        for (let i = 0; i < nodeCount; i++) {
            const phi = Math.acos(-1 + (2 * i) / nodeCount)
            const theta = Math.sqrt(nodeCount * Math.PI) * phi
            const radius = 3 + (Math.random() - 0.5) * 1.5

            const position = new THREE.Vector3(
                radius * Math.cos(theta) * Math.sin(phi),
                radius * Math.sin(theta) * Math.sin(phi),
                radius * Math.cos(phi),
            )
            nodes.push({
                position,
                renderPos: position.clone(),
                originalPos: position.clone(),
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.005,
                    (Math.random() - 0.5) * 0.005,
                    (Math.random() - 0.5) * 0.005,
                ),
                pull: new THREE.Vector3(),
                baseColor: (Math.random() > 0.8 ? accent : primary)
                    .clone()
                    .offsetHSL((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.1),
                glow: 0,
                fire: 0,
                phase: Math.random() * Math.PI * 2,
                edges: [],
                explodeDir: position
                    .clone()
                    .normalize()
                    .add(
                        new THREE.Vector3(
                            (Math.random() - 0.5) * 0.6,
                            (Math.random() - 0.5) * 0.6,
                            (Math.random() - 0.5) * 0.6,
                        ),
                    )
                    .normalize(),
                explodeDist: 2 + Math.random() * 2.5,
                stagger: Math.random(),
                target: new THREE.Vector3(),
            })
        }

        // --- Instanced mesh holding the node cores AND the morph filler
        // dots. Capacity depends on how many lattice cells the viewport has,
        // so it is (re)allocated from updateViewport.
        const nodeGeom = new THREE.SphereGeometry(NODE_RADIUS, 12, 12)
        const nodeMat = new THREE.MeshBasicMaterial()
        let nodeMesh: THREE.InstancedMesh | null = null
        let capacity = 0
        const ensureCapacity = (needed: number) => {
            if (nodeMesh && needed <= capacity) return
            if (nodeMesh) {
                group.remove(nodeMesh)
                nodeMesh.dispose()
            }
            capacity = Math.ceil(needed * 1.25)
            nodeMesh = new THREE.InstancedMesh(nodeGeom, nodeMat, capacity)
            nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
            nodeMesh.frustumCulled = false
            group.add(nodeMesh)
        }

        // --- Halo layer: one soft additive glow sprite per node, breathing
        // and flaring with cursor glow / firing, gone by the time the grid
        // forms so only the crisp cores remain.
        const haloPositions = new Float32Array(nodeCount * 3)
        const haloSizes = new Float32Array(nodeCount)
        const haloAlphas = new Float32Array(nodeCount)
        const haloColors = new Float32Array(nodeCount * 3)
        {
            const tint = new THREE.Color()
            for (let i = 0; i < nodeCount; i++) {
                tint.copy(nodes[i].baseColor).lerp(new THREE.Color('#ffffff'), 0.15)
                haloColors[i * 3] = tint.r
                haloColors[i * 3 + 1] = tint.g
                haloColors[i * 3 + 2] = tint.b
            }
        }
        const haloGeom = new THREE.BufferGeometry()
        haloGeom.setAttribute(
            'position',
            new THREE.BufferAttribute(haloPositions, 3).setUsage(THREE.DynamicDrawUsage),
        )
        haloGeom.setAttribute(
            'aSize',
            new THREE.BufferAttribute(haloSizes, 1).setUsage(THREE.DynamicDrawUsage),
        )
        haloGeom.setAttribute(
            'aAlpha',
            new THREE.BufferAttribute(haloAlphas, 1).setUsage(THREE.DynamicDrawUsage),
        )
        haloGeom.setAttribute('aColor', new THREE.BufferAttribute(haloColors, 3))
        const haloMat = createGlowPointsMaterial(glowTex)
        const halos = new THREE.Points(haloGeom, haloMat)
        halos.frustumCulled = false
        group.add(halos)

        // --- Ambient atmosphere: the nebula of drifting motes.
        const particles = new AmbientParticles({
            count: particleCount,
            innerRadius: 0.4,
            outerRadius: 6.4,
            baseColor: primary,
            accentColor: accent,
            accentRatio: 0.1,
            texture: glowTex,
        })
        group.add(particles.points)

        // Sizes the canvas, fits the camera (respecting originX/fitFraction),
        // and recomputes the pixel-aligned lattice: node targets plus filler
        // dots for every remaining cell.
        let gridScale = 1
        /** Group x at rest (originX); animate slides it to 0 via setShift. */
        let restOffsetX = 0
        let fillers: Filler[] = []
        const tmpMat = new THREE.Matrix4()
        const updateViewport = () => {
            const w = container.clientWidth || window.innerWidth
            const h = container.clientHeight || window.innerHeight
            const aspect = w / h
            camera.aspect = aspect
            camera.position.z = Math.max(
                NETWORK_DIAMETER / (2 * Math.tan(halfFov)),
                NETWORK_DIAMETER / (2 * Math.tan(halfFov) * aspect * fitFraction),
            )
            camera.updateProjectionMatrix()
            renderer.setSize(w, h)

            // Point-sprite sizes are in world units; see glowPointsMaterial.
            const pixelScale =
                (h * renderer.getPixelRatio()) / (2 * Math.tan(halfFov))
            haloMat.uniforms.uPixelScale.value = pixelScale
            particles.setPixelScale(pixelScale)

            const worldPerPixel = (2 * camera.position.z * Math.tan(halfFov)) / h
            restOffsetX = w * worldPerPixel * (originX - 0.5)
            gridScale = ((gridDotSize / 2) * worldPerPixel) / NODE_RADIUS

            // Grid targets assume a centered group (offset 0): setShift(1)
            // must bring the network to center before the morph plays.
            const layout = computeMorphLayout({
                width: w,
                height: h,
                worldPerPixel,
                nodeCount,
                dotSize: gridDotSize,
                gap: gridGap,
                offsetXWorld: 0,
            })
            for (let i = 0; i < nodeCount; i++) {
                nodes[i].target.copy(layout.nodeTargets[i])
            }
            // Most fillers burst outward from the blast center like the real
            // nodes, rippling out in the same center-out order as the
            // targets are pre-sorted; the rest ignore position entirely and
            // pop in independently, so the grid doesn't read as one uniform
            // wave sweeping from the middle.
            const lastIdx = Math.max(1, layout.fillerTargets.length - 1)
            fillers = layout.fillerTargets.map((target, i) => {
                const isShockwave = Math.random() < FILLER_SHOCKWAVE_RATIO
                return {
                    target,
                    isShockwave,
                    start: isShockwave
                        ? new THREE.Vector3(
                              (Math.random() - 0.5) * FILLER_BLAST_JITTER,
                              (Math.random() - 0.5) * FILLER_BLAST_JITTER,
                              (Math.random() - 0.5) * FILLER_BLAST_JITTER,
                          )
                        : target.clone(),
                    stagger: isShockwave
                        ? (i / lastIdx) * 0.75 + Math.random() * 0.25
                        : Math.random(),
                    zFrom: 0.5 + Math.random() * 1.5,
                }
            })

            const total = nodeCount + fillers.length
            ensureCapacity(total)
            const mesh = nodeMesh!
            mesh.count = total
            // Seed every instance: node dots at their cloud positions, filler
            // dots parked invisible (scale 0) on their cells. The animate
            // loop overwrites these each frame as needed.
            for (let i = 0; i < nodeCount; i++) {
                tmpMat.makeScale(1, 1, 1).setPosition(nodes[i].renderPos)
                mesh.setMatrixAt(i, tmpMat)
                mesh.setColorAt(i, nodes[i].baseColor)
            }
            for (let i = 0; i < fillers.length; i++) {
                tmpMat.makeScale(0, 0, 0).setPosition(fillers[i].target)
                mesh.setMatrixAt(nodeCount + i, tmpMat)
                mesh.setColorAt(nodeCount + i, gridCol)
            }
            mesh.instanceMatrix.needsUpdate = true
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        }
        updateViewport()

        // --- Connections: every close-enough node pair shares one edge in a
        // single LineSegments buffer; per-vertex colors let edges shimmer and
        // light up near the cursor without extra draw calls.
        const pairs: Connection[] = []
        for (let i = 0; i < nodeCount; i++) {
            for (let j = i + 1; j < nodeCount; j++) {
                const dist = nodes[i].position.distanceTo(nodes[j].position)
                if (dist < connectionDistance) {
                    nodes[i].edges.push(pairs.length)
                    nodes[j].edges.push(pairs.length)
                    pairs.push({ a: i, b: j })
                }
            }
        }
        const pairPhases = new Float32Array(pairs.length)
        for (let k = 0; k < pairs.length; k++) pairPhases[k] = Math.random() * Math.PI * 2

        const linePositions = new Float32Array(pairs.length * 6)
        const lineColors = new Float32Array(pairs.length * 6)
        const lineGeom = new THREE.BufferGeometry()
        lineGeom.setAttribute(
            'position',
            new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage),
        )
        lineGeom.setAttribute(
            'color',
            new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage),
        )
        const lineMat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        })
        const lines = new THREE.LineSegments(lineGeom, lineMat)
        lines.frustumCulled = false
        group.add(lines)

        // --- Data pulses: a pool of glow sprites that travel along
        // connections. Firing nodes emit them outward down their own edges;
        // a few also spawn ambiently.
        const pulseMat = new THREE.SpriteMaterial({
            map: glowTex,
            color: pulseColor,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        })
        const pulses: Pulse[] = []
        for (let i = 0; i < 40; i++) {
            const sprite = new THREE.Sprite(pulseMat)
            sprite.visible = false
            sprite.scale.setScalar(0.001)
            group.add(sprite)
            pulses.push({
                sprite,
                connection: null,
                fromA: true,
                progress: 0,
                speed: 0.02 + Math.random() * 0.04,
            })
        }
        const spawnPulse = (connection: Connection, fromA: boolean) => {
            const p = pulses.find((p) => !p.connection)
            if (!p) return
            p.connection = connection
            p.fromA = fromA
            p.progress = 0
            // Place and size the sprite NOW: it renders this frame, and the
            // travel loop only repositions it on the next one. Without this
            // it flashes once at its stale position (initially the center).
            const start = fromA ? nodes[connection.a] : nodes[connection.b]
            p.sprite.position.copy(start.renderPos)
            p.sprite.scale.setScalar(0.14 * 0.5)
            p.sprite.visible = true
        }

        // --- Cursor tracking: window-relative for the tilt, container-relative
        // NDC for the raycast so the local reaction lines up with the canvas.
        let tiltX = 0
        let tiltY = 0
        const ndc = new THREE.Vector2(10, 10) // offscreen until first move
        const onPointerMove = (e: PointerEvent) => {
            tiltX = e.clientX / window.innerWidth - 0.5
            tiltY = e.clientY / window.innerHeight - 0.5
            const rect = container.getBoundingClientRect()
            ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
            ndc.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
        }
        window.addEventListener('pointermove', onPointerMove)

        const raycaster = new THREE.Raycaster()
        const localRay = new THREE.Ray()
        const groupInverse = new THREE.Matrix4()
        const rayPoint = new THREE.Vector3()
        const pullTarget = new THREE.Vector3()
        const exploded = new THREE.Vector3()
        const tmpColor = new THREE.Color()

        // Rotation is simulated separately, then scaled toward zero as the
        // morph progresses so the grid always lands axis-aligned.
        let rotX = 0
        let rotY = 0
        let rotZ = 0
        let fillersWereActive = false
        let fireCooldown = fireInterval * (0.5 + Math.random())

        const clock = new THREE.Clock()
        let frameId = 0
        const animate = () => {
            frameId = requestAnimationFrame(animate)
            const mesh = nodeMesh!

            const dt = Math.min(clock.getDelta(), 0.05)
            const time = clock.elapsedTime
            const m = morphRef.current
            const live = 1 - m
            const rotationKill = smoothstep((m - EXPLODE_END) / 0.5)

            if (!prefersReducedMotion) {
                rotY += (tiltX * mouseFollow - rotY) * 0.05
                rotX += (tiltY * mouseFollow - rotX) * 0.05
            }
            // Disable ambient spinning rotation to keep the network stable
            // rotZ += 0.001 * live
            group.rotation.set(
                rotX * (1 - rotationKill),
                rotY * (1 - rotationKill),
                rotZ * (1 - rotationKill),
            )
            // Slide from the resting originX to center as setShift ramps up.
            group.position.x = restOffsetX * (1 - shiftRef.current)
            group.updateMatrixWorld()

            // Cursor ray in the group's local space, so node distances stay
            // correct while the group rotates.
            raycaster.setFromCamera(ndc, camera)
            localRay
                .copy(raycaster.ray)
                .applyMatrix4(groupInverse.copy(group.matrixWorld).invert())

            // Neural firing: a random node flashes and emits pulses down its
            // connections. Quiet while morphing or under reduced motion.
            fireCooldown -= dt
            if (fireCooldown <= 0) {
                fireCooldown = fireInterval * (0.6 + Math.random() * 0.8)
                if (!prefersReducedMotion && m < 0.05) {
                    const idx = Math.floor(Math.random() * nodeCount)
                    const node = nodes[idx]
                    node.fire = 1
                    const offset = Math.floor(Math.random() * Math.max(1, node.edges.length))
                    for (let e = 0; e < Math.min(3, node.edges.length); e++) {
                        const pair = pairs[node.edges[(offset + e) % node.edges.length]]
                        spawnPulse(pair, pair.a === idx)
                    }
                }
            }

            const explodeT = Math.min(1, m / EXPLODE_END)
            const explodeEase = explodeT * (2 - explodeT)

            for (let i = 0; i < nodeCount; i++) {
                const node = nodes[i]

                // Subtle drift, bouncing back toward the home position.
                if (!prefersReducedMotion) {
                    node.position.add(node.velocity)
                    if (node.position.distanceTo(node.originalPos) > 0.5) {
                        node.velocity.negate()
                    }
                }

                // Smoothstepped influence by distance to the cursor ray,
                // damped as the morph takes over.
                localRay.closestPointToPoint(node.position, rayPoint)
                const dist = rayPoint.distanceTo(node.position)
                const influence =
                    smoothstep(1 - dist / interactionRadius) * live
                node.glow += (influence - node.glow) * 0.12
                node.fire *= Math.exp(-3.5 * dt)
                // Combined brightness from cursor glow and neural firing.
                const energy = Math.min(1, node.glow + node.fire)

                // Gentle attraction toward the cursor that springs back.
                pullTarget.copy(rayPoint).sub(node.position).multiplyScalar(0.2 * node.glow)
                node.pull.lerp(pullTarget, 0.08)
                node.renderPos.copy(node.position).add(node.pull)

                // Morph: blend live -> exploded -> grid target. Reform is
                // per-node staggered so dots rain onto the lattice.
                let reformT = 0
                if (m > 0) {
                    exploded
                        .copy(node.originalPos)
                        .addScaledVector(node.explodeDir, node.explodeDist * explodeEase)
                    node.renderPos.lerp(exploded, explodeEase)
                    reformT = smoothstep(
                        (m - EXPLODE_END - node.stagger * 0.2) / 0.5,
                    )
                    node.renderPos.lerp(node.target, reformT)
                }

                // Breathe at rest, swell while exploding, settle at grid size.
                const breathe = prefersReducedMotion
                    ? 1
                    : 1 + 0.09 * Math.sin(time * 1.7 + node.phase) * live
                const liveScale =
                    (1 + node.glow * 1.8 + node.fire * 0.5) *
                    breathe *
                    (1 + explodeEase * 0.5 * (1 - reformT))
                const s = liveScale + (gridScale - liveScale) * reformT
                tmpMat.makeScale(s, s, s).setPosition(node.renderPos)
                mesh.setMatrixAt(i, tmpMat)

                // Spark bright while exploding, then adopt the grid color.
                tmpColor
                    .copy(node.baseColor)
                    .lerp(glowCol, energy * 0.85 + explodeEase * (1 - reformT) * 0.4)
                    .lerp(gridCol, reformT)
                mesh.setColorAt(i, tmpColor)

                // Halo mirrors the core: flares with energy and the blast,
                // fully dissolved once the node settles on the lattice.
                const o = i * 3
                haloPositions[o] = node.renderPos.x
                haloPositions[o + 1] = node.renderPos.y
                haloPositions[o + 2] = node.renderPos.z
                haloSizes[i] =
                    HALO_SIZE *
                    breathe *
                    (1 + energy * 0.9 + explodeEase * 0.5) *
                    (1 - reformT)
                haloAlphas[i] = (0.20 + energy * 0.10) * (1 - reformT)
            }
            haloGeom.attributes.position.needsUpdate = true
            haloGeom.attributes.aSize.needsUpdate = true
            haloGeom.attributes.aAlpha.needsUpdate = true

            // Filler dots complete the grid during the reform. Most fly out
            // from the blast center to their lattice cell, like a physical
            // shockwave placing them; the rest just pop in at their fixed
            // position at an independent random moment. One extra pass
            // zeroes them all when the morph snaps back to 0.
            const fillersActive = m > 0
            if (fillersActive || fillersWereActive) {
                for (let i = 0; i < fillers.length; i++) {
                    const f = fillers[i]
                    const t = smoothstep((m - EXPLODE_END - f.stagger * 0.2) / 0.5)
                    const s = gridScale * t
                    tmpMat.makeScale(s, s, s)
                    if (f.isShockwave) {
                        exploded.lerpVectors(f.start, f.target, t)
                        tmpMat.setPosition(exploded)
                    } else {
                        tmpMat.setPosition(f.target.x, f.target.y, f.zFrom * (1 - t))
                    }
                    mesh.setMatrixAt(nodeCount + i, tmpMat)
                }
            }
            fillersWereActive = fillersActive

            mesh.instanceMatrix.needsUpdate = true
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

            // Atmosphere drifts, twinkles, and blows apart with the morph.
            particles.update(time, m, prefersReducedMotion)

            // Connections shimmer slowly and light up with endpoint energy;
            // they fade out early in the morph, and the buffer writes are
            // skipped entirely once invisible.
            lineMat.opacity = 0.6 * Math.max(0, 1 - m / EXPLODE_END)
            lines.visible = lineMat.opacity > 0.001
            if (lines.visible) {
                for (let k = 0; k < pairs.length; k++) {
                    const na = nodes[pairs[k].a]
                    const nb = nodes[pairs[k].b]
                    const o = k * 6

                    linePositions[o] = na.renderPos.x
                    linePositions[o + 1] = na.renderPos.y
                    linePositions[o + 2] = na.renderPos.z
                    linePositions[o + 3] = nb.renderPos.x
                    linePositions[o + 4] = nb.renderPos.y
                    linePositions[o + 5] = nb.renderPos.z

                    const shimmer = prefersReducedMotion
                        ? 0.06
                        : 0.06 * (1 + Math.sin(time * 0.9 + pairPhases[k]))
                    const energyA = Math.min(1, na.glow + na.fire)
                    const energyB = Math.min(1, nb.glow + nb.fire)

                    tmpColor
                        .copy(na.baseColor)
                        .multiplyScalar(Math.min(1, 0.16 + shimmer + energyA * 0.65))
                    lineColors[o] = tmpColor.r
                    lineColors[o + 1] = tmpColor.g
                    lineColors[o + 2] = tmpColor.b
                    tmpColor
                        .copy(nb.baseColor)
                        .multiplyScalar(Math.min(1, 0.16 + shimmer + energyB * 0.65))
                    lineColors[o + 3] = tmpColor.r
                    lineColors[o + 4] = tmpColor.g
                    lineColors[o + 5] = tmpColor.b
                }
                lineGeom.attributes.position.needsUpdate = true
                lineGeom.attributes.color.needsUpdate = true
            }

            // Ambient pulse spawning (throttled; firing spawns the rest).
            if (!prefersReducedMotion && m < 0.05 && Math.random() < 0.3) {
                spawnPulse(
                    pairs[Math.floor(Math.random() * pairs.length)],
                    Math.random() < 0.5,
                )
            }
            for (const p of pulses) {
                if (!p.connection) continue
                if (m > EXPLODE_END) {
                    p.connection = null
                    p.sprite.visible = false
                } else {
                    p.progress += p.speed
                    if (p.progress >= 1) {
                        p.connection = null
                        p.sprite.visible = false
                    } else {
                        const na = nodes[p.connection.a]
                        const nb = nodes[p.connection.b]
                        if (p.fromA) {
                            p.sprite.position.lerpVectors(na.renderPos, nb.renderPos, p.progress)
                        } else {
                            p.sprite.position.lerpVectors(nb.renderPos, na.renderPos, p.progress)
                        }
                        // Swell mid-flight so pulses fade in and out.
                        p.sprite.scale.setScalar(
                            0.14 * (0.5 + Math.sin(p.progress * Math.PI) * 0.9),
                        )
                    }
                }
            }

            renderer.render(scene, camera)
        }
        animate()

        const resizeObserver = new ResizeObserver(updateViewport)
        resizeObserver.observe(container)

        return () => {
            cancelAnimationFrame(frameId)
            resizeObserver.disconnect()
            window.removeEventListener('pointermove', onPointerMove)
            nodeMesh?.dispose()
            nodeGeom.dispose()
            nodeMat.dispose()
            haloGeom.dispose()
            haloMat.dispose()
            particles.dispose()
            lineGeom.dispose()
            lineMat.dispose()
            pulseMat.dispose()
            glowTex.dispose()
            renderer.dispose()
            container.removeChild(renderer.domElement)
        }
    }, [
        primaryColor,
        accentColor,
        pulseColor,
        glowColor,
        nodeCount,
        particleCount,
        fireInterval,
        connectionDistance,
        mouseFollow,
        interactionRadius,
        originX,
        fitFraction,
        gridDotSize,
        gridGap,
        gridColor,
    ])

    return <div ref={containerRef} className={cn('h-full w-full', className)} />
}
