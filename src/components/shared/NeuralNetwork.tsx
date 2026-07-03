import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { DOT_GRID_DEFAULTS } from '@/lib/dotGridLayout'
import { computeMorphLayout } from '@/lib/morphTargets'

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
    stagger: number
    /** Starting z (toward the camera) it settles in from. */
    zFrom: number
}

type Connection = { a: number; b: number }

type Pulse = {
    mesh: THREE.Mesh
    connection: Connection | null
    progress: number
    speed: number
}

const NODE_RADIUS = 0.04
/** World diameter the camera must keep in frame (cloud + drift + pull). */
const NETWORK_DIAMETER = 8.2
/** Morph phase boundaries: explode finishes at 0.3, reform fills 0.3..1. */
const EXPLODE_END = 0.3

const smoothstep = (t: number) => {
    const x = Math.min(1, Math.max(0, t))
    return x * x * (3 - 2 * x)
}

/**
 * A sci-fi neural network: drifting nodes on a spherical cloud, linked by
 * glowing connections that carry data pulses. The whole network tilts toward
 * the cursor, and nodes near the cursor brighten, swell, and get gently
 * attracted while their connections light up.
 *
 * Via the `setMorph` ref handle the network can explode apart and reform as
 * a flat dot grid. The nodes land on a spread subset of the lattice while
 * filler dots materialize on every remaining cell, so at morph = 1 the
 * result is dot-for-dot identical to the DotGrid component.
 *
 * Renders on a transparent canvas that fills its parent, so the parent must
 * have a real height.
 */
export default function NeuralNetwork({
    primaryColor = '#7c3aed',
    accentColor = '#00f2ff',
    pulseColor = '#ffffff',
    glowColor = '#ffffff',
    nodeCount = 120,
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

        // --- Nodes: positions on a jittered fibonacci sphere so the cloud
        // reads as organic rather than gridded.
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
                baseColor: Math.random() > 0.8 ? accent : primary,
                glow: 0,
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

        // --- Instanced mesh holding the nodes AND the morph filler dots.
        // Capacity depends on how many lattice cells the viewport has, so it
        // is (re)allocated from updateViewport.
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
            // Center-out stagger (targets are pre-sorted) with jitter, so the
            // grid materializes outward from the middle, like the nodes.
            const lastIdx = Math.max(1, layout.fillerTargets.length - 1)
            fillers = layout.fillerTargets.map((target, i) => ({
                target,
                stagger: (i / lastIdx) * 0.75 + Math.random() * 0.25,
                zFrom: 0.5 + Math.random() * 1.5,
            }))

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
        // single LineSegments buffer; per-vertex colors let edges light up
        // near the cursor without extra draw calls.
        const pairs: Connection[] = []
        for (let i = 0; i < nodeCount; i++) {
            for (let j = i + 1; j < nodeCount; j++) {
                const dist = nodes[i].position.distanceTo(nodes[j].position)
                if (dist < connectionDistance) pairs.push({ a: i, b: j })
            }
        }

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

        // --- Data pulses: a small pool of glowing dots that pick a random
        // connection, travel along it, then go dormant until respawned.
        const pulseGeom = new THREE.SphereGeometry(0.05, 8, 8)
        const pulseMat = new THREE.MeshBasicMaterial({
            color: pulseColor,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        })
        const pulses: Pulse[] = []
        for (let i = 0; i < 25; i++) {
            const mesh = new THREE.Mesh(pulseGeom, pulseMat)
            mesh.visible = false
            group.add(mesh)
            pulses.push({
                mesh,
                connection: null,
                progress: 0,
                speed: 0.02 + Math.random() * 0.04,
            })
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

        let frameId = 0
        const animate = () => {
            frameId = requestAnimationFrame(animate)
            const mesh = nodeMesh!

            const m = morphRef.current
            const live = 1 - m
            const rotationKill = smoothstep((m - EXPLODE_END) / 0.5)

            if (!prefersReducedMotion) {
                rotY += (tiltX * mouseFollow - rotY) * 0.05
                rotX += (tiltY * mouseFollow - rotX) * 0.05
            }
            rotZ += 0.001 * live
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

                // Swell a touch while exploding, settle at grid-dot size.
                const liveScale =
                    (1 + node.glow * 1.8) * (1 + explodeEase * 0.5 * (1 - reformT))
                const s = liveScale + (gridScale - liveScale) * reformT
                tmpMat.makeScale(s, s, s).setPosition(node.renderPos)
                mesh.setMatrixAt(i, tmpMat)

                // Spark bright while exploding, then adopt the grid color.
                tmpColor
                    .copy(node.baseColor)
                    .lerp(glowCol, node.glow * 0.9 + explodeEase * (1 - reformT) * 0.4)
                    .lerp(gridCol, reformT)
                mesh.setColorAt(i, tmpColor)
            }

            // Filler dots materialize on the remaining lattice cells during
            // the reform, completing the grid. One extra pass zeroes them
            // when the morph snaps back to 0.
            const fillersActive = m > 0
            if (fillersActive || fillersWereActive) {
                for (let i = 0; i < fillers.length; i++) {
                    const f = fillers[i]
                    const t = smoothstep((m - EXPLODE_END - f.stagger * 0.2) / 0.5)
                    const s = gridScale * t
                    tmpMat.makeScale(s, s, s)
                    tmpMat.setPosition(f.target.x, f.target.y, f.zFrom * (1 - t))
                    mesh.setMatrixAt(nodeCount + i, tmpMat)
                }
            }
            fillersWereActive = fillersActive

            mesh.instanceMatrix.needsUpdate = true
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

            // Connections fade out early in the morph; skip the buffer writes
            // entirely once they are invisible.
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

                    tmpColor.copy(na.baseColor).multiplyScalar(0.22 + na.glow * 0.78)
                    lineColors[o] = tmpColor.r
                    lineColors[o + 1] = tmpColor.g
                    lineColors[o + 2] = tmpColor.b
                    tmpColor.copy(nb.baseColor).multiplyScalar(0.22 + nb.glow * 0.78)
                    lineColors[o + 3] = tmpColor.r
                    lineColors[o + 4] = tmpColor.g
                    lineColors[o + 5] = tmpColor.b
                }
                lineGeom.attributes.position.needsUpdate = true
                lineGeom.attributes.color.needsUpdate = true
            }

            for (const p of pulses) {
                if (!p.connection) {
                    if (!prefersReducedMotion && m < 0.05 && Math.random() < 0.04) {
                        p.connection = pairs[Math.floor(Math.random() * pairs.length)]
                        p.progress = 0
                        p.mesh.visible = true
                    }
                } else if (m > EXPLODE_END) {
                    p.connection = null
                    p.mesh.visible = false
                } else {
                    p.progress += p.speed
                    if (p.progress >= 1) {
                        p.connection = null
                        p.mesh.visible = false
                    } else {
                        const na = nodes[p.connection.a]
                        const nb = nodes[p.connection.b]
                        p.mesh.position.lerpVectors(na.renderPos, nb.renderPos, p.progress)
                        // Swell mid-flight so pulses fade in and out.
                        p.mesh.scale.setScalar(0.6 + Math.sin(p.progress * Math.PI) * 0.8)
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
            lineGeom.dispose()
            lineMat.dispose()
            pulseGeom.dispose()
            pulseMat.dispose()
            renderer.dispose()
            container.removeChild(renderer.domElement)
        }
    }, [
        primaryColor,
        accentColor,
        pulseColor,
        glowColor,
        nodeCount,
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
