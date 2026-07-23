"use client"

// features/beranda/components/cek-cepat-form.tsx — titik fokus fungsional
// hero: bukan mockup dashboard, tapi input nomor langganan sungguhan yang
// mengantar ke /cek-tagihan dengan nomor sudah terisi.
//
// SENGAJA tidak memanggil API dari sini: pemanggilan tetap terjadi di
// halaman cek-tagihan (dari browser pemakai) supaya rate limit per-IP tetap
// bermakna dan logika verifikasi tidak terduplikasi di dua tempat.
import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

export function CekCepatForm() {
  const router = useRouter()
  const [nomor, setNomor] = React.useState("")
  const lengkap = nomor.length === 11

  function lanjut(e: React.FormEvent) {
    e.preventDefault()
    if (lengkap) router.push(`/cek-tagihan?nomor=${nomor}`)
  }

  return (
    <form onSubmit={lanjut} className="flex w-full max-w-md items-stretch gap-2">
      <label htmlFor="cek-cepat" className="sr-only">
        Nomor langganan
      </label>
      <Input
        id="cek-cepat"
        value={nomor}
        onChange={(e) => setNomor(e.target.value.replace(/\D/g, "").slice(0, 11))}
        inputMode="numeric"
        autoComplete="off"
        placeholder="Nomor langganan — 11 digit"
        className="h-11 flex-1 border-border bg-card font-mono text-sm"
      />
      <Button type="submit" disabled={!lengkap} className="group h-11 px-4">
        Cek
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Button>
    </form>
  )
}
