// app/(dashboard)/dashboard/verifikasi-mandiri/page.tsx —
// /dashboard/verifikasi-mandiri
import type { Metadata } from "next";
import { auth } from "@workspace/auth";
import { VerifikasiMandiri } from "@/features/dashboard/components/verifikasi/verifikasi-mandiri";

export const metadata: Metadata = { title: "Verifikasi laporan mandiri" };

/// Cermin ROLE_GROUPS.STAFF_UP (server/middleware/rbac.ts). Server tetap
/// penjaga aslinya; ini hanya menentukan apakah tombol aksi tampil.
const STAFF_UP = new Set([
  "SUPER_ADMIN",
  "DIREKSI",
  "SENIOR_MANAGER",
  "MANAGER",
  "SUPERVISOR",
  "STAFF",
]);

export default async function VerifikasiMandiriPage() {
  const session = await auth();
  const bisaAksi = STAFF_UP.has(session?.user?.role ?? "");

  return <VerifikasiMandiri bisaAksi={bisaAksi} />;
}
