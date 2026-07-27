"use client"

// Unduh DRD resmi — berkas berformat ProgresCater (85 kolom) yang membuat
// aplikasi ini bisa jadi RUJUKAN sistem lain, bukan sekadar konsumen.
//
// Hanya periode TERKUNCI yang muncul di sini, dan itu juga yang dijaga
// server: berkas ini beredar sebagai dokumen resmi, jadi mengekspor periode
// berjalan berarti menerbitkan angka yang besok bisa berubah — sementara
// salinan yang sudah terlanjur dikirim tidak bisa ditarik kembali.
import * as React from "react"
import { Download } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

export function UnduhDrd({ periode }: { periode: number[] }) {
  if (periode.length === 0) {
    return (
      <p className="max-w-xs text-right text-xs text-muted-foreground">
        Belum ada periode terkunci. Tutup periode lewat menu Closing untuk bisa mengunduh DRD resmi.
      </p>
    )
  }

  // Satu periode: tombol langsung, tanpa menu yang isinya cuma satu baris.
  if (periode.length === 1) {
    return (
      <Button asChild variant="outline">
        <a href={`/api/v1/closing/${periode[0]}/drd.csv`} download>
          <Download className="size-4" />
          Unduh DRD {periode[0]}
        </a>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="size-4" />
          Unduh DRD resmi
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {periode.map((p) => (
          <DropdownMenuItem key={p} asChild>
            <a href={`/api/v1/closing/${p}/drd.csv`} download>
              Periode {p}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
