// next-auth.d.ts — augmentasi tipe Auth.js untuk paket @workspace/server.
//
// CATATAN DRY: identik dengan salinan di packages/auth/types, apps/web/types,
// apps/api/types. Declaration merging hanya berlaku pada .d.ts yang ikut
// dalam compilation ini; augmentasi dari package lain tak merambat otomatis.
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
