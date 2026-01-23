"use client";

import { useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeMs, setTimeMs] = useState<number | null>(null);
  const [responseJson, setResponseJson] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(false);

  async function callAggregator() {
    setLoading(true);
    setError(null);
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

      const data = await res.json();

      const end = performance.now();

      setTimeMs(Math.round(end - start));
      setResponseJson(data);

      // Extract PDF URL if present
      if (data.document?.downloadUrl) {
        setPdfUrl("http://localhost:3000" + data.document.downloadUrl);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>AA Aggregation Demo</h1>

        <button
          onClick={callAggregator}
          disabled={loading}
          style={{
            ...styles.button,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Calling..." : "Call Aggregator API"}
        </button>

        {/* Error */}
        {error && (
          <div style={{ ...styles.section, borderColor: "#ff4d4f" }}>
            <p style={{ color: "#ff4d4f" }}>Error: {error}</p>
          </div>
        )}

        {/* Stats */}
        {timeMs !== null && (
          <div style={styles.section}>
            <p>
              <strong>Total Client Time:</strong> {timeMs} ms
            </p>
          </div>
        )}

        {/* JSON Viewer */}
        {responseJson && (
          <div style={styles.section}>
            <p style={{ marginBottom: 8 }}>
              <strong>Aggregated Response</strong>
            </p>
            <pre style={styles.pre}>
              {JSON.stringify(responseJson, null, 2)}
            </pre>
          </div>
        )}

        {/* PDF Loader */}
        {pdfUrl && (
          <div style={styles.section}>
            <p style={{ marginBottom: 8 }}>
              <strong>Document</strong>
            </p>

            {!showPdf && (
              <button
                onClick={() => setShowPdf(true)}
                style={styles.secondaryButton}
              >
                Load PDF
              </button>
            )}

            {showPdf && (
              <div style={{ marginTop: 12 }}>
                <iframe
                  src={pdfUrl}
                  width="100%"
                  height="500px"
                  style={{ border: "1px solid #374151", borderRadius: 6 }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 1000,
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
    color: "#e5e7eb",
  },
  title: {
    fontSize: 26,
    marginBottom: 16,
  },
  button: {
    padding: "10px 16px",
    fontSize: 16,
    borderRadius: 8,
    border: "none",
    backgroundColor: "#2563eb",
    color: "white",
    marginBottom: 16,
  },
  secondaryButton: {
    padding: "8px 14px",
    fontSize: 14,
    borderRadius: 6,
    border: "1px solid #2563eb",
    backgroundColor: "transparent",
    color: "#60a5fa",
    cursor: "pointer",
  },
  section: {
    border: "1px solid #374151",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  pre: {
    maxHeight: "300px",
    overflow: "auto",
    backgroundColor: "#020617",
    padding: 12,
    borderRadius: 6,
    fontSize: 12,
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
  },
};
