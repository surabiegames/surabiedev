// components/app-logo.tsx — lambang aplikasi. Dipakai bersama oleh halaman
// auth, header dashboard, dan sidebar nanti, supaya identitas visualnya
// didefinisikan SEKALI di sini, bukan di-copy tiap halaman.
//
// Server component (tanpa "use client"): murni presentasional, tanpa state
// maupun event handler. Pola yang sama berlaku untuk komponen tampilan lain —
// jangan tambahkan "use client" kecuali komponennya benar-benar butuh
// interaktivitas.
import Image from "next/image";
import { cn } from "@workspace/ui/lib/utils";

export function AppLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <Image
        src="/images/logo.png"
        alt="Logo PERUMDA Tirtawening"
        width={36}
        height={36}
        className="object-contain h-full w-full"
      />
    </div>
  );
}
