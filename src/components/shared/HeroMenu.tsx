import StaggeredMenu from '../reactbits/StaggeredMenu'

// Menu links. Note StaggeredMenu uses `link` (not `href` like PillNav did).
// `#anchor` values keep this a single-page site that scrolls to each section.
const menuItems = [
    { label: 'Home', link: '#', ariaLabel: 'Go to home' },
    { label: 'About', link: '#about', ariaLabel: 'Go to about' },
    { label: 'Projects', link: '#projects', ariaLabel: 'Go to projects' },
    { label: 'Contact', link: '#contact', ariaLabel: 'Go to contact' },
]

const socialItems = [
    { label: 'GitHub', link: 'https://github.com/Ali-Aryo' },
    { label: 'LinkedIn', link: '#' },
]

/**
 * The hero's menu (logo + staggered panel), rendered at App level rather
 * than inside the hero section. It must live OUTSIDE the hero's subtree:
 * while ScrollTrigger pins the hero it becomes position:fixed, which
 * creates a stacking context that would trap the menu's z-index below the
 * z-30 NetworkToDotGrid overlay — letting the neural network draw over the
 * menu. Out here at z-50 the menu always paints above the network.
 *
 * The layer spans the hero's viewport at the top of the document, and
 * `data-hero-exit` makes it swipe up with the rest of the hero content
 * when the morph transition starts. `overflow-hidden` clips the closed
 * menu panel (translated 100% off the right edge) the same way the hero
 * section used to — without it the page grows a horizontal scrollbar.
 */
export default function HeroMenu() {
    return (
        <div
            data-hero-exit
            className="pointer-events-none absolute inset-x-0 top-0 z-50 h-screen overflow-hidden"
        >
            <StaggeredMenu
                className=""
                position="right"
                /* StaggeredMenu is untyped JS; TS infers its array props as
                   never[] from their empty defaults, so we cast at the boundary. */
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                items={menuItems as any}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                socialItems={socialItems as any}
                displaySocials={true}
                displayItemNumbering={true}
                colors={['#B497CF', '#5227FF']}
                accentColor="#5227FF"
                logoUrl="/favicon.svg"
                menuButtonColor="#E9DDFF"
                openMenuButtonColor="#E9DDFF"
                changeMenuColorOnOpen={true}
                closeOnClickAway={true}
                onMenuOpen={() => { }}
                onMenuClose={() => { }}
            />
        </div>
    )
}
