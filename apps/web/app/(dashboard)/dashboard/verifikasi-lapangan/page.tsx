// app/(dashboard)/dashboard/verifikasi-lapangan/page.tsx —
// /dashboard/verifikasi-lapangan
import type { Metadata } from "next";
import { auth } from "@workspace/auth";
import { VerifikasiLapangan } from "@/features/dashboard/components/verifikasi/verifikasi-lapangan";

export const metadata: Metadata = { title: "Verifikasi catat lapangan" };

export default async function VerifikasiLapanganPage() {
  const session = await auth();
  // Role utuh (bukan boolean bisaAksi): verifikasi berjenjang V1/V2/V3
  // butuh tingkatan berbeda per ring (Supervisor/Manager/Senior Manager) —
  // pemetaan grup role ada di komponen client, server tetap penjaga aslinya.
  return <VerifikasiLapangan role={session?.user?.role ?? ""} />;
}
