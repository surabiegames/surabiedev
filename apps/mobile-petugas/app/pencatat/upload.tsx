/** Rute /pencatat/upload — antrean kirim hasil catat. */
import { router } from 'expo-router';
import { AntreanUploadScreen } from '@/features/baca-meter/antrean-screen';

export default function Upload() {
  return <AntreanUploadScreen onBack={() => router.back()} />;
}
