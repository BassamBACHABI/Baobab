import { Navigate, Outlet } from "react-router-dom";
import { useAuth, isStaff } from "@/context/AuthContext";
import { BrandLoader } from "@/components/common/BrandLoader";

export default function ProtectedRoute({ requireStaff = false }) {
  const { user } = useAuth();

  if (user === undefined) return <BrandLoader label="Vérification de la session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (requireStaff && !isStaff(user)) return <Navigate to="/client" replace />;

  return <Outlet />;
}
