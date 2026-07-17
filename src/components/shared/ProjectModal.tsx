import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export interface ProjectModalProps {
    /** Whether the modal is visible. When false, nothing is rendered. */
    open: boolean
    /** Project name, shown in the header. */
    title?: string
    /** Close handler (backdrop click, Escape, or the ✕ button). */
    onClose: () => void
    /** Future content — screenshots, links, details. Empty for now. */
    children?: React.ReactNode
}

/**
 * Full-screen project details modal.
 *
 * Rendered through a portal to document.body so it escapes the pinned
 * Projects section's stacking context / overflow (same reason HeroMenu lives
 * at App level). While open it locks page scroll, so the user can't scroll
 * behind it until it's closed.
 */
export default function ProjectModal({ open, title, onClose, children }: ProjectModalProps) {
    const closeRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (!open) return

        // Lock page scroll while the modal is open; restore on close.
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        // Remember focus so we can return it when the modal closes.
        const prevFocus = document.activeElement as HTMLElement | null

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)

        // Move focus into the dialog for keyboard/screen-reader users.
        closeRef.current?.focus()

        return () => {
            document.body.style.overflow = prevOverflow
            window.removeEventListener('keydown', onKey)
            prevFocus?.focus?.()
        }
    }, [open, onClose])

    if (!open) return null

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-label={title ? `${title} details` : 'Project details'}
        >
            {/* Backdrop — click to close */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm motion-safe:animate-[fade-in_200ms_ease-out]"
                onClick={onClose}
            />

            {/* Panel — takes up most of the viewport */}
            <div className="relative z-10 flex h-[85vh] w-[90vw] max-w-5xl flex-col overflow-hidden rounded-2xl border border-purple-900/40 bg-zinc-950 shadow-2xl shadow-purple-500/10 motion-safe:animate-[modal-in_220ms_ease-out]">
                <div className="flex shrink-0 items-center justify-between border-b border-purple-900/40 px-6 py-4">
                    <h3 className="text-lg font-semibold text-white">{title ?? 'Project'}</h3>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body — empty placeholder for now (screenshots/links/details later) */}
                <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-zinc-600">
                    {children ?? 'Screenshots, links and details will live here.'}
                </div>
            </div>
        </div>,
        document.body,
    )
}
