// Lattice math for the neural-network morph targets. This mirrors the
// buildGrid() layout of the vendored ReactBits DotGrid
// (src/components/reactbits/DotGrid.jsx), so the morphing 3D nodes land
// exactly on that grid's dots — if its layout math ever changes, update
// this to match. DOT_GRID_DEFAULTS feeds both the DotGrid props in
// Experience and the morph's grid appearance.

export const DOT_GRID_DEFAULTS = {
    dotSize: 5,
    gap: 30,
    baseColor: '#3d2f66',
    activeColor: '#a855f7',
} as const

export type DotGridCell = { x: number; y: number; col: number; row: number }

export type DotGridLayout = {
    cols: number
    rows: number
    cell: number
    cells: DotGridCell[]
}

/** Centered lattice of dot centers for a width x height area, in pixels. */
export function computeDotGridLayout(
    width: number,
    height: number,
    dotSize: number,
    gap: number,
): DotGridLayout {
    const cell = dotSize + gap
    const cols = Math.max(1, Math.floor((width + gap) / cell))
    const rows = Math.max(1, Math.floor((height + gap) / cell))
    const startX = (width - (cell * cols - gap)) / 2 + dotSize / 2
    const startY = (height - (cell * rows - gap)) / 2 + dotSize / 2

    const cells: DotGridCell[] = []
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            cells.push({ x: startX + col * cell, y: startY + row * cell, col, row })
        }
    }
    return { cols, rows, cell, cells }
}
