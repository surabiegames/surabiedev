// server/modules/pengaduan/sla.ts — kanonik dipindah ke @workspace/domain
// (dipakai bersama oleh apps/api & apps/web RSC). Berkas ini tinggal
// re-export supaya seluruh impor relatif internal server tetap jalan.
export * from "@workspace/domain/sla"
