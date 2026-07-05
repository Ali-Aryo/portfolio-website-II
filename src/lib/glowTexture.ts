import * as THREE from 'three'

/**
 * Soft radial-gradient sprite shared by node halos, ambient particles, and
 * data pulses. Additive-blended, it reads as bloom without post-processing.
 */
export function createGlowTexture(size = 128): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const half = size / 2
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.22, 'rgba(255,255,255,0.6)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.18)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    return new THREE.CanvasTexture(canvas)
}
