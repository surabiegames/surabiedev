import type { Metadata } from 'next'
import "@workspace/ui/globals.css"
import { Inter } from "next/font/google";
import { cn } from "@workspace/ui/lib/utils";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { Toaster } from "@workspace/ui/components/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ProgressNavigasi } from "@/components/providers/progress-navigasi";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: {
    default: 'PERUMDA Tirtawening',
    // Halaman anak cukup men-set `title: "Masuk"` -> otomatis jadi
    // "Masuk — PERUMDA Tirtawening". Pola ini dipakai semua page berikutnya.
    template: '%s — PERUMDA Tirtawening',
  },
  description: 'Dashboard operasional PERUMDA Tirtawening Kota Bandung'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // suppressHydrationWarning WAJIB di <html> saat memakai next-themes:
    // script anti-flash next-themes menempelkan class `dark` SEBELUM React
    // hydrate, jadi markup server (tanpa class) selalu berbeda dari client.
    // Tanpa ini, setiap halaman memuntahkan hydration mismatch. Cakupannya
    // hanya elemen <html> ini, bukan mematikan pengecekan hydration se-app.
    <html lang="id" className={cn("font-sans", inter.variable)} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        {/* Semua provider client-side tinggal di components/providers/ —
            layout ini tetap server component. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          // Tanpa ini, setiap elemen ber-`transition-colors` ikut memudar
          // bersamaan saat tema berganti dan terlihat seperti glitch.
          disableTransitionOnChange
        >
          {/* Bilah progres navigasi — indikator "penghubung" di puncak layar
              pada setiap perpindahan halaman. Di luar TooltipProvider supaya
              tak terpengaruh remount konten. */}
          <ProgressNavigasi />
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
