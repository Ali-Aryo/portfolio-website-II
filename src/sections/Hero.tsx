import LiquidEther from '../components/reactbits/LiquidEther'
import RotatingText from '../components/reactbits/RotatingText'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RotatingTextComponent = RotatingText as any

export default function Hero() {
    return (
        // `relative` makes this the anchor for the absolute layers inside it.
        // `h-screen` gives it a real height (100vh) so LiquidEther has space to fill.
        // `id` is the ScrollTrigger anchor for the NetworkToDotGrid transition.
        <section id="hero" className="relative h-screen w-full overflow-hidden">
            {/* Background layer: absolutely fills the section, sits behind content.
                `data-hero-fade`: NetworkToDotGrid fades it out as the morph begins. */}
            <div data-hero-fade className="absolute inset-0 z-0">
                <LiquidEther
                    colors={['#5227FF', '#FF9FFC', '#B497CF']}
                    mouseForce={25}
                    cursorSize={100}
                    autoDemo={true}
                />
            </div>

            {/* The menu lives in HeroMenu at App level (not here): the pinned
                hero becomes a stacking context, which would trap it under the
                neural-network overlay. */}

            {/* Content layer: z-10 lifts it above the background. Left column
                on md+ — the NetworkToDotGrid overlay (rendered in App) shows
                the neural network over the right half. `data-hero-exit`:
                slides up and out before the morph starts. */}
            <div data-hero-exit className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center md:w-1/2 md:items-start md:px-16 md:text-left">
                <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
                    <span className="block opacity-90">Hi, I'm Ali</span>
                </h1>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xl font-medium text-purple-200 sm:text-2xl md:justify-start md:text-3xl">
                    <span>I build</span>
                    <RotatingTextComponent
                        texts={['Full-Stack Apps', 'AI Tools', 'Infrastructure', 'Embedded-Systems']}
                        mainClassName="px-2.5 py-0.5 bg-purple-950/40 text-purple-300 border border-purple-800/40 rounded-lg inline-flex overflow-hidden"
                        staggerFrom="last"
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "-120%", opacity: 0 }}
                        staggerDuration={0.025}
                        splitLevelClassName="overflow-hidden"
                        transition={{ type: "spring", damping: 30, stiffness: 400 }}
                        rotationInterval={2000}
                    />
                </div>

                {/* <p className="mx-auto mt-6 max-w-xl text-base text-gray-400 sm:text-lg md:text-xl">
                    Crafting premium, high-performance web applications and digital systems.
                </p>
                <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
                    <a href="#projects" className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-purple-500/20 transition-all duration-300 hover:bg-purple-500 hover:shadow-purple-500/30 active:scale-95">
                        View Projects
                    </a>
                    <a href="#contact" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-6 py-3 text-base font-semibold text-white transition-all duration-300 hover:bg-white/10 hover:border-white/20 active:scale-95"
                    >
                        Get in Touch
                    </a>
                </div> */}
            </div>
        </section>
    )
}
