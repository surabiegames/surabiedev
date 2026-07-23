"use client"

// components/providers/theme-provider.tsx — pembungkus next-themes.
//
// `attribute="class"` WAJIB dan bukan pilihan gaya: app/globals.css memakai
// `@custom-variant dark (&:is(.dark *))` dan mendefinisikan token warna di
// selektor `.dark {...}`. Artinya tema gelap aktif HANYA saat ada class
// `dark` di elemen root. Kalau diganti ke attribute="data-theme", seluruh
// token dark tidak akan pernah kepakai dan dark mode diam-diam mati.
//
// Semua provider client-side lain (mis. SessionProvider, QueryClientProvider)
// nanti dipasang di sini juga, bukan di app/layout.tsx — supaya layout tetap
// server component dan batas client/server-nya cuma satu tempat.
import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
