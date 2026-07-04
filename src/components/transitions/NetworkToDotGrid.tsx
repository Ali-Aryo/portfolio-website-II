import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import NeuralNetwork, {
    type NeuralNetworkHandle,
} from '../shared/NeuralNetwork'

gsap.registerPlugin(ScrollTrigger)

// Scroll geometry, measured in viewport-heights of scrolling:
//   0 .. EXIT_VH           hero content slides up / background fades, while
//                          the network glides from its resting spot to center
//   EXIT_VH .. MORPH_END_VH  network explodes and reforms into the grid
//   PIN_VH                 the hero unpins here — deliberately BEFORE the
//                          morph ends, so the last dots are still raining in
//                          while the next section starts sliding up (keeps
//                          the settled-grid lull short)
//   .. PIN_VH + 1          section covers the grid; crossfade in the last 5%
// The pin is generous so a normal-speed scroll can't blow past the morph.
const EXIT_VH = 0.3
const PIN_VH = 2  //animation speed
const MORPH_END_VH = 2.4 //make this greater than PIN_VH
const TOTAL_VH = PIN_VH + 1
// Same phases as fractions of the scrub timeline.
const HERO_EXIT = EXIT_VH / TOTAL_VH
const MORPH_END = MORPH_END_VH / TOTAL_VH
/** Resting horizontal center of the network, as a fraction of the viewport. */
const NETWORK_REST_X = 0.65

type NetworkToDotGridProps = {
    /** Selector of the hero section to pin while the morph plays. */
    heroSelector?: string
    /** Selector of the next section's DotGrid wrapper, revealed at handoff. */
    revealSelector?: string
}

/**
 * Scroll transition between the hero and the next section.
 *
 * Renders the NeuralNetwork on a fixed, full-viewport overlay (over the
 * hero's right half at rest). Scrolling pins the hero for one viewport while
 * the network explodes and reforms into a dot grid; the next section then
 * slides in underneath, and at the boundary the overlay crossfades into the
 * section's real, interactive DotGrid — whose lattice the morph targets
 * match exactly.
 *
 * Desktop-only (md+); on mobile the overlay is hidden and the DotGrid is
 * simply visible. Scrubbing back up reverses everything.
 */
export default function NetworkToDotGrid({
    heroSelector = '#hero',
    revealSelector = '[data-morph-reveal]',
}: NetworkToDotGridProps) {
    const overlayRef = useRef<HTMLDivElement>(null)
    const networkRef = useRef<NeuralNetworkHandle>(null)

    useLayoutEffect(() => {
        const overlay = overlayRef.current
        if (!overlay) return

        const mm = gsap.matchMedia()

        mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
            const reveal = document.querySelector<HTMLElement>(revealSelector)
            // The real DotGrid stays hidden until the morphed network hands
            // off to it, so the two grids never show at once.
            if (reveal) gsap.set(reveal, { opacity: 0 })

            // Scrub spans the pinned stretch plus the viewport where the
            // section slides in over the grid. Created before the pin with a
            // higher refreshPriority so its scroll range is measured WITHOUT
            // the pin's spacing — otherwise the range shifts by the pin
            // distance and can never finish. Scrub smoothing is generous so
            // fast scrolling still plays the morph out instead of skipping it.
            const proxy = { p: 0 }
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: heroSelector,
                    start: 'top top',
                    end: `+=${TOTAL_VH * 100}%`,
                    scrub: 1,
                    refreshPriority: 1,
                },
            })
            tl.to(proxy, {
                p: 1,
                ease: 'none',
                duration: 1,
                onUpdate: () => {
                    // While the hero exits, the network glides to center so
                    // the explosion happens center-screen; the morph then
                    // completes at the end of the pin (both setters clamp).
                    networkRef.current?.setShift(proxy.p / HERO_EXIT)
                    networkRef.current?.setMorph(
                        (proxy.p - HERO_EXIT) / (MORPH_END - HERO_EXIT),
                    )
                },
            }, 0)

            // Hero's own layers leave first: content and menu swipe up,
            // the fluid background fades, THEN the network morph begins.
            // Not scoped to the hero: the HeroMenu layer lives at App level
            // (see its stacking-context note) but exits along with the rest.
            const heroExit = gsap.utils.toArray<HTMLElement>('[data-hero-exit]')
            if (heroExit.length) {
                tl.to(heroExit, { yPercent: -120, duration: HERO_EXIT, ease: 'none' }, 0)
            }
            const heroFade = gsap.utils.toArray<HTMLElement>(
                `${heroSelector} [data-hero-fade]`,
            )
            if (heroFade.length) {
                tl.to(heroFade, { opacity: 0, duration: HERO_EXIT, ease: 'none' }, 0)
            }
            // Handoff: overlay fades out as the real DotGrid fades in, right
            // as the next section reaches the top of the viewport.
            tl.to(overlay, { autoAlpha: 0, duration: 0.05, ease: 'none' }, 0.95)
            if (reveal) {
                tl.to(reveal, { opacity: 1, duration: 0.05, ease: 'none' }, 0.95)
            }

            // Pin the hero while the bulk of the morph plays.
            const pin = ScrollTrigger.create({
                trigger: heroSelector,
                start: 'top top',
                end: `+=${PIN_VH * 100}%`,
                pin: true,
                pinSpacing: true,
                anticipatePin: 1,
                refreshPriority: 0,
            })

            return () => {
                pin.kill()
                tl.scrollTrigger?.kill()
                tl.kill()
                networkRef.current?.setMorph(0)
                networkRef.current?.setShift(0)
            }
        })

        // Reduced motion on desktop: no pin, no morph — hide the overlay and
        // leave the real DotGrid visible.
        mm.add('(min-width: 768px) and (prefers-reduced-motion: reduce)', () => {
            gsap.set(overlay, { autoAlpha: 0 })
        })

        return () => mm.revert()
    }, [heroSelector, revealSelector])

    return (
        <div
            ref={overlayRef}
            className="pointer-events-none fixed inset-0 z-30 hidden md:block"
        >
            <NeuralNetwork ref={networkRef} originX={NETWORK_REST_X} fitFraction={0.5} />
        </div>
    )
}
