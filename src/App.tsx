import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

// Pages
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import MaquinistasPage from "./pages/MaquinistasPage";
import MaquinistaDetailPage from "./pages/MaquinistaDetailPage";
import CompetenciasPage from "./pages/CompetenciasPage";
import PE1603Page from "./pages/PE1603Page";
import PE1201Page from "./pages/PE1201Page";
import AdminPage from "./pages/AdminPage";
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
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/maquinistas" element={<MaquinistasPage />} />
            <Route path="/maquinistas/:id" element={<MaquinistaDetailPage />} />
            <Route path="/competencias" element={<CompetenciasPage />} />
            <Route path="/pe-1603" element={<PE1603Page />} />
            <Route path="/pe-1201" element={<PE1201Page />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
