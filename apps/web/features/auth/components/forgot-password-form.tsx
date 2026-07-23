"use client"

// features/auth/components/forgot-password-form.tsx
//
// POLA RUJUKAN form berbasis server action: useActionState + <form action={…}>.
// Bandingkan dengan credentials-form.tsx yang memakai signIn() —
// perbedaannya disengaja: form ini memanggil action milik kita sendiri,
// sedangkan login harus lewat endpoint Auth.js.
//
// Keuntungan pola ini: form tetap berfungsi meski JavaScript belum/ gagal
// dimuat (progressive enhancement), dan status pending datang dari React
// tanpa useState manual.
import { useActionState } from "react"
import { CheckCircle2, TriangleAlert } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Spinner } from "@workspace/ui/components/spinner"
import { forgotPasswordAction, type ForgotPasswordState } from "../actions/forgot-password"

const AWAL: ForgotPasswordState = { status: "idle" }

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, AWAL)

  // Setelah sukses, form disembunyikan: menampilkannya lagi hanya mengundang
  // pengguna menekan kirim berulang kali dan menabrak pembatas laju.
  if (state.status === "sukses") {
    return (
      <Alert>
        <CheckCircle2 />
        <AlertDescription>{state.pesan}</AlertDescription>
      </Alert>
    )
  }

  return (
    <form action={action}>
      <FieldGroup className="gap-4">
        {state.status === "error" && state.pesan && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{state.pesan}</AlertDescription>
          </Alert>
        )}

        <Field data-invalid={!!state.errors?.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="nama@tirtawening.co.id"
            aria-invalid={!!state.errors?.email}
            disabled={pending}
          />
          {state.errors?.email && <FieldError>{state.errors.email}</FieldError>}
        </Field>

        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending && <Spinner className="size-4" />}
          {pending ? "Mengirim…" : "Kirim tautan reset"}
        </Button>
      </FieldGroup>
    </form>
  )
}
