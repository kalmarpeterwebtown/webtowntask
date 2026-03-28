import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthInit } from '@/hooks/useAuth'
import { AuthGuard, AdminGuard } from '@/components/auth/AuthGuard'
import { AppLayout } from '@/components/layout/AppLayout'
import { ClientLayout } from '@/components/layout/ClientLayout'
import { ToastContainer } from '@/components/ui/Toast'

// Pages
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { InvitePage } from '@/pages/InvitePage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProjectListPage } from '@/pages/ProjectListPage'
import { ProjectDashboardPage } from '@/pages/ProjectDashboardPage'
import { BacklogPage } from '@/pages/BacklogPage'
import { BoardPage } from '@/pages/BoardPage'
import { StoryDetailPage } from '@/pages/StoryDetailPage'
import { SprintPage } from '@/pages/SprintPage'
import { ReportPage } from '@/pages/ReportPage'
import { OrgReportPage } from '@/pages/OrgReportPage'
import { TeamListPage } from '@/pages/TeamListPage'
import { TeamSettingsPage } from '@/pages/TeamSettingsPage'
import { ProjectSettingsPage } from '@/pages/ProjectSettingsPage'
import { OrgSettingsPage } from '@/pages/OrgSettingsPage'
import { UserManagementPage } from '@/pages/UserManagementPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { ClientDashboardPage } from '@/pages/ClientDashboardPage'
import { ClientProjectPage } from '@/pages/ClientProjectPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export default function App() {
  useAuthInit()

  return (
    <HashRouter>
      <Routes>
        {/* Publikus oldalak */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/invite" element={<InvitePage />} />

        {/* Védett oldalak */}
        <Route element={<AuthGuard />}>
          {/* Normál app layout */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectListPage />} />
            <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
            <Route path="/projects/:projectId/backlog" element={<BacklogPage />} />
            <Route path="/projects/:projectId/stories/:storyId" element={<StoryDetailPage />} />
            <Route path="/projects/:projectId/reports" element={<ReportPage />} />
            <Route path="/projects/:projectId/settings" element={<ProjectSettingsPage />} />
            <Route path="/teams" element={<TeamListPage />} />
            <Route path="/teams/:teamId/board" element={<BoardPage />} />
            <Route path="/teams/:teamId/sprints" element={<SprintPage />} />
            <Route path="/teams/:teamId/settings" element={<TeamSettingsPage />} />
            <Route path="/settings/profile" element={<ProfilePage />} />

            {/* Admin-only oldalak */}
            <Route element={<AdminGuard />}>
              <Route path="/reports" element={<OrgReportPage />} />
              <Route path="/settings/organization" element={<OrgSettingsPage />} />
              <Route path="/settings/users" element={<UserManagementPage />} />
            </Route>
          </Route>

          {/* Kliens portál layout */}
          <Route element={<ClientLayout />}>
            <Route path="/client" element={<ClientDashboardPage />} />
            <Route path="/client/projects/:projectId" element={<ClientProjectPage />} />
          </Route>
        </Route>

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>

      <ToastContainer />
    </HashRouter>
  )
}
