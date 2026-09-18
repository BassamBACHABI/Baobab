import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

import ClientLayout from "@/components/layout/ClientLayout";
import AdminLayout from "@/components/layout/AdminLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AuthCallback from "@/components/auth/AuthCallback";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import ClientHome from "@/pages/client/ClientHome";
import ClientParcels from "@/pages/client/ClientParcels";
import ClientShipments from "@/pages/client/ClientShipments";
import ClientProfile from "@/pages/client/ClientProfile";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminClients from "@/pages/admin/AdminClients";
import AdminParcels from "@/pages/admin/AdminParcels";
import AdminShipments from "@/pages/admin/AdminShipments";
import AdminSettings from "@/pages/admin/AdminSettings";

function AppRoutes() {
  const location = useLocation();

  // Détection du retour OAuth Google (fragment #session_id=...) — lu depuis useLocation().hash
  if (location.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/client" element={<ClientLayout />}>
          <Route index element={<ClientHome />} />
          <Route path="parcels" element={<ClientParcels />} />
          <Route path="shipments" element={<ClientShipments />} />
          <Route path="profile" element={<ClientProfile />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requireStaff />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="clients" element={<AdminClients />} />
          <Route path="parcels" element={<AdminParcels />} />
          <Route path="shipments" element={<AdminShipments />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
            <InstallPrompt />
            <Toaster position="top-center" richColors />
          </AuthProvider>
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}

export default App;
