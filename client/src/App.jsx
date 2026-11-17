import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";

const AdminPage = lazy(() => import("./pages/AdminPage.jsx"));
const ApiTestingPage = lazy(() => import("./pages/ApiTestingPage.jsx"));
const BugsPage = lazy(() => import("./pages/BugsPage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const DeveloperDashboardPage = lazy(
  () => import("./pages/DeveloperDashboardPage.jsx"),
);
const ManualTestingPage = lazy(() => import("./pages/ManualTestingPage.jsx"));
const AutomationTestingPage = lazy(
  () => import("./pages/AutomationTestingPage.jsx"),
);
const ResourcesPage = lazy(() => import("./pages/ResourcesPage.jsx"));
const SqlPracticePage = lazy(() => import("./pages/SqlPracticePage.jsx"));
const TestGeneratorPage = lazy(() => import("./pages/TestGeneratorPage.jsx"));
const TestManagementPage = lazy(() => import("./pages/TestManagementPage.jsx"));
const WorkspacePage = lazy(() => import("./pages/WorkspacePage.jsx"));

const pageTitles = {
  "/": "Home",
  "/login": "Sign in",
  "/register": "Create account",
  "/reset-password": "Reset password",
  "/app": "Workspace",
  "/dashboard": "Dashboard",
  "/manual-testing": "Manual testing",
  "/automation-testing": "Automation testing",
  "/bugs": "Bug tracker",
  "/api-testing": "API testing",
  "/sql-practice": "SQL practice",
  "/resources": "Resources",
  "/test-generator-check": "Test generator",
  "/test-management": "Test management",
  "/admin": "Admin",
  "/developer-dashboard": "Developer dashboard",
};

export default function App() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = `${pageTitles[pathname] ?? "QA Hub"} | QA Hub`;
  }, [pathname]);

  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-600">
          Loading page...
        </main>
      }
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/app" element={<WorkspacePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/manual-testing" element={<ManualTestingPage />} />
          <Route
            path="/automation-testing"
            element={<AutomationTestingPage />}
          />
          <Route path="/bugs" element={<BugsPage />} />
          <Route path="/api-testing" element={<ApiTestingPage />} />
          <Route path="/sql-practice" element={<SqlPracticePage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/test-generator-check" element={<TestGeneratorPage />} />
          <Route path="/test-management" element={<TestManagementPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/developer-dashboard"
            element={
              <ProtectedRoute roles={["developer"]}>
                <DeveloperDashboardPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
