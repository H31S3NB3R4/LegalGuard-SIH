"use client";

import { useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const bannerStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 9999,
  padding: "8px 16px",
  textAlign: "center",
  fontSize: "13px",
  fontWeight: 600,
  color: "#fff",
  background: "#b45309",
  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
};

export default function DemoBanner() {
  const [backendUp, setBackendUp] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`, {
          cache: "no-store",
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setBackendUp(true);
          setDemoMode(Boolean(data.demo_mode));
        }
      } catch {
        if (!cancelled) setBackendUp(false);
      }
    }

    check();
    const id = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!backendUp) {
    return (
      <div style={bannerStyle}>
        Backend offline — check that the LegalGuard server is running on{" "}
        {API_BASE_URL}
      </div>
    );
  }

  if (!demoMode) return null;

  return (
    <div style={bannerStyle}>
      DEMO MODE — AI compliance & allowed-rule engine are disabled. Set
      GOOGLE_API_KEY in the backend .env to enable real analysis.
    </div>
  );
}
