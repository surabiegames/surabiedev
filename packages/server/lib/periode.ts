// server/lib/periode.ts — kanonik dipindah ke @workspace/domain (dipakai
// bersama oleh apps/api & apps/web RSC). Berkas ini tinggal re-export supaya
// seluruh impor relatif internal server (./periode, ../lib/periode) tetap
// jalan tanpa perlu diubah satu per satu.
export * from "@workspace/domain/periode"
