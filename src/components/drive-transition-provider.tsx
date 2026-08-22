"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type DriveTransitionContextValue = {
  goTo: (targetId: string) => void;
};

const DriveTransitionContext = createContext<DriveTransitionContextValue | null>(null);

const OUT_MS = 480;
const IN_MS = 480;

export function DriveTransitionProvider({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const [showCar, setShowCar] = useState(false);
  const router = useRouter();

  const goTo = useCallback(
    (targetId: string) => {
      if (busyRef.current) return;
      const target = document.getElementById(targetId);
      const el = wrapperRef.current;

      if (!target) {
        router.push(`/#${targetId}`);
        return;
      }
      if (!el) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        target.scrollIntoView({ behavior: "auto", block: "start" });
        return;
      }

      busyRef.current = true;
      setShowCar(true);

      el.style.transition = `transform ${OUT_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`;
      el.style.transform = "translateX(-100vw)";

      window.setTimeout(() => {
        target.scrollIntoView({ behavior: "auto", block: "start" });

        el.style.transition = "none";
        el.style.transform = "translateX(100vw)";
        void el.offsetHeight;

        requestAnimationFrame(() => {
          el.style.transition = `transform ${IN_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`;
          el.style.transform = "translateX(0)";
        });

        window.setTimeout(() => {
          setShowCar(false);
          busyRef.current = false;
          el.style.transition = "";
          el.style.transform = "";
        }, IN_MS);
      }, OUT_MS);
    },
    [router]
  );

  return (
    <DriveTransitionContext.Provider value={{ goTo }}>
      <div ref={wrapperRef} className="flex min-h-full flex-col will-change-transform">
        {children}
      </div>
      {showCar && <DriveOverlay />}
    </DriveTransitionContext.Provider>
  );
}

export function useDriveTransition() {
  const ctx = useContext(DriveTransitionContext);
  if (!ctx) {
    throw new Error("useDriveTransition must be used within a DriveTransitionProvider");
  }
  return ctx;
}

function DriveOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
      <div className="drive-car absolute left-0" style={{ top: "50%" }}>
        <div className="flex items-center">
          <div className="mr-[-4px] flex flex-col gap-1.5 opacity-70">
            <span className="h-[3px] w-10 rounded-full bg-emerald-400/70" />
            <span className="h-[3px] w-6 rounded-full bg-emerald-400/50" />
            <span className="h-[3px] w-8 rounded-full bg-emerald-400/40" />
          </div>
          <CarSilhouette />
        </div>
      </div>
    </div>
  );
}

function CarSilhouette() {
  return (
    <svg
      width="150"
      height="64"
      viewBox="0 0 150 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_8px_24px_rgba(16,185,129,0.45)]"
    >
      <path
        d="M10 42C7 42 5 39.5 5.5 36.5C7 28 14 22 23 21L38 10C42.5 6.5 48 4.5 53.5 4.5H92C99 4.5 105.5 8 110 13.5L119 21C129 22.5 137 29.5 138.5 38C139 40.5 137 42 134.5 42H128"
        fill="#10B981"
      />
      <path d="M35 21L45 11H88L100 21H35Z" fill="#022c1e" opacity="0.55" />
      <rect x="10" y="34" width="124" height="8" fill="#10B981" />
      <circle cx="34" cy="46" r="12" fill="#09090b" />
      <circle cx="34" cy="46" r="5" fill="#52525b" />
      <circle cx="112" cy="46" r="12" fill="#09090b" />
      <circle cx="112" cy="46" r="5" fill="#52525b" />
    </svg>
  );
}
