/**
 * repository.ts — sumber data Lapor Meter Mandiri (padanan
 * features/public/lapor_meter/lapor_meter_repository.dart).
 *
 * Laporan SELALU masuk berstatus MENUNGGU; periode ditentukan server (bulan
 * berjalan). Server MEWAJIBKAN foto meter (menolak 400 tanpa field `foto`) —
 * digagalkan lebih awal di sini dengan pesan sama supaya pengguna tak menunggu
 * upload yang pasti ditolak. Foto dikirim sebagai berkas multipart (uri).
 */
import { ApiClient, ApiConfig, ApiException, LaporMeterReceipt, thblDariDate } from '@workspace/mobile-core';

export interface KirimLaporMeterInput {
  nomorLangganan: string;
  standDilaporkan: number;
  namaPelapor: string;
  nomorPelapor: string;
  /** URI foto meter yang sudah dikompres. Wajib. */
  fotoUri: string | null;
}

export interface LaporMeterRepository {
  kirim(input: KirimLaporMeterInput): Promise<LaporMeterReceipt>;
}

class ApiLaporMeterRepository implements LaporMeterRepository {
  kirim(input: KirimLaporMeterInput): Promise<LaporMeterReceipt> {
    if (input.fotoUri == null) {
      throw new ApiException(400, 'BAD_REQUEST', 'Foto meter wajib dilampirkan sebagai bukti.');
    }
    const form = new FormData();
    form.append('nomorLangganan', input.nomorLangganan);
    form.append('standDilaporkan', String(input.standDilaporkan));
    form.append('namaPelapor', input.namaPelapor);
    form.append('nomorPelapor', input.nomorPelapor);
    form.append('foto', { uri: input.fotoUri, name: 'meter.jpg', type: 'image/jpeg' } as unknown as Blob);

    return ApiClient.postMultipart(`${ApiConfig.publicPath}/lapor-meter`, {
      form,
      parse: (data) => LaporMeterReceipt.fromJson((data as Record<string, unknown>) ?? {}),
    });
  }
}

class DemoLaporMeterRepository implements LaporMeterRepository {
  async kirim(input: KirimLaporMeterInput): Promise<LaporMeterReceipt> {
    await new Promise((r) => setTimeout(r, 700));
    const now = new Date();
    return new LaporMeterReceipt(
      thblDariDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))),
      input.standDilaporkan,
      'MENUNGGU',
      'Laporan meter Anda terkirim dan sedang menunggu verifikasi petugas.',
    );
  }
}

export function buatLaporMeterRepository(): LaporMeterRepository {
  return ApiConfig.isDemo ? new DemoLaporMeterRepository() : new ApiLaporMeterRepository();
}
