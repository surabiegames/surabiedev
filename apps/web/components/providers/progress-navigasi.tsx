"use client"

// components/providers/progress-navigasi.tsx — indikator "penghubung" antar
// halaman: bilah tipis di puncak viewport yang mengisi jeda antara klik dan
// halaman baru tampil.
import * as React from "react"
import { usePathname } from "next/navigation"

const BATAS_TRICKLE = 90
const TICK_MS = 200
const TIMEOUT_AMAN_MS = 10_000

export function ProgressNavigasi() {
  const pathname = usePathname()
  const [progress, setProgress] = React.useState(0)
  const [aktif, setAktif] = React.useState(false)

  const tickRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const tuntasRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const amanRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const tuntas = React.useCallback(() => {
    setTimeout(() => {
      if (tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
      if (amanRef.current) {
        clearTimeout(amanRef.current)
        amanRef.current = null
      }
      
      setProgress(100)

      tuntasRef.current = setTimeout(() => {
        setAktif(false)
        setProgress(0)
      }, 360)
    }, 0)
  }, [])

  const mulai = React.useCallback(() => {
    // Menggunakan setTimeout(..., 0) untuk keluar dari siklus effect/event sensitif
    setTimeout(() => {
      if (tuntasRef.current) {
        clearTimeout(tuntasRef.current)
        tuntasRef.current = null
      }

      setAktif(true)
      setProgress((p) => (p > 0 && p < BATAS_TRICKLE ? p : 8))

      if (tickRef.current) clearInterval(tickRef.current)
      tickRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= BATAS_TRICKLE) return p
          const sisa = BATAS_TRICKLE - p
          return Math.min(BATAS_TRICKLE, p + Math.max(0.4, sisa * 0.07))
        })
      }, TICK_MS)

      if (amanRef.current) clearTimeout(amanRef.current)
      amanRef.current = setTimeout(() => tuntas(), TIMEOUT_AMAN_MS)
    }, 0)
  }, [tuntas])

  // MULAI: pasang penangkap klik + tambal history sekali saat mount.
  React.useEffect(() => {
    const bedaPath = (href: string | URL | null | undefined) => {
      if (!href) return false
      try {
        const u = new URL(String(href), location.href)
        return u.origin === location.origin && u.pathname !== location.pathname
      } catch {
        return false
      }
    }

    const onKlik = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return
      const anchor = (e.target as HTMLElement | null)?.closest("a")
      if (!anchor) return
      if (anchor.target && anchor.target !== "_self") return
      if (anchor.hasAttribute("download")) return
      if (bedaPath(anchor.getAttribute("href"))) mulai()
    }

    const asliPush = window.history.pushState
    const asliReplace = window.history.replaceState

    window.history.pushState = function (...args) {
      if (bedaPath(args[2])) mulai()
      return asliPush.apply(this, args)
    }

    window.history.replaceState = function (...args) {
      if (bedaPath(args[2])) mulai()
      return asliReplace.apply(this, args)
    }

    const onPopstate = () => mulai()

    document.addEventListener("click", onKlik, { capture: true })
    window.addEventListener("popstate", onPopstate)

    return () => {
      document.removeEventListener("click", onKlik, { capture: true })
      window.removeEventListener("popstate", onPopstate)
      window.history.pushState = asliPush
      window.history.replaceState = asliReplace
    }
  }, [mulai])

  // SELESAI: pathname berubah = route baru commit.
  const pertama = React.useRef(true)
  React.useEffect(() => {
    if (pertama.current) {
      pertama.current = false
      return
    }
    tuntas()
  }, [pathname, tuntas])

  // Bersihkan timer saat unmount.
  React.useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current)
      if (tuntasRef.current) clearTimeout(tuntasRef.current)
      if (amanRef.current) clearTimeout(amanRef.current)
    },
    [],
  )

  if (!aktif && progress === 0) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999]"
    >
      <div
        className="relative h-[3px] origin-left bg-primary transition-[width,opacity] duration-300 ease-out motion-reduce:transition-none"
        style={{
          width: `${progress}%`,
          opacity: aktif ? 1 : 0,
          boxShadow:
            "0 0 8px color-mix(in oklch, var(--primary) 70%, transparent), 0 0 3px var(--primary)",
        }}
      >
        <span className="absolute top-0 right-0 hidden h-full w-28 translate-y-[-1px] rotate-[2.5deg] rounded-full bg-primary opacity-90 blur-[3px] motion-safe:block" />
      </div>
    </div>
  )
}