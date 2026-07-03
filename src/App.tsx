import Hero from './sections/Hero'
import Experience from './sections/Experience'
import HeroMenu from './components/shared/HeroMenu'
import NetworkToDotGrid from './components/transitions/NetworkToDotGrid'

function App() {
  return (
    // NOTE: not display:flex — ScrollTrigger silently disables pin spacing
    // for pinned elements whose parent is a flex container. `relative`
    // anchors the HeroMenu layer.
    <div className="relative min-h-screen w-full">
      <Hero />
      <Experience />
      {/* Menu overlays everything, including the morph overlay — see the
          stacking-context note in HeroMenu. */}
      <HeroMenu />
      {/* Fixed overlay that morphs the hero's neural network into the
          Experience section's dot grid as you scroll between them. */}
      <NetworkToDotGrid />
    </div>
  )
}

export default App
