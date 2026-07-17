import { ArrowLeft, ArrowRight } from 'lucide-react'
import CardFlip from '@/components/kokonutui/card-flip'
import { useCarousel } from '@/hooks/useCarousel'
import { cn } from '@/lib/utils'

export type CarouselItem = {
    title: string
    subtitle: string
    description: string
    features: string[]
    image?: string
    imageAlt?: string
}

type ProjectCarouselProps = {
    projects: CarouselItem[]
    /** Receives the REAL project index (0..projects.length-1). */
    onLearnMore?: (index: number) => void
}

/**
 * Full-bleed, centre-snapping, infinitely-looping carousel of CardFlips.
 * Advance by arrow button, ArrowLeft/Right keys, drag/swipe, or horizontal
 * trackpad scroll. The centred card sits at full size; neighbours shrink back
 * slightly but stay fully opaque.
 *
 * The list renders three times over so there is always a card on both sides —
 * item 0 shows the last project to its left. useCarousel keeps the live index
 * inside the middle copy by teleporting ±count after each settle (invisible:
 * the copies are pixel-identical). `index % projects.length` is the real item.
 *
 * The scroll-in entrance (CardReveal) was removed for now at Ali's request —
 * the wrapper used to sit between the track and each card; re-add it there if
 * it comes back.
 */
export default function ProjectCarousel({ projects, onLearnMore }: ProjectCarouselProps) {
    const {
        index,
        isDragging,
        viewportRef,
        trackRef,
        next,
        prev,
        wasDragged,
        dragHandlers,
    } = useCarousel({ count: projects.length })

    // Three identical copies; keys carry the copy number.
    const loop = [...projects, ...projects, ...projects]

    return (
        <div
            className="relative w-full"
            role="region"
            aria-roledescription="carousel"
            aria-label="Projects"
        >
            {/* Clips the strip at the screen edges so cards bleed off both sides.
                overflow-x-clip, NOT overflow-x-hidden: `hidden` on one axis forces
                the other to `auto`, which would turn the strip into a scroll
                container. `clip` leaves overflow-y visible. */}
            <div
                ref={viewportRef}
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') {
                        e.preventDefault()
                        next()
                    } else if (e.key === 'ArrowLeft') {
                        e.preventDefault()
                        prev()
                    }
                }}
                {...dragHandlers}
                className={cn(
                    'overflow-x-clip py-12 outline-none',
                    'focus-visible:ring-2 focus-visible:ring-purple-500/60',
                    isDragging ? 'cursor-grabbing' : 'cursor-grab',
                )}
            >
                <div
                    ref={trackRef}
                    className={cn(
                        'flex w-max gap-6 will-change-transform md:gap-8',
                        'transition-transform duration-500 ease-out motion-reduce:transition-none',
                        // While dragging, stop cards from taking the pointer —
                        // otherwise they hover-flip as they slide under the cursor.
                        isDragging && 'pointer-events-none',
                    )}
                >
                    {loop.map((project, i) => (
                        <div
                            key={`${Math.floor(i / projects.length)}-${project.title}`}
                            className={cn(
                                'transition-transform duration-500 ease-out motion-reduce:transition-none',
                                i === index ? 'scale-100' : 'scale-[0.88]',
                            )}
                        >
                            <CardFlip
                                {...project}
                                onLearnMore={() => {
                                    // A drag that ends on the button shouldn't open the modal.
                                    if (!wasDragged()) onLearnMore?.(i % projects.length)
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <CarouselArrow side="left" onClick={prev} />
            <CarouselArrow side="right" onClick={next} />
        </div>
    )
}

function CarouselArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
    const Icon = side === 'left' ? ArrowLeft : ArrowRight

    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={side === 'left' ? 'Previous project' : 'Next project'}
            className={cn(
                'absolute top-1/2 z-20 -translate-y-1/2',
                side === 'left' ? 'left-4 md:left-8' : 'right-4 md:right-8',
                'grid h-12 w-12 place-items-center rounded-full',
                'border border-purple-900/40 bg-zinc-900/60 backdrop-blur-sm',
                'transition-all duration-300',
                'hover:border-purple-500/50 hover:bg-zinc-900/90 hover:scale-105',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
            )}
        >
            <Icon className="h-5 w-5 text-purple-300" />
        </button>
    )
}
