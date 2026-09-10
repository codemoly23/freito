"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// Persistent in-memory flag for Next.js soft navigation
let hasSeenSplashGlobal = false;

interface SplashScreenProps {
  showTagline?: boolean;
}

export function SplashScreen({ showTagline = true }: SplashScreenProps) {
  const [isShowing, setIsShowing] = useState(() => !hasSeenSplashGlobal);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (hasSeenSplashGlobal) {
      setIsShowing(false);
      return;
    }

    // Respect user prefers-reduced-motion setting
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    // Clean up/unmount after animation timeline completes (~3.4 seconds)
    const timer = setTimeout(() => {
      setIsShowing(false);
      hasSeenSplashGlobal = true;
    }, 3400);

    return () => clearTimeout(timer);
  }, []);

  if (!isShowing) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0A1F44] overflow-hidden select-none animate-splash-wipe">
      {/* Styles Injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* --- General Animations --- */
        @keyframes logo-entrance {
          from {
            opacity: 0;
            transform: scale(0.93) translateY(6px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes glow-pulse {
          0% {
            opacity: 0.35;
            transform: scale(0.9);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.15);
          }
          100% {
            opacity: 0.35;
            transform: scale(0.9);
          }
        }

        @keyframes shimmer-sweep {
          0% {
            transform: translateX(-150%) skewX(-25deg);
          }
          100% {
            transform: translateX(150%) skewX(-25deg);
          }
        }

        @keyframes tagline-reveal {
          from {
            opacity: 0;
            letter-spacing: 5px;
            transform: translateY(4px);
          }
          to {
            opacity: 0.75;
            letter-spacing: 2px;
            transform: translateY(0);
          }
        }

        @keyframes splash-wipe {
          0% {
            clip-path: circle(150% at 50% 50%);
          }
          100% {
            clip-path: circle(0% at 50% 50%);
          }
        }

        /* --- Animation Utility Classes --- */
        .animate-logo-entrance {
          animation: logo-entrance 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: 400ms;
        }

        .animate-glow-pulse {
          animation: glow-pulse 3000ms ease-in-out infinite;
        }

        .animate-shimmer-sweep {
          position: absolute;
          top: 0;
          left: 0;
          width: 35%;
          height: 100%;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.6) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: shimmer-sweep 1200ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
          animation-delay: 1300ms;
        }

        .animate-tagline {
          animation: tagline-reveal 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: 2200ms;
        }

        .animate-splash-wipe {
          animation: splash-wipe 600ms cubic-bezier(0.86, 0, 0.07, 1) forwards;
          animation-delay: 2800ms;
        }

        /* CSS Mask to ensure shimmer only clips to transparent logo pixels */
        .shimmer-mask {
          position: relative;
          overflow: hidden;
          mask-image: url('/images/freito-logo.svg');
          mask-size: contain;
          mask-repeat: no-repeat;
          mask-position: center;
          -webkit-mask-image: url('/images/freito-logo.svg');
          -webkit-mask-size: contain;
          -webkit-mask-repeat: no-repeat;
          -webkit-mask-position: center;
        }

        /* --- Reduced Motion Fallback --- */
        .reduced-motion-fade {
          animation: logo-entrance 500ms ease-out forwards;
          animation-delay: 200ms;
        }
      ` }} />

      <div className="relative flex flex-col items-center justify-center">
        {reducedMotion ? (
          /* Reduced Motion View: Clean Fade-in of Logo */
          <div className="opacity-0 reduced-motion-fade flex flex-col items-center gap-5 text-center">
            <div className="relative w-[280px] h-[58px] sm:w-[360px] sm:h-[75px] filter brightness-0 invert">
              <Image
                src="/images/freito-logo.svg"
                alt="FreightFast"
                fill
                priority
                className="object-contain"
              />
            </div>
            {showTagline && (
              <p className="text-sm tracking-wider text-slate-400 opacity-75 uppercase font-semibold">
                Freight, Forwarded.
              </p>
            )}
          </div>
        ) : (
          /* Premium Shimmer and Glow Logo Animation Composition */
          <div className="flex flex-col items-center gap-7 text-center">
            
            {/* Ambient Background Glow */}
            <div className="absolute -z-10 w-[240px] h-[240px] sm:w-[320px] sm:h-[320px] rounded-full bg-[radial-gradient(circle,_rgba(23,184,196,0.22)_0%,_transparent_75%)] blur-xl animate-glow-pulse" />

            {/* Logo Container with Shimmer Mask */}
            <div className="shimmer-mask w-[280px] h-[58px] sm:w-[360px] sm:h-[75px] max-w-[85vw]">
              
              {/* Actual Logo Image */}
              <div className="relative w-full h-full opacity-0 animate-logo-entrance filter brightness-0 invert">
                <Image
                  src="/images/freito-logo.svg"
                  alt="FreightFast Logo"
                  fill
                  priority
                  className="object-contain"
                />
              </div>

              {/* Shimmer Line Sweeper */}
              <div className="animate-shimmer-sweep" />
            </div>

            {/* Subtext Tagline */}
            {showTagline && (
              <div className="h-6 overflow-hidden">
                <p className="opacity-0 text-xs sm:text-sm uppercase tracking-wider text-slate-400/80 font-semibold animate-tagline">
                  Freight, Forwarded.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
