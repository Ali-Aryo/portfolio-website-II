import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

type CardRevealProps = {
    children: React.ReactNode
    /** Position in the strip; adds a small stagger so the cards don't move in lockstep. */
    index?: number
    className?: string
}

/**
 * Scroll-linked entrance for a single card. As the card scrolls up into view
 * it rises, un-tilts (rotateX), scales and fades in; scrubbing back up reverses
 * it — so the cards animate in on the way down and out on the way up rather than
 * doing a one-shot fade. Purely a wrapper transform, so it composes cleanly with
 * the CardFlip's own 3D flip inside.
 *
 * Gated on prefers-reduced-motion: reduced-motion users just see the cards.
 */
export default function CardReveal({ children, index = 0, className = '' }: CardRevealProps) {
    const ref = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return

        const mm = gsap.matchMedia()
        mm.add('(prefers-reduced-motion: no-preference)', () => {
            // Every card in the carousel sits at the same vertical position, so
            // without this they'd all trigger on the same scroll pixel. Shifting
            // each one's trigger point a little further down the viewport makes
            // them cascade left-to-right; capped so the tail doesn't reveal so
            // late that it's still animating after the strip is fully in view.
            const offset = Math.min(index, 4) * 4

            const tween = gsap.fromTo(
                el,
                {
                    autoAlpha: 0,
                    y: 120,
                    rotateX: 45,
                    scale: 0.85,
                    transformPerspective: 900,
                    transformOrigin: '50% 100%',
                },
                {
                    autoAlpha: 1,
                    y: 0,
                    rotateX: 0,
                    scale: 1,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: el,
                        start: `top ${88 - offset}%`,
                        end: `top ${48 - offset}%`,
                        scrub: 1,
                    },
                },
            )

            return () => {
                tween.scrollTrigger?.kill()
                tween.kill()
            }
        })

        return () => mm.revert()
    }, [index])

    return (
        <div ref={ref} className={className} style={{ willChange: 'transform, opacity' }}>
            {children}
        </div>
    )
}
