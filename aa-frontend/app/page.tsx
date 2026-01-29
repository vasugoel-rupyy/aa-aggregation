"use client";

import { useState } from "react";
import { useEffect } from "react";


export default function Home() {
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  if (!showPdf || !pdfUrl || !requestId) return;

  const timer = setTimeout(() => {
    fetch("http://localhost:3000/client/render-success", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    }).catch(() => {});
  }, 1000); // wait to ensure render

  return () => clearTimeout(timer);
}, [showPdf, pdfUrl, requestId]);

  function reportPdfError(type: string) {
    fetch("http://localhost:3000/client/error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        errorType: type,
        meta: {
          url: pdfUrl,
          userAgent: navigator.userAgent,
        },
      }),
    }).catch(() => {});
  }

  async function callAggregator() {
    setLoading(true);
    setShowPdf(false);
    setPdfUrl(null);
    setRequestId(null);

    const res = await fetch("http://localhost:3000/aa/aggregated-response", {
      cache: "no-store",
    });

    const text = await res.text();
    const match = text.match(/"downloadUrl"\s*:\s*"([^"]+)"/);

    if (match) {
      const fullUrl = "http://localhost:3000" + match[1];
      setPdfUrl(fullUrl);

      const idMatch = fullUrl.match(/requestId=([^&]+)/);
      if (idMatch) setRequestId(idMatch[1]);
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-slate-900 rounded-xl p-6 text-slate-200">
        <button
          onClick={callAggregator}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 rounded-lg mb-4"
        >
          {loading ? "Processing…" : "Call Aggregator"}
        </button>

        {pdfUrl && !showPdf && (
          <button
            onClick={() => setShowPdf(true)}
            className="px-3 py-1 rounded border border-blue-500 text-blue-400"
          >
            Open PDF
          </button>
        )}

        {showPdf && pdfUrl && (
          <iframe
            key={pdfUrl}
            src={pdfUrl}
            onError={() => {
              setError("Failed to load PDF");
              reportPdfError("IFRAME_RENDER_FAILURE");
            }}
            className="w-full h-[520px] rounded-lg border border-slate-800 bg-slate-900"
          />
        )}
      </div>
    </div>
  );
}
