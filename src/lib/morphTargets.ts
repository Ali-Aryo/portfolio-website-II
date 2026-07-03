import * as THREE from 'three'
import { computeDotGridLayout, type DotGridCell } from './dotGridLayout'

type MorphLayoutOptions = {
    /** Canvas size in pixels. */
    width: number
    height: number
    /** World units per screen pixel at the grid plane (z = 0). */
    worldPerPixel: number
    /** How many network nodes need lattice targets. */
    nodeCount: number
    /** Dot-grid appearance, must match the real DotGrid's props. */
    dotSize: number
    gap: number
    /** World-space x offset of the network group, baked into targets. */
    offsetXWorld: number
}

export type MorphLayout = {
    /** One lattice cell per network node, stride-sampled so the nodes spread
     *  evenly across the screen, ordered center-out. */
    nodeTargets: THREE.Vector3[]
    /** Every remaining lattice cell, ordered center-out. Filler dots
     *  materialize here during the morph so the finished grid is dot-for-dot
     *  identical to the real DotGrid background. */
    fillerTargets: THREE.Vector3[]
}

/**
 * Splits the dot-grid lattice between the morphing network nodes and the
 * filler dots that complete the grid, both in the network group's local
 * space and ordered center-out so the reform grows from the middle.
 */
export function computeMorphLayout(opts: MorphLayoutOptions): MorphLayout {
    const { width, height, worldPerPixel, nodeCount, dotSize, gap, offsetXWorld } = opts
    const layout = computeDotGridLayout(width, height, dotSize, gap)

    const cx = width / 2
    const cy = height / 2
    const cells = [...layout.cells].sort(
        (a, b) =>
            (a.x - cx) ** 2 + (a.y - cy) ** 2 - ((b.x - cx) ** 2 + (b.y - cy) ** 2),
    )

    let stride = Math.max(1, Math.round(Math.sqrt(cells.length / nodeCount)))
    const sample = () => cells.filter((c) => c.col % stride === 0 && c.row % stride === 0)
    let sampled = sample()
    while (sampled.length < nodeCount && stride > 1) {
        stride--
        sampled = sample()
    }

    const chosen = new Set(sampled.slice(0, nodeCount))
    const toWorld = (cell: DotGridCell) =>
        new THREE.Vector3(
            (cell.x - cx) * worldPerPixel - offsetXWorld,
            (cy - cell.y) * worldPerPixel,
            0,
        )

    return {
        nodeTargets: Array.from({ length: nodeCount }, (_, i) =>
            toWorld(sampled[i % sampled.length]),
        ),
        fillerTargets: cells.filter((c) => !chosen.has(c)).map(toWorld),
    }
}
