// app/(dashboard)/dashboard/impor-data/page.tsx — /dashboard/impor-data
import type { Metadata } from "next";
import { ImporDataClient } from "@/features/dashboard/components/impor/impor-data-client";

export const metadata: Metadata = { title: "Impor berkas sumber" };

export default function ImporDataPage() {
  return <ImporDataClient />;
}
