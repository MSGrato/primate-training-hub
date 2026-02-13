import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import DashboardLayout from "./DashboardLayout";

const authMock = vi.hoisted(() => ({
  loading: false,
  session: null as null | { user: { user_metadata?: Record<string, unknown> } },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    loading: authMock.loading,
    session: authMock.session,
  }),
}));

vi.mock("@/components/AppSidebar", () => ({
  AppSidebar: () => <div data-testid="app-sidebar" />,
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: import("react").ReactNode }) => <div>{children}</div>,
  SidebarTrigger: () => <button type="button">trigger</button>,
}));

describe("DashboardLayout", () => {
  it("redirects to reset-password when first-login reset is required", () => {
    authMock.loading = false;
    authMock.session = { user: { user_metadata: { force_password_reset: true } } };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<div>dashboard content</div>} />
          </Route>
          <Route path="/reset-password" element={<div>reset password page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("reset password page")).toBeInTheDocument();
  });

  it("renders dashboard content when reset is not required", () => {
    authMock.loading = false;
    authMock.session = { user: { user_metadata: { force_password_reset: false } } };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<div>dashboard content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("dashboard content")).toBeInTheDocument();
  });
});
