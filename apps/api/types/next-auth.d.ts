// next-auth.d.ts — augmentasi tipe Auth.js untuk apps/api.
//
// CATATAN DRY: berkas ini identik dengan packages/auth/types/next-auth.d.ts
// dan apps/web/types/next-auth.d.ts. Declaration merging TypeScript hanya
// berlaku pada .d.ts yang ikut dalam compilation ini, dan augmentasi dari
// dalam sebuah package tidak otomatis merambat ke konsumen — jadi tiap app
// menyimpan salinannya sendiri. Bila salah satu diubah, samakan yang lain.
import { DefaultSession } from "next-auth"
import type { Role } from "@workspace/db"

declare module "next-auth" {
  interface Session {
    user: {
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

declare module "next-auth/jwt" {
  interface JWT {
    role: Role
    divisiKode: string | null
    subBagianKode: string | null
  }
}
