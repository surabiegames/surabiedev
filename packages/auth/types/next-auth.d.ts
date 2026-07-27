// next-auth.d.ts — augmentasi tipe Auth.js, SUMBER UTAMA.
//
// Berkas ini ditarik ke setiap program yang meng-compile ../auth.ts lewat
// `/// <reference path="./types/next-auth.d.ts" />` di puncak berkas itu
// (alasan lengkapnya ada di sana). Jadi konsumen TIDAK perlu menyalinnya:
// apps/api dulu punya salinan sendiri yang justru tak berefek karena
// apps/api tidak punya next-auth sebagai dependensi — salinan itu sudah
// dihapus.
//
// apps/web/types/next-auth.d.ts masih ada dan isinya identik. Di sana ia
// memang berfungsi (apps/web memakai next-auth langsung dan menyelesaikannya
// ke salinan fisik yang sama), dan augmentasi identik aman menyatu. Bila
// berkas ini diubah, samakan yang di apps/web.
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
