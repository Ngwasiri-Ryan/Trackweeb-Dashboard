import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { searchShipments } from "@/lib/dashboard-service";
import { brand } from "@/lib/brand";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/shipments", label: "Shipments" },
  { to: "/shipments/new", label: "New shipment" },
  { to: "/live-map", label: "Live map" },
  { to: "/routes", label: "Routes" },
  { to: "/scan", label: "Scan" },
  { to: "/api-keys", label: "API keys" },
  { to: "/settings", label: "Settings" },
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; tracking_code: string }[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => void searchShipments(q).then(setResults), 200);
    return () => clearTimeout(t);
  }, [q]);

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>{brand.adminTitle}</h1>
        <div style={{ padding: "0 16px 12px" }}>
          <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%" }} />
          {results.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #ddd", marginTop: 4 }}>
              {results.map((r) => (
                <Link key={r.id} to={`/shipments/${r.id}`} onClick={() => setQ("")} style={{ display: "block", padding: "6px 8px", fontSize: 12 }}>
                  {r.tracking_code}
                </Link>
              ))}
            </div>
          )}
        </div>
        <nav>
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={location.pathname === l.to || (l.to !== "/" && location.pathname.startsWith(l.to)) ? "active" : ""}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: "16px" }}>
          <button type="button" className="btn" onClick={() => void logout()}>Log out</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
