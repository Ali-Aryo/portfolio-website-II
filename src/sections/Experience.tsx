import DotGrid from '../components/reactbits/DotGrid'
import { DOT_GRID_DEFAULTS } from '../lib/dotGridLayout'

// Placeholder second section ("Experience" for now, name TBD). The DotGrid
// background is what the hero's neural network morphs into on scroll.
export default function Experience() {
    return (
        <section id="experience" className="relative h-screen w-full overflow-hidden bg-[#050505]">
            {/* Background layer. `data-morph-reveal` lets the NetworkToDotGrid
                transition keep it hidden until the morph hands off to it.
                Size/colors come from DOT_GRID_DEFAULTS so the morphed network
                lands exactly on this grid's dots. */}
            <div data-morph-reveal className="absolute inset-0 z-0">
                <DotGrid
                    dotSize={DOT_GRID_DEFAULTS.dotSize}
                    gap={DOT_GRID_DEFAULTS.gap}
                    baseColor={DOT_GRID_DEFAULTS.baseColor}
                    activeColor={DOT_GRID_DEFAULTS.activeColor}
                    /* DotGrid is untyped JS; TS infers its default-less
                       `style` param as required. */
                    style={{}}
                />
            </div>

            <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center">
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
                    Next Section
                </h2>
                <p className="mt-4 max-w-md text-gray-400">
                    Temporary placeholder — experience content coming soon.
                </p>
            </div>
        </section>
    )
}
