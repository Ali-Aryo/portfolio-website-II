import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Pointer travel (px) past which a gesture counts as a drag rather than a click. */
const DRAG_THRESHOLD = 5
/** Accumulated horizontal wheel delta (px) that advances one card. */
const WHEEL_STEP = 120
/** Quiet period after a wheel step so trackpad momentum doesn't machine-gun through cards. */
const WHEEL_COOLDOWN_MS = 600
/** Must match the track's CSS `duration-500` — the loop's silent re-centre jump
 *  waits this long so it never fires mid-slide. */
const SLIDE_MS = 500

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max)

type UseCarouselOptions = {
    /** Number of REAL items. The consumer must render the list three times over. */
    count: number
}

/**
 * Index + drag state for an infinitely-looping, centre-snapping carousel.
 *
 * Looping works by rendering three copies of the list (the consumer's job) and
 * keeping the live index inside the middle copy: `index` ranges over [0, 3*count),
 * starts at `count` (first item, middle copy), and whenever a slide settles
 * outside [count, 2*count) the track silently teleports by ±count — the copies
 * are identical, so a jump of exactly count*pitch lands on the same pixels and
 * is invisible. `index % count` is the real item.
 *
 * The track's transform is written straight to the DOM instead of being held in
 * state: a drag fires pointermove ~60x/sec, and routing that through React would
 * re-render every card on every frame. Only the settled `index` is state.
 *
 * Item pitch is measured from the DOM (item 1's offset minus item 0's) so card
 * width and gap stay pure CSS and can change at breakpoints without this hook
 * knowing the numbers. itemW is the pitch (card + gap), cardW the card alone —
 * conflating them centres every card half a gap off.
 *
 * Pointer capture and the dragging state are deferred until the pointer actually
 * travels DRAG_THRESHOLD px. Capturing on pointerdown retargets the eventual
 * `click` to the capturing element, which silently eats clicks on buttons inside
 * the track (this broke the cards' "Learn more").
 */
export function useCarousel({ count }: UseCarouselOptions) {
    const total = count * 3
    const viewportRef = useRef<HTMLDivElement>(null)
    const trackRef = useRef<HTMLDivElement>(null)

    const [index, setIndex] = useState(count)
    const [isDragging, setIsDragging] = useState(false)

    const metricsRef = useRef({ viewportW: 0, itemW: 0, cardW: 0 })
    const startXRef = useRef(0)
    const dragXRef = useRef(0)
    const didDragRef = useRef(false)
    // Mirrors `index` for the pointer/wheel handlers, which read it outside of
    // render. Kept in sync by the slide effect below, not during render.
    const indexRef = useRef(count)
    // True between pointerdown and pointerup; `isDragging` state only flips once
    // the threshold is crossed (it drives cursor style + pointer-events).
    const gestureRef = useRef(false)
    // Set just before a loop re-centre so the slide effect skips the animation.
    const jumpRef = useRef(false)
    const normTimerRef = useRef<number | undefined>(undefined)
    const wheelAccRef = useRef(0)
    const wheelLockRef = useRef(0)

    /** Track offset that centres item `i` in the viewport. */
    const restingX = useCallback((i: number) => {
        const { viewportW, itemW, cardW } = metricsRef.current
        // Item i starts at i * pitch, but the gap trails the card — so the card's
        // own half-width centres it, not the pitch's.
        return viewportW / 2 - (i * itemW + cardW / 2)
    }, [])

    const applyX = useCallback((x: number, animate: boolean) => {
        const track = trackRef.current
        if (!track) return
        // '' restores the transition declared in the track's className.
        track.style.transition = animate ? '' : 'none'
        track.style.transform = `translate3d(${x}px, 0, 0)`
    }, [])

    /** If the settled index has left the middle copy, teleport back by ±count
     *  once the slide has finished. The jump lands on the identical card in the
     *  identical spot, so it's invisible. */
    const scheduleNormalize = useCallback(() => {
        window.clearTimeout(normTimerRef.current)
        const i = indexRef.current
        if (i >= count && i < 2 * count) return
        normTimerRef.current = window.setTimeout(() => {
            // Mid-drag the track isn't at rest; the next settle reschedules.
            if (gestureRef.current) return
            jumpRef.current = true
            setIndex(indexRef.current < count ? indexRef.current + count : indexRef.current - count)
        }, SLIDE_MS + 50)
    }, [count])

    // Measure on mount and on resize (including the breakpoint change that swaps
    // card size). A resize re-centres instantly rather than sliding.
    useLayoutEffect(() => {
        const viewport = viewportRef.current
        const track = trackRef.current
        if (!viewport || !track) return

        const measure = () => {
            const first = track.children[0] as HTMLElement | undefined
            if (!first) return
            const second = track.children[1] as HTMLElement | undefined
            metricsRef.current = {
                viewportW: viewport.clientWidth,
                // Two items give the exact pitch (width + gap) without the gap
                // being hardcoded here in sync with the CSS.
                itemW: second ? second.offsetLeft - first.offsetLeft : first.offsetWidth,
                // offsetWidth ignores transforms, so the active card's scale-up
                // doesn't corrupt this.
                cardW: first.offsetWidth,
            }
            applyX(restingX(indexRef.current), false)
        }

        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(viewport)
        ro.observe(track)
        return () => ro.disconnect()
    }, [applyX, restingX, count])

    // Slide to the settled card whenever the index changes (or teleport, when
    // the change is the loop's re-centre), then queue the next re-centre check.
    useLayoutEffect(() => {
        indexRef.current = index
        applyX(restingX(index), !jumpRef.current)
        jumpRef.current = false
        scheduleNormalize()
    }, [index, applyX, restingX, scheduleNormalize])

    useEffect(() => () => window.clearTimeout(normTimerRef.current), [])

    // Horizontal trackpad/wheel scrolling steps the carousel. Attached manually:
    // wheel listeners must be non-passive to preventDefault (which stops the
    // browser's back/forward swipe), and only horizontal intent is claimed —
    // vertical deltas pass through untouched so page scroll (and the morph's
    // ScrollTrigger) never fight this.
    useEffect(() => {
        const viewport = viewportRef.current
        if (!viewport) return
        const onWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
            e.preventDefault()
            const now = performance.now()
            if (now < wheelLockRef.current) return
            wheelAccRef.current += e.deltaX
            if (Math.abs(wheelAccRef.current) >= WHEEL_STEP) {
                const dir = wheelAccRef.current > 0 ? 1 : -1
                wheelAccRef.current = 0
                wheelLockRef.current = now + WHEEL_COOLDOWN_MS
                setIndex((i) => clamp(i + dir, 0, total - 1))
            }
        }
        viewport.addEventListener('wheel', onWheel, { passive: false })
        return () => viewport.removeEventListener('wheel', onWheel)
    }, [total])

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return
        startXRef.current = e.clientX
        dragXRef.current = 0
        didDragRef.current = false
        gestureRef.current = true
        // No capture and no isDragging yet — a plain click must reach the card
        // untouched. Both start only once the threshold is crossed.
    }, [])

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!gestureRef.current) return
            const dx = e.clientX - startXRef.current
            if (!didDragRef.current) {
                if (Math.abs(dx) <= DRAG_THRESHOLD) return
                didDragRef.current = true
                setIsDragging(true)
                e.currentTarget.setPointerCapture(e.pointerId)
            }
            dragXRef.current = dx
            applyX(restingX(indexRef.current) + dx, false)
        },
        [applyX, restingX],
    )

    const endDrag = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!gestureRef.current) return
            gestureRef.current = false
            if (!didDragRef.current) return // plain click — leave it alone
            setIsDragging(false)
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId)
            }

            const { itemW } = metricsRef.current
            // Snap to whichever card ended up nearest the centre.
            const moved = itemW ? -dragXRef.current / itemW : 0
            const target = clamp(Math.round(indexRef.current + moved), 0, total - 1)
            dragXRef.current = 0

            if (target === indexRef.current) {
                // Index didn't change, so the slide effect won't fire — ease the
                // track back to centre here or it stays stuck at the drag offset,
                // and re-queue the loop re-centre the effect would have queued.
                applyX(restingX(target), true)
                scheduleNormalize()
            } else {
                setIndex(target)
            }
        },
        [applyX, restingX, scheduleNormalize, total],
    )

    const next = useCallback(() => setIndex((i) => clamp(i + 1, 0, total - 1)), [total])
    const prev = useCallback(() => setIndex((i) => clamp(i - 1, 0, total - 1)), [total])

    /** True if the last gesture travelled far enough to be a drag — use it to swallow the click that follows. */
    const wasDragged = useCallback(() => didDragRef.current, [])

    return {
        /** Index into the TRIPLED list; `index % count` is the real item. */
        index,
        isDragging,
        viewportRef,
        trackRef,
        next,
        prev,
        wasDragged,
        dragHandlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
        },
    }
}
