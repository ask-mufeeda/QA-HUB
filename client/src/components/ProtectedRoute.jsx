import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children, roles }) {
  const { user, role, loading, error } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
        <p className="text-sm font-medium text-slate-600">Loading your workspace...</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
        <p role="alert" className="max-w-lg text-center text-sm text-rose-700">
          {error}
        </p>
      </main>
    );
  }

  if (roles && !roles.includes(role)) {
    return <Navigate to="/app" replace />;
  }

  return children;
}
