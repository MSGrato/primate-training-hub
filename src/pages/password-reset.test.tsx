import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";

const mocks = vi.hoisted(() => ({
  updatePassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  toast: vi.fn(),
  navigate: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    updatePassword: mocks.updatePassword,
    requestPasswordReset: mocks.requestPasswordReset,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

describe("password reset pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });

    mocks.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
  });

  it("shows error when new password is too short", async () => {
    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    await screen.findByLabelText("New Password");

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(mocks.updatePassword).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Password too short" })
    );
  });

  it("shows error when passwords do not match", async () => {
    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    await screen.findByLabelText("New Password");

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(mocks.updatePassword).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Passwords do not match" })
    );
  });

  it("shows error when password is missing uppercase, number, or symbol", async () => {
    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    await screen.findByLabelText("New Password");

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "alllowercasepassword" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "alllowercasepassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(mocks.updatePassword).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Password is too weak" })
    );
  });

  it("updates password and redirects when input is valid", async () => {
    mocks.updatePassword.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    await screen.findByLabelText("New Password");

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "Valid-password-123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "Valid-password-123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => {
      expect(mocks.updatePassword).toHaveBeenCalledWith("Valid-password-123!");
    });

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Password updated" })
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("submits forgot-password request for provided email", async () => {
    mocks.requestPasswordReset.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " user@uw.edu " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));

    await waitFor(() => {
      expect(mocks.requestPasswordReset).toHaveBeenCalledWith("user@uw.edu");
    });

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Check your email" })
    );
  });
});
