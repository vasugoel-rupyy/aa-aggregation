"use client";

import { useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeMs, setTimeMs] = useState<number | null>(null);
  const [responseJson, setResponseJson] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(false);

  async function callAggregator() {
    setLoading(true);
    setError(null);
    setWarning(null);
    setTimeMs(null);
    setResponseJson(null);
    setPdfUrl(null);
    setShowPdf(false);

    const start = performance.now();

    try {
      const res = await fetch("http://localhost:3000/aa/aggregated-response", {
        headers: {
          "Accept-Encoding": "gzip",
        },
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const text = await res.text();
      const end = performance.now();
      setTimeMs(Math.round(end - start));

      try {
        const data = JSON.parse(text);
        setResponseJson(data);

        if (data.document?.downloadUrl) {
          setPdfUrl("http://localhost:3000" + data.document.downloadUrl);
        }
      } catch {
        // 🔑 THIS IS THE FIX
        setWarning(
          "Large streamed response could not be fully parsed in the browser. This is expected. Document download is still available.",
        );

        // Try best-effort extraction of document URL
        const match = text.match(/"downloadUrl"\s*:\s*"([^"]+)"/);
        if (match) {
          setPdfUrl("http://localhost:3000" + match[1]);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl bg-slate-800 rounded-xl shadow-2xl p-6 text-slate-200">
        <h1 className="text-2xl font-semibold mb-4">
          AA Aggregation Demo
        </h1>

        <button
          onClick={callAggregator}
          disabled={loading}
          className={`px-4 py-2 rounded-lg bg-blue-600 text-white mb-4
            ${loading ? "opacity-60 cursor-not-allowed" : "hover:bg-blue-500"}
          `}
        >
          {loading ? "Calling..." : "Call Aggregator API"}
        </button>

        {error && (
          <div className="border border-red-500 text-red-400 rounded-lg p-3 mb-4">
            Error: {error}
          </div>
        )}

        {warning && (
          <div className="border border-yellow-500 text-yellow-300 rounded-lg p-3 mb-4">
            ⚠️ {warning}
          </div>
        )}

        {timeMs !== null && (
          <div className="border border-slate-600 rounded-lg p-3 mb-4">
            <strong>Total Client Time:</strong> {timeMs} ms
          </div>
        )}

        {responseJson && (
          <div className="border border-slate-600 rounded-lg p-3 mb-4">
            <p className="font-medium mb-2">Aggregated Response</p>
            <pre className="max-h-72 overflow-auto bg-slate-950 p-3 rounded text-xs">
              {JSON.stringify(responseJson, null, 2)}
            </pre>
          </div>
        )}

        {pdfUrl && (
          <div className="border border-slate-600 rounded-lg p-3">
            <p className="font-medium mb-2">Document</p>

            {!showPdf ? (
              <button
                onClick={() => setShowPdf(true)}
                className="px-3 py-1 rounded-md border border-blue-500 text-blue-400 hover:bg-blue-500/10"
              >
                Load PDF
              </button>
            ) : (
              <div className="mt-3">
                <iframe
                  src={pdfUrl}
                  className="w-full h-[500px] border border-slate-700 rounded-md"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
