import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import NeuralNetwork, {
    type NeuralNetworkHandle,
} from '../shared/NeuralNetwork'

gsap.registerPlugin(ScrollTrigger)

// Scroll geometry, measured in viewport-heights of scrolling:
//   0 .. EXIT_VH             hero content slides up / background fades, while
//                            the network glides from its resting spot to center
//   EXIT_VH .. MORPH_END_VH  network explodes and reforms into the grid
//   PIN_VH                   the hero unpins here (must be <= MORPH_END_VH):
//                            the next section scrolls up and immediately
//                            pins in turn, so the last dots keep raining in
//                            over it without it scrolling away
//   MORPH_END_VH .. +SETTLE_VH   grid sits fully formed and motionless, so
//                            the handoff never catches a dot mid-flight
//   +REVEAL_VH               crossfade into the real DotGrid; the next
//                            section then unpins and normal scrolling resumes
// TOTAL_VH is derived from MORPH_END_VH (not just PIN_VH) specifically so
// retuning PIN_VH/MORPH_END_VH can't silently push the morph's end past the
// scrollable range. The next section is pinned for exactly the remaining
// tail (NEXT_SECTION_PIN_VH) so that range always physically exists — a
// hero-only pin would leave the scrub with nowhere to scroll TO, and it
// would asymptote short of 100% with the crossfade never firing at all.
const EXIT_VH = 0.3
const PIN_VH = 8  //animation speed
const MORPH_END_VH = 8.5//make this greater than PIN_VH
/** Extra scroll, after the last dot lands, before the crossfade starts —
 *  gives the grid a beat fully at rest. Raise this if it still feels early. */
const SETTLE_VH = 1
/** Scroll-heights for the crossfade itself plus the section finishing its
 *  scroll into view afterward. */
const REVEAL_VH = 1
const TOTAL_VH = MORPH_END_VH + SETTLE_VH + REVEAL_VH
// Same phases as fractions of the scrub timeline.
const HERO_EXIT = EXIT_VH / TOTAL_VH
const MORPH_END = MORPH_END_VH / TOTAL_VH
/** Crossfade start: once the grid has already been fully settled for
 *  SETTLE_VH, not a fixed fraction of the scrub. */
const HANDOFF_START = (MORPH_END_VH + SETTLE_VH) / TOTAL_VH
const HANDOFF_DURATION = REVEAL_VH / TOTAL_VH
/** How long the NEXT section must stay pinned, after it reaches the top,
 *  for the scrub above to have enough real scroll room to ever finish. */
const NEXT_SECTION_PIN_VH = TOTAL_VH - PIN_VH
/** Resting horizontal center of the network, as a fraction of the viewport. */
const NETWORK_REST_X = 0.65

type NetworkToDotGridProps = {
    /** Selector of the hero section to pin while the morph plays. */
    heroSelector?: string
    /** Selector of the next section's DotGrid wrapper, revealed at handoff. */
    revealSelector?: string
    /** Selector of the whole next section. Pinned for the scrub's tail so
     *  there's always enough real scroll room for it to reach 100%, and so
     *  the section can't scroll out of view before the handoff reveals it. */
    nextSectionSelector?: string
}

/**
 * Scroll transition between the hero and the next section.
 *
 * Renders the NeuralNetwork on a fixed, full-viewport overlay (over the
 * hero's right half at rest). Scrolling pins the hero while the network
 * explodes and reforms into a dot grid; once the grid has sat fully
 * settled for a beat, the overlay crossfades into the next section's real,
 * interactive DotGrid — whose lattice the morph targets match exactly.
 *
 * Desktop-only (md+); on mobile the overlay is hidden and the DotGrid is
 * simply visible. Scrubbing back up reverses everything.
 */
export default function NetworkToDotGrid({
    heroSelector = '#hero',
    revealSelector = '[data-morph-reveal]',
    nextSectionSelector = '#experience',
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
            // Handoff: overlay fades out as the real DotGrid fades in, once
            // the grid has been fully settled for SETTLE_VH — not a fixed
            // fraction of the scrub, so retuning the morph timing above
            // can't make this fire early again.
            tl.to(
                overlay,
                { autoAlpha: 0, duration: HANDOFF_DURATION, ease: 'none' },
                HANDOFF_START,
            )
            if (reveal) {
                tl.to(
                    reveal,
                    { opacity: 1, duration: HANDOFF_DURATION, ease: 'none' },
                    HANDOFF_START,
                )
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

            // Then pin the next section for the scrub's remaining tail.
            // Without this, the scrub's end (TOTAL_VH, driven by
            // MORPH_END_VH/SETTLE_VH/REVEAL_VH above) can easily exceed the
            // page's actual scrollable height — the timeline would asymptote
            // short of 100% and the crossfade would never fire at all. This
            // both guarantees enough real scroll room exists AND keeps the
            // section on screen (rather than scrolled away) when the
            // handoff reveals it.
            const nextSection = document.querySelector<HTMLElement>(nextSectionSelector)
            const nextSectionPin =
                nextSection && NEXT_SECTION_PIN_VH > 0
                    ? ScrollTrigger.create({
                        trigger: nextSection,
                        start: 'top top',
                        end: `+=${NEXT_SECTION_PIN_VH * 100}%`,
                        pin: true,
                        pinSpacing: true,
                        anticipatePin: 1,
                        refreshPriority: 0,
                    })
                    : null

            return () => {
                pin.kill()
                nextSectionPin?.kill()
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
    }, [heroSelector, revealSelector, nextSectionSelector])

    return (
        <div
            ref={overlayRef}
            className="pointer-events-none fixed inset-0 z-30 hidden md:block"
        >
            <NeuralNetwork ref={networkRef} originX={NETWORK_REST_X} fitFraction={0.4} />
        </div>
    )
}
