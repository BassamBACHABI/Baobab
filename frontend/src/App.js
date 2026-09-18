import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

import ClientLayout from "@/components/layout/ClientLayout";
import AdminLayout from "@/components/layout/AdminLayout";

import Landing from "@/pages/Landing";
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

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />

            <Route path="/client" element={<ClientLayout />}>
              <Route index element={<ClientHome />} />
              <Route path="parcels" element={<ClientParcels />} />
              <Route path="shipments" element={<ClientShipments />} />
              <Route path="profile" element={<ClientProfile />} />
            </Route>

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="parcels" element={<AdminParcels />} />
              <Route path="shipments" element={<AdminShipments />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          <InstallPrompt />
          <Toaster position="top-center" richColors />
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}

export default App;
