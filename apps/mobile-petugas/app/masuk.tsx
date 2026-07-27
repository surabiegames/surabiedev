/**
 * Rute /masuk — layar penuh Masuk Petugas. `replace` (bukan `push`) setelah
 * sukses: layar masuk tidak boleh tersisa di tumpukan, karena tombol kembali
 * yang mendarat kembali ke sana setelah login hanya membingungkan.
 */
import { router } from 'expo-router';
import { MasukPetugasScreen } from '@/features/auth/masuk-screen';

export default function Masuk() {
  return <MasukPetugasScreen onSukses={() => router.replace('/')} />;
}
