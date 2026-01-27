import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import MaquinistasPage from "./pages/MaquinistasPage";
import MaquinistaDetailPage from "./pages/MaquinistaDetailPage";
import CertificacionesPage from "./pages/CertificacionesPage";
import PE1603Page from "./pages/PE1603Page";
import PE1201Page from "./pages/PE1201Page";
import AdminPage from "./pages/AdminPage";
import PartesPage from "./pages/PartesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/maquinistas" element={
              <ProtectedRoute>
                <MaquinistasPage />
              </ProtectedRoute>
            } />
            <Route path="/maquinistas/:id" element={
              <ProtectedRoute>
                <MaquinistaDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/certificaciones" element={
              <ProtectedRoute>
                <CertificacionesPage />
              </ProtectedRoute>
            } />
            <Route path="/pe-1603" element={
              <ProtectedRoute>
                <PE1603Page />
              </ProtectedRoute>
            } />
            <Route path="/pe-1201" element={
              <ProtectedRoute>
                <PE1201Page />
              </ProtectedRoute>
            } />
            <Route path="/partes" element={
              <ProtectedRoute>
                <PartesPage />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <AdminPage />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
