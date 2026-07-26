// 'use client';

// import { useMemo } from 'react';
// import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';

// type LatLng = { lat: number; lng: number };

// export default function MapPicker({
//   value,
//   onChange,
//   height = 360,
// }: {
//   value: LatLng | null;
//   onChange: (v: LatLng) => void;
//   height?: number;
// }) {
//   const { isLoaded, loadError } = useLoadScript({
//     googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
//   });

//   // React 19 + @react-google-maps/api typing mismatch workaround (runtime is fine)
//   const GoogleMapAny = GoogleMap as any;
//   const MarkerAny = Marker as any;

//   const center = useMemo<LatLng>(() => value ?? { lat: 20.5937, lng: 78.9629 }, [value]);

//   if (loadError) {
//     return (
//       <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-red-600">
//         Google Maps failed to load. Check `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
//       </div>
//     );
//   }

//   if (!isLoaded) {
//     return (
//       <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
//         Loading map…
//       </div>
//     );
//   }

//   return (
//     <div className="rounded-xl overflow-hidden border border-gray-200">
//       <GoogleMapAny
//         center={center}
//         zoom={value ? 13 : 5}
//         mapContainerStyle={{ height, width: '100%' }}
//         options={{
//           streetViewControl: false,
//           mapTypeControl: false,
//           fullscreenControl: false,
//           clickableIcons: false,
//         }}
//         onClick={(e: any) => {
//           const lat = e.latLng?.lat();
//           const lng = e.latLng?.lng();
//           if (lat == null || lng == null) return;
//           onChange({ lat, lng });
//         }}
//       >
//         {value && <MarkerAny position={value} />}
//       </GoogleMapAny>
//     </div>
//   );
// }

