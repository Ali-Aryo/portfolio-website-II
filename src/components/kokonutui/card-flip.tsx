"use client";

/**
 * @author: @dorianbaffier
 * @description: Card Flip
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Adapted for portfolio-website-II:
 *  - Recolored orange -> purple, collapsed light/dark zinc to dark-only
 *    (the site forces a black background regardless of OS color scheme).
 *  - Tall portrait card sized for ProjectCarousel, with a framed thumbnail on
 *    the front: an `image` if provided, otherwise the purple pulse-ring
 *    animation as a placeholder (keyframes `card-pulse` live in src/index.css).
 *  - Back CTA relabeled "Learn more" and wired to `onLearnMore` so the
 *    parent can open a details modal.
 */

import { ArrowRight, Repeat2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface CardFlipProps {
  title?: string;
  subtitle?: string;
  description?: string;
  features?: string[];
  /** Optional front-face thumbnail. Falls back to the pulse-ring placeholder. */
  image?: string;
  imageAlt?: string;
  /** Called when the back-face "Learn more" button is clicked. */
  onLearnMore?: () => void;
  /** Merged onto the root — lets a parent override the default card footprint. */
  className?: string;
}

export default function CardFlip({
  title = "Design Systems",
  subtitle = "Explore the fundamentals",
  description = "Dive deep into the world of modern UI/UX design.",
  features = ["UI/UX", "Modern Design", "Tailwind CSS", "Kokonut UI"],
  image,
  imageAlt,
  onLearnMore,
  className,
}: CardFlipProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className={cn(
        "group relative h-[460px] w-[300px] [perspective:2000px] md:h-[600px] md:w-[400px]",
        className
      )}
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
    >
      <div
        className={cn(
          "relative h-full w-full",
          "[transform-style:preserve-3d]",
          "transition-all duration-700",
          isFlipped
            ? "[transform:rotateY(180deg)]"
            : "[transform:rotateY(0deg)]"
        )}
      >
        {/* Front of card: framed thumbnail + title/subtitle */}
        <div
          className={cn(
            "absolute inset-0 h-full w-full",
            "[backface-visibility:hidden] [transform:rotateY(0deg)]",
            "overflow-hidden rounded-2xl",
            "bg-zinc-900",
            "border border-purple-900/40",
            "shadow-lg",
            "flex flex-col p-3",
            "transition-all duration-700",
            "group-hover:shadow-xl group-hover:shadow-purple-500/10",
            isFlipped ? "opacity-0" : "opacity-100"
          )}
        >
          {/* Thumbnail frame — fills the available height above the text */}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-gradient-to-b from-zinc-900 to-black">
            {image ? (
              <img
                src={image}
                alt={imageAlt ?? title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="relative flex h-[100px] w-[200px] items-center justify-center">
                  {[...Array(10)].map((_, i) => (
                    <div
                      className={cn(
                        "absolute h-[50px] w-[50px]",
                        "rounded-[140px]",
                        "animate-[card-pulse_3s_linear_infinite]",
                        "opacity-0",
                        "shadow-[0_0_50px_rgba(168,85,247,0.5)]",
                        "group-hover:animate-[card-pulse_2s_linear_infinite]"
                      )}
                      key={i}
                      style={{
                        animationDelay: `${i * 0.3}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Title / subtitle / flip affordance */}
          <div className="flex shrink-0 items-center justify-between gap-3 px-2 pt-4 pb-1">
            <div className="space-y-1">
              <h3 className="font-semibold text-lg text-white leading-snug tracking-tight transition-all duration-500 ease-out-expo group-hover:translate-y-[-4px]">
                {title}
              </h3>
              <p className="line-clamp-1 text-sm text-zinc-400 tracking-tight transition-all delay-[50ms] duration-500 ease-out-expo group-hover:translate-y-[-4px]">
                {subtitle}
              </p>
            </div>
            <div className="group/icon relative shrink-0">
              <div
                className={cn(
                  "absolute inset-[-8px] rounded-lg transition-opacity duration-300",
                  "bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-transparent"
                )}
              />
              <Repeat2 className="relative z-10 h-4 w-4 text-purple-400 transition-transform duration-300 group-hover/icon:-rotate-12 group-hover/icon:scale-110" />
            </div>
          </div>
        </div>

        {/* Back of card: details + tech stack + "Learn more" */}
        <div
          className={cn(
            "absolute inset-0 h-full w-full",
            "[backface-visibility:hidden] [transform:rotateY(180deg)]",
            "rounded-2xl p-6",
            "bg-gradient-to-b from-zinc-900 to-black",
            "border border-purple-900/40",
            "shadow-lg",
            "flex flex-col",
            "transition-all duration-700",
            "group-hover:shadow-xl group-hover:shadow-purple-500/10",
            isFlipped ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Centred rather than top-aligned: the taller carousel card leaves
              far more room than this content needs, and top-aligning strands the
              CTA behind a large void. Longer real copy just fills the space. */}
          <div className="flex flex-1 flex-col justify-center space-y-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-xl text-white leading-snug tracking-tight transition-all duration-500 ease-out-expo group-hover:translate-y-[-2px]">
                {title}
              </h3>
              <p className="line-clamp-3 text-sm text-zinc-400 tracking-tight transition-all duration-500 ease-out-expo group-hover:translate-y-[-2px]">
                {description}
              </p>
            </div>

            <div className="space-y-2">
              {features.map((feature, index) => (
                <div
                  className="flex items-center gap-2 text-sm text-zinc-300 transition-all duration-500"
                  key={feature}
                  style={{
                    transform: isFlipped
                      ? "translateX(0)"
                      : "translateX(-10px)",
                    opacity: isFlipped ? 1 : 0,
                    transitionDelay: `${index * 100 + 200}ms`,
                  }}
                >
                  <ArrowRight className="h-3 w-3 text-purple-400" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border-purple-900/40 border-t pt-6">
            <button
              type="button"
              onClick={onLearnMore}
              className={cn(
                "group/start relative w-full",
                "flex items-center justify-between",
                "-m-3 rounded-xl p-3",
                "transition-all duration-300",
                "bg-gradient-to-r from-zinc-800 via-zinc-800 to-zinc-800",
                "hover:from-0% hover:from-purple-500/20 hover:via-100% hover:via-purple-500/10 hover:to-100% hover:to-transparent",
                "hover:scale-[1.02] hover:cursor-pointer",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              )}
            >
              <span className="font-medium text-sm text-white transition-colors duration-300 group-hover/start:text-purple-300">
                Learn more
              </span>
              <div className="group/icon relative">
                <div
                  className={cn(
                    "absolute inset-[-6px] rounded-lg transition-all duration-300",
                    "bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-transparent",
                    "scale-90 opacity-0 group-hover/start:scale-100 group-hover/start:opacity-100"
                  )}
                />
                <ArrowRight className="relative z-10 h-4 w-4 text-purple-400 transition-all duration-300 group-hover/start:translate-x-0.5 group-hover/start:scale-110" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
