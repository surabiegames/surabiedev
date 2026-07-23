// next-auth.d.ts — augmentasi tipe Auth.js untuk paket ini sendiri.
//
// CATATAN DRY: berkas ini sengaja diduplikasi di tiap compilation yang
// memakai tipe next-auth (packages/auth, apps/web/types, apps/api/types).
// Declaration merging TypeScript bersifat ambient dan hanya berlaku pada
// .d.ts yang ikut dalam compilation itu — augmentasi dari dalam sebuah
// package TIDAK otomatis merambat ke konsumen. Menyalinnya (isi identik)
// jauh lebih andal daripada trik referensi lintas-package. Bila salah satu
// diubah, samakan yang lain.
import { DefaultSession } from "next-auth"
import type { Role } from "@workspace/db"

declare module "next-auth" {
  interface Session {
    user: {
      // `id` bawaan @auth/core bertipe `string | undefined` (DefaultUser.id
      // opsional) — di app ini SELALU diisi tanpa syarat di callbacks.session
      // (auth.ts: `session.user.id = token.sub!`), jadi wajib diketatkan di
      // sini supaya kode pemanggil (mis. app/akun/page.tsx) tidak perlu
      // non-null assertion berulang untuk sesuatu yang memang selalu ada.
      id: string
      role: Role
      divisiKode: string | null
      subBagianKode: string | null
    } & DefaultSession["user"]
  }

  interface User {
    role: Role
    divisiKode: string | null
    subBagianKode: string | null
  }
}

// Augmentasi menyasar "next-auth/jwt" (module specifier yang benar-benar
// dipakai kode ini untuk mengimpor tipe JWT — lihat auth.ts). next-auth
// re-export tipe JWT dari @auth/core lewat `export * from "@auth/core/jwt"`
// di dalam next-auth/jwt.d.ts, tapi declaration merging TypeScript tidak
// ikut menyatu lintas specifier re-export seperti itu, jadi augmentasi di
// "@auth/core/jwt" tidak akan terlihat dari sisi "next-auth/jwt" (begitu
// juga sebaliknya).
declare module "next-auth/jwt" {
  interface JWT {
    role: Role
    divisiKode: string | null
    subBagianKode: string | null
  }
}
