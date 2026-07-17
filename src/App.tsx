import Hero from './sections/Hero'
import Projects from './sections/Projects'
import HeroMenu from './components/shared/HeroMenu'
import NetworkToDotGrid from './components/transitions/NetworkToDotGrid'

function App() {
  return (
    // NOTE: not display:flex — ScrollTrigger silently disables pin spacing
    // for pinned elements whose parent is a flex container. `relative`
    // anchors the HeroMenu layer.
    <div className="relative min-h-screen w-full">
      <Hero />
      <Projects />
      {/* Menu overlays everything, including the morph overlay — see the
          stacking-context note in HeroMenu. */}
      <HeroMenu />
      {/* Fixed overlay that morphs the hero's neural network into the
          Projects section cover's dot grid as you scroll between them.
          Pins #projects-cover (a 100vh box) so the morph lattice still
          aligns while the cards below it scroll normally. */}
      <NetworkToDotGrid nextSectionSelector="#projects-cover" />
    </div>
  )
}

export default App
