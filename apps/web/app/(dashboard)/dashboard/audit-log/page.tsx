// app/(dashboard)/dashboard/audit-log/page.tsx — /dashboard/audit-log
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { AuditGrid } from "@/features/dashboard/components/grids/audit-grid"

export const metadata: Metadata = { title: "Audit log" }

export default function AuditLogPage() {
  return (
    <HalamanDasbor
      eyebrow="Administrasi"
      judul="Jejak audit"
      deskripsi="Rekaman mutasi data penting — ditulis otomatis di dalam transaksi, hanya-baca dari sini."
    >
      <AuditGrid />
    </HalamanDasbor>
  )
}
