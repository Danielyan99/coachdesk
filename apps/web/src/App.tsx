import { Route, Routes } from 'react-router';
import { RequireRole } from './components/RequireRole';
import { InvitePage } from './pages/auth/InvitePage';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { ClientHomePage } from './pages/client/ClientHomePage';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PricingPage } from './pages/PricingPage';
import { ClientDetailPage } from './pages/trainer/ClientDetailPage';
import { DashboardPage } from './pages/trainer/DashboardPage';
import { PlanEditorPage } from './pages/trainer/PlanEditorPage';
import { TemplateEditorPage } from './pages/trainer/TemplateEditorPage';
import { TemplatesPage } from './pages/trainer/TemplatesPage';
import { TrainerLayout } from './pages/trainer/TrainerLayout';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />

      <Route
        path="/app"
        element={
          <RequireRole role="trainer">
            <TrainerLayout />
          </RequireRole>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="clients/:id/plan" element={<PlanEditorPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="templates/new" element={<TemplateEditorPage />} />
        <Route path="templates/:id" element={<TemplateEditorPage />} />
      </Route>

      <Route
        path="/me/*"
        element={
          <RequireRole role="client">
            <ClientHomePage />
          </RequireRole>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
