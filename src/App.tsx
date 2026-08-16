import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import LoginPage from "@/pages/Login";
import DashboardPage from "@/pages/Dashboard";
import ShipmentsPage from "@/pages/Shipments";
import ShipmentNewPage from "@/pages/ShipmentNew";
import ShipmentDetailPage from "@/pages/ShipmentDetail";
import ShipmentEditPage from "@/pages/ShipmentEdit";
import LiveMapPage from "@/pages/LiveMap";
import RoutesPage from "@/pages/Routes";
import ScanPage from "@/pages/Scan";
import ApiKeysPage from "@/pages/ApiKeys";
import SettingsPage from "@/pages/Settings";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!authed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setLoading(false);
    });
  }, []);

  if (loading) return null;
  if (authed) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AuthLayout() {
  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  );
}

export default function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<AuthLayout />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="shipments" element={<ShipmentsPage />} />
        <Route path="shipments/new" element={<ShipmentNewPage />} />
        <Route path="shipments/scan" element={<ScanPage />} />
        <Route path="shipments/:id/edit" element={<ShipmentEditPage />} />
        <Route path="shipments/:id" element={<ShipmentDetailPage />} />
        <Route path="live-map" element={<LiveMapPage />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="api-keys" element={<ApiKeysPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
