import { useState } from 'react'
import DotGrid from '../components/reactbits/DotGrid'
import RotatingText from '../components/reactbits/RotatingText'
import ProjectCarousel, { type CarouselItem } from '../components/shared/ProjectCarousel'
import ProjectModal from '../components/shared/ProjectModal'
import { DOT_GRID_DEFAULTS } from '../lib/dotGridLayout'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RotatingTextComponent = RotatingText as any

// Placeholder projects — real content lands later. Titled "Temp N" so the
// carousel shows distinct cards; the descriptions/features cycle three stubs so
// the flipped backs aren't identical either. Add a screenshot by dropping it in
// src/assets/, importing it, and passing `image`/`imageAlt` — the pulse-ring
// placeholder swaps itself out for the <img> automatically.
const PROJECTS: CarouselItem[] = [
    {
        title: 'Temp 1',
        subtitle: 'Hover to flip',
        description: 'An end-to-end web application, from database schema to a polished, responsive UI.',
        features: ['React & TypeScript', 'Node & REST APIs', 'PostgreSQL', 'CI/CD'],
    },
    {
        title: 'Temp 2',
        subtitle: 'Hover to flip',
        description: 'Practical tools and automations built on top of modern large language models.',
        features: ['LLM Integration', 'Prompt Engineering', 'Python', 'Automation'],
    },
    {
        title: 'Temp 3',
        subtitle: 'Hover to flip',
        description: 'Low-level and infrastructure work that keeps everything running reliably.',
        features: ['Embedded C', 'Linux', 'Docker', 'Networking'],
    },
    {
        title: 'Temp 4',
        subtitle: 'Hover to flip',
        description: 'An end-to-end web application, from database schema to a polished, responsive UI.',
        features: ['React & TypeScript', 'Node & REST APIs', 'PostgreSQL', 'CI/CD'],
    },
    {
        title: 'Temp 5',
        subtitle: 'Hover to flip',
        description: 'Practical tools and automations built on top of modern large language models.',
        features: ['LLM Integration', 'Prompt Engineering', 'Python', 'Automation'],
    },
    {
        title: 'Temp 6',
        subtitle: 'Hover to flip',
        description: 'Low-level and infrastructure work that keeps everything running reliably.',
        features: ['Embedded C', 'Linux', 'Docker', 'Networking'],
    },
    {
        title: 'Temp 7',
        subtitle: 'Hover to flip',
        description: 'An end-to-end web application, from database schema to a polished, responsive UI.',
        features: ['React & TypeScript', 'Node & REST APIs', 'PostgreSQL', 'CI/CD'],
    },
]

export default function Projects() {
    const [activeProject, setActiveProject] = useState<number | null>(null)

    return (
        <section id="projects" className="relative w-full">
            {/* Stationary dot-grid backdrop for the whole section.
                - position: fixed  -> the dots stay put while content scrolls.
                - viewport-sized   -> still the morph's exact hand-off target,
                  so the network's final dot positions line up with this grid.
                - data-morph-reveal -> NetworkToDotGrid keeps it hidden
                  (opacity 0) until the morph hands off, then it stays visible.
                - kept OUTSIDE #projects-cover so the pin never repositions it,
                  and pointer-events-none so it never intercepts clicks (the
                  DotGrid tracks the cursor via window listeners regardless). */}
            <div
                data-morph-reveal
                className="pointer-events-none fixed inset-0 z-0 bg-[#050505]"
            >
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

            {/* Morph landing: the network reforms into the stationary dot
                field here — a clean full viewport of dots. The section header
                + carousel scroll in below it, kept off-screen so they can
                animate in on scroll. */}
            <div id="projects-cover" className="h-screen w-full" />

            {/* Header + carousel. The header stays in a centred column; the
                carousel runs full-bleed underneath it so cards bleed off both
                screen edges.
                -mt-[50vh]: pulls the block up over the cover's lower half so it
                starts rising into view right as the morph's crossfade begins,
                instead of a full empty viewport of dots later. The cover itself
                must stay 100vh (it's the morph's pin target) — tighten or widen
                the gap by tuning this margin only. */}
            <div className="relative z-10 -mt-[50vh] pb-32">
                <div className="mx-auto max-w-2xl px-4 text-center">
                    <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
                        Projects
                    </h2>
                    {/* The "I build ..." rotating line, moved here from the Hero
                        when it went LUSION-style (name-only). */}
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-lg font-medium text-purple-200 sm:text-xl md:text-2xl">
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
                </div>

                <div className="mt-6">
                    <ProjectCarousel projects={PROJECTS} onLearnMore={setActiveProject} />
                </div>
            </div>

            <ProjectModal
                open={activeProject !== null}
                title={activeProject !== null ? PROJECTS[activeProject].title : undefined}
                onClose={() => setActiveProject(null)}
            >
                {activeProject !== null && (
                    <div className="w-full max-w-xl space-y-8 text-left">
                        <p className="text-base leading-relaxed text-zinc-300">
                            {PROJECTS[activeProject].description}
                        </p>
                        <div>
                            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-purple-400">
                                Tech stack
                            </h4>
                            <ul className="flex flex-wrap gap-2">
                                {PROJECTS[activeProject].features.map((feature) => (
                                    <li
                                        key={feature}
                                        className="rounded-full border border-purple-900/40 bg-zinc-900 px-3 py-1 text-sm text-zinc-300"
                                    >
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {/* Real screenshots, repo/demo links etc. land here. */}
                        <p className="text-sm text-zinc-600">
                            Screenshots and links coming soon.
                        </p>
                    </div>
                )}
            </ProjectModal>
        </section>
    )
}
