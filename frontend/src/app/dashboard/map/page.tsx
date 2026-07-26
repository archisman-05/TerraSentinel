'use client';

import DashboardLayout from "@/components/dashboard/DashboardLayout";
import dynamic from "next/dynamic";

const ResourceMap = dynamic(
  () => import("@/components/map/ResourceMap"),
  { ssr: false }
);

export default function LiveMapPage() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-4xl font-bold">
          Disaster Intelligence Map
        </h1>

        <p className="mt-2 text-gray-500">
          Select a location on the map to view environment data and run AI analysis.
        </p>

        <div className="mt-6 h-[calc(100vh-170px)]">
          <ResourceMap />
        </div>
      </div>
    </DashboardLayout>
  );
}