// auth.config.ts
import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // WAJIB untuk model "akun di-provision dulu oleh admin, user tinggal
      // login Google". Diverifikasi langsung di source @auth/core
      // (lib/actions/callback/handle-login.js): saat login OAuth menemukan
      // User dengan email yang sama TAPI belum punya baris Account, Auth.js
      // MELEMPAR OAuthAccountNotLinked kecuali flag ini true. Tanpa ini,
      // setiap akun hasil `pnpm db:bootstrap-admin` (dan setiap akun yang
      // dibuat lewat POST /api/v1/users) MUSTAHIL login — persis alur yang
      // dipakai sistem ini.
      //
      // Kenapa "dangerous"-nya tidak berlaku di sini: risikonya adalah
      // provider yang TIDAK memverifikasi kepemilikan email, sehingga orang
      // lain bisa mengklaim email milik user terdaftar. Google memverifikasi
      // email, dan callbacks.signIn di auth.ts tetap menolak email yang
      // belum terdaftar sebagai User — jadi pintunya tetap hanya untuk akun
      // yang sudah sengaja dibuat admin.
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      // authorize() diimplementasi di auth.ts (butuh Prisma), bukan di sini
      authorize: async () => null,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // WAJIB ada — tanpa ini SELURUH endpoint terautentikasi mati di produksi.
  // Terbukti saat uji `pnpm build && pnpm start`: Auth.js v5 menolak setiap
  // request dengan `UntrustedHost: Host must be trusted` (semua /api/v1/*
  // jadi 401, login Credentials 500), sementara di `next dev` semuanya lolos.
  // Sebabnya: @auth/core hanya meng-set trustHost otomatis untuk host yang
  // dikenalinya (mis. Vercel) atau saat dev; app ini dilayani lewat adapter
  // Hono di server sendiri, jadi harus dinyatakan eksplisit.
  //
  // KONSEKUENSI KEAMANAN: trustHost membuat Auth.js mempercayai header
  // Host/X-Forwarded-Host untuk menyusun callback URL. Itu aman HANYA bila
  // app berada di belakang reverse proxy yang menormalkan header tersebut.
  // Untuk produksi, set juga env `AUTH_URL` ke origin kanonik
  // (mis. https://dashboard.tirtawening.co.id) supaya origin dipaku dan
  // header Host dari luar tidak bisa mengarahkan callback ke domain lain.
  trustHost: true,
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const { pathname } = request.nextUrl
      // /akun = portal warga (role USER, akun mandiri via /daftar) — beda
      // dari /dashboard (staf), tapi butuh gerbang sesi yang sama persis:
      // pengunjung tanpa sesi tidak boleh sampai ke halaman yang menampilkan
      // riwayat pengaduan pribadi.
      if (pathname.startsWith("/dashboard") || pathname.startsWith("/akun")) return isLoggedIn
      return true
    },
  },
  session: { strategy: "jwt" },
}