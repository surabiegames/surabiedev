"use client"

// features/dashboard/components/app-sidebar.tsx — navigasi utama dashboard.
//
// Client component karena butuh usePathname() untuk menandai menu aktif.
// Data user (role) datang lewat PROP dari layout (server component) — sengaja
// tidak memakai useSession() di sini: itu menambah satu request
// /api/auth/session dari browser dan membuat menu berkedip saat dimuat,
// padahal server sudah memilikinya.
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArchiveRestore,
  ArrowLeftRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Building2,
  Camera,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  Map,
  MessageSquareWarning,
  Receipt,
  ReceiptText,
  Route,
  ScrollText,
  Settings2,
  Unplug,
  UserCog,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react"
import { AppLogo } from "@/components/app-logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"

/// Cermin ROLE_GROUPS.MANAGEMENT_UP dari server/middleware/rbac.ts — file itu
/// menyeret session server, jadi tidak bisa diimpor ke client. Kalau grup di
/// sana berubah, samakan di sini.
const MANAGEMENT_UP = new Set(["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER", "MANAGER"])

/// Peta menu disimpulkan dari server/modules/* (lihat tabel endpoint di
/// server/README.md) — setiap item mewakili domain API yang benar-benar ada,
/// dikelompokkan mengikuti cara kerja PERUMDA, bukan struktur tabel:
/// petugas berpikir "pelanggan → catat meter → tagih → tangani aduan".
const MENU = [
  {
    label: null,
    minRole: null,
    item: [{ href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard }],
  },
  {
    label: "Pelanggan & Sambungan",
    minRole: null,
    item: [
      { href: "/dashboard/pelanggan", label: "Data pelanggan", icon: Users },
      { href: "/dashboard/meter", label: "Meter", icon: Gauge },
      { href: "/dashboard/mutasi", label: "Mutasi", icon: ArrowLeftRight },
      { href: "/dashboard/pemutusan", label: "Pemutusan", icon: Unplug },
      { href: "/dashboard/potensi", label: "Potensi pelanggan", icon: UserPlus },
    ],
  },
  {
    label: "Penagihan",
    minRole: null,
    item: [
      { href: "/dashboard/pembacaan", label: "Pembacaan meter", icon: ClipboardList },
      { href: "/dashboard/tagihan", label: "Tagihan air", icon: Receipt },
      { href: "/dashboard/tagihan-lain", label: "Tagihan non-air", icon: ReceiptText },
      { href: "/dashboard/pembayaran", label: "Pembayaran", icon: Wallet },
    ],
  },
  {
    // Alur pra-penagihan: laporan mentah (harian petugas / mandiri
    // pelanggan) diperiksa di sini sebelum naik jadi PembacaanMeter resmi —
    // lapangan lewat ring /laporan-harian/:id/verif1..verif3, mandiri lewat
    // /laporan-mandiri/:id/verify.
    label: "Verifikasi",
    minRole: null,
    item: [
      { href: "/dashboard/verifikasi-lapangan", label: "Catat meter lapangan", icon: BadgeCheck },
      { href: "/dashboard/verifikasi-mandiri", label: "Laporan mandiri pelanggan", icon: FileCheck2 },
    ],
  },
  {
    label: "Operasional Lapangan",
    minRole: null,
    item: [
      { href: "/dashboard/pemetaan-rute", label: "Pemetaan rute", icon: Route },
      { href: "/dashboard/pengaduan", label: "Pengaduan", icon: MessageSquareWarning },
      { href: "/dashboard/laporan-mandiri", label: "Laporan mandiri", icon: Camera },
      { href: "/dashboard/laporan-harian", label: "Laporan harian petugas", icon: ClipboardCheck },
      { href: "/dashboard/impor-cadangan", label: "Impor cadangan lapangan", icon: ArchiveRestore },
    ],
  },
  {
    label: "Laporan",
    minRole: null,
    item: [{ href: "/dashboard/laporan-drd", label: "Laporan DRD", icon: FileSpreadsheet }],
  },
  {
    label: "Data Induk",
    minRole: null,
    item: [
      { href: "/dashboard/wilayah", label: "Wilayah & peta", icon: Map },
      { href: "/dashboard/tarif", label: "Golongan tarif", icon: Banknote },
      { href: "/dashboard/organisasi", label: "Organisasi & petugas", icon: Building2 },
    ],
  },
  {
    // Endpoint /users & /audit-log memang MANAGEMENT_UP di server — menunya
    // ikut disembunyikan untuk role di bawah itu (server tetap penjaga
    // aslinya; ini cuma soal tidak memajang pintu yang pasti terkunci).
    label: "Administrasi",
    minRole: MANAGEMENT_UP,
    item: [
      { href: "/dashboard/pengguna", label: "Pengguna & akses", icon: UserCog },
      { href: "/dashboard/audit-log", label: "Audit log", icon: ScrollText },
      { href: "/dashboard/konfigurasi", label: "Konfigurasi", icon: Settings2 },
    ],
  },
] as const

export function AppSidebar({ role }: { role: string }) {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-sidebar-border px-4 py-3.5">
        <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="Ringkasan dashboard">
          <AppLogo className="size-7 shrink-0" />
          <span className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">PERUMDA Tirtawening</span>
            <span className="mt-0.5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Dasbor Operasional
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="py-1">
        {MENU.filter((grup) => !grup.minRole || grup.minRole.has(role)).map((grup, i) => (
          <SidebarGroup key={grup.label ?? i}>
            {grup.label && (
              <SidebarGroupLabel className="px-2 text-[10px] font-semibold tracking-widest text-muted-foreground/80 uppercase">
                {grup.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {grup.item.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      // Cocok persis untuk /dashboard, berawalan untuk sisanya.
                      // Tanpa pengecualian ini, "Ringkasan" akan selalu
                      // tersorot karena semua path diawali /dashboard.
                      isActive={
                        item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href)
                      }
                      // Bilah aksen kiri saat aktif — inset shadow supaya tidak
                      // menggeser layout; grammar yang sama dengan penanda
                      // status di halaman publik.
                      className="data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:shadow-[inset_2px_0_0_0_var(--primary)]"
                    >
                      <Link href={item.href}>
                        <item.icon className="text-muted-foreground" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-4 py-3 group-data-[collapsible=icon]:px-2">
        <Link
          href="/"
          className="group/situs flex items-center justify-between text-xs text-muted-foreground transition-colors hover:text-foreground group-data-[collapsible=icon]:hidden"
        >
          <span>Situs publik</span>
          <ArrowUpRight className="size-3.5 transition-transform group-hover/situs:translate-x-0.5 group-hover/situs:-translate-y-0.5" />
        </Link>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
