'use client';

import { useState } from 'react';
import {
  BrainCircuit,
  AlertTriangle,
  Users,
  HeartPulse,
  Package,
  ShipWheel,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import axios from 'axios';

export default function DisasterAnalysis() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  async function analyze() {
    setLoading(true);

    try {
      const res = await axios.post(
        'http://localhost:8080/api/disaster/analyze',
        {
          lat: 22.5726,
          lng: 88.3639,
        }
      );

      setAnalysis(res.data.ai);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const getColor = () => {
    if (!analysis) return 'bg-gray-200';

    if (analysis.riskScore < 25) return 'bg-green-500';
    if (analysis.riskScore < 50) return 'bg-yellow-500';
    if (analysis.riskScore < 75) return 'bg-orange-500';

    return 'bg-red-500';
  };

  const getBadge = () => {
    if (!analysis) return 'LOW';

    if (analysis.riskScore < 25) return 'LOW';
    if (analysis.riskScore < 50) return 'MEDIUM';
    if (analysis.riskScore < 75) return 'HIGH';

    return 'CRITICAL';
  };

  return (
    <div className="rounded-3xl bg-white shadow-lg border p-8">

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-3">

          <BrainCircuit className="text-indigo-600" size={30} />

          <div>
            <h2 className="text-2xl font-bold">
              AI Disaster Intelligence
            </h2>

            <p className="text-gray-500 text-sm">
              Real-time environmental risk analysis
            </p>
          </div>

        </div>

        <button
          onClick={analyze}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 transition text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2"
        >

          {loading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Analysing...
            </>
          ) : (
            <>
              <AlertTriangle size={18} />
              Analyse Disaster
            </>
          )}

        </button>

      </div>

      {analysis && (

        <div className="mt-10 grid lg:grid-cols-3 gap-8">

          {/* LEFT */}

          <div>

            <p className="text-gray-500">
              Risk Score
            </p>

            <h1 className="text-6xl font-black">
              {analysis.riskScore}
            </h1>

            <div className="mt-5 h-4 bg-gray-200 rounded-full overflow-hidden">

              <div
                className={`${getColor()} h-full transition-all duration-700`}
                style={{
                  width: `${analysis.riskScore}%`,
                }}
              />

            </div>

            <div
              className={`mt-5 inline-flex px-4 py-2 rounded-full text-white font-bold ${getColor()}`}
            >
              {getBadge()}
            </div>

            <div className="mt-6">

              <p className="text-gray-500">
                Disaster Type
              </p>

              <h3 className="text-2xl font-bold">
                {analysis.disasterType}
              </h3>

            </div>

          </div>

          {/* CENTER */}

          <div>

            <h3 className="font-bold text-xl mb-4">
              Recommended Resources
            </h3>

            <div className="space-y-4">

              <Resource
                icon={<Users size={18} />}
                title="Volunteers"
                value={analysis.recommendedVolunteers}
              />

              <Resource
                icon={<HeartPulse size={18} />}
                title="Medical Teams"
                value={analysis.recommendedMedicalTeams}
              />

              <Resource
                icon={<Package size={18} />}
                title="Food Kits"
                value={analysis.recommendedFoodKits}
              />

              <Resource
                icon={<ShipWheel size={18} />}
                title="Rescue Boats"
                value={analysis.recommendedBoats}
              />

            </div>

          </div>

          {/* RIGHT */}

          <div>

            <div className="flex items-center gap-2 mb-4">

              <ShieldAlert className="text-indigo-600" />

              <h3 className="font-bold text-xl">
                AI Summary
              </h3>

            </div>

            <div className="bg-indigo-50 rounded-2xl p-5">

              <p className="text-gray-700 leading-7">
                {analysis.summary}
              </p>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

function Resource({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-4">

      <div className="flex items-center gap-3">

        {icon}

        <span>{title}</span>

      </div>

      <span className="font-bold text-xl">
        {value}
      </span>

    </div>
  );
}