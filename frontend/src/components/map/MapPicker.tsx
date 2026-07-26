'use client';

type LatLng = {
  lat: number;
  lng: number;
};

export default function MapPicker({
  value,
  onChange,
}: {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
}) {
  return (
    <div className="h-72 rounded-xl border flex items-center justify-center">
      Map Picker
    </div>
  );
}
