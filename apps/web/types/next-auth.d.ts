// next-auth.d.ts
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
//
// CATATAN PENTING: inference *kontekstual* untuk parameter `token` di
// dalam `callbacks.session` (tanpa anotasi tipe eksplisit) tetap menyimpulkan
// tipe dari signature asli @auth/core, BUKAN dari augmentasi di sini —
// jadi callback `session` di auth.ts WAJIB anotasi eksplisit
// `{ session, token }: { session: Session; token: JWT }` (import dari
// "next-auth" / "next-auth/jwt") supaya property role/divisiKode/
// subBagianKode yang diaugmentasi di sini benar-benar kepakai, bukan
// diam-diam jadi `unknown`.
declare module "next-auth/jwt" {
  interface JWT {
    role: Role
    divisiKode: string | null
    subBagianKode: string | null
  }
}