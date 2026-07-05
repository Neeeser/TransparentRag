import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignInPage from "@/app/auth/sign-in/page";
import { setMockAuth } from "@/test/mocks";
import { getMockRouter } from "@/test/test-utils";

const loginEmail = "user@example.com";
const loginPassword = "password123";
const emailLabel = "Email";
const passwordLabel = "Password";
const enterDashboardLabel = "Enter dashboard";
const createWorkspaceLabel = "Create workspace";

vi.mock("@/providers/auth-provider", async () => (await import("@/test/mocks")).mockAuth());
vi.mock("@/lib/api", async () => (await import("@/test/mocks")).mockApi());

describe("SignInPage", () => {
  let auth: ReturnType<typeof setMockAuth>;

  beforeEach(() => {
    auth = setMockAuth();
  });

  it("submits login and redirects", async () => {
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(emailLabel), { target: { value: loginEmail } });
    fireEvent.change(screen.getByLabelText(passwordLabel), { target: { value: loginPassword } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: enterDashboardLabel }));
    });

    expect(auth.signIn).toHaveBeenCalledWith(loginEmail, loginPassword);
    expect(getMockRouter().push).toHaveBeenCalledWith("/dashboard");
  });

  it("handles registration flow and toggles back to login", async () => {
    render(<SignInPage />);

    fireEvent.click(screen.getByText("Need an account?"));
    fireEvent.change(screen.getByLabelText(emailLabel), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "New User" } });
    fireEvent.change(screen.getByLabelText(passwordLabel), { target: { value: loginPassword } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: createWorkspaceLabel }));
    });

    await waitFor(() => {
      expect(screen.getByText("Workspace created. You can sign in now.")).toBeInTheDocument();
    });
    expect(screen.getByText(enterDashboardLabel)).toBeInTheDocument();
  });

  it("shows errors when submit fails", async () => {
    auth.signIn.mockRejectedValueOnce(new Error("Failed"));
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(emailLabel), { target: { value: loginEmail } });
    fireEvent.change(screen.getByLabelText(passwordLabel), { target: { value: loginPassword } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: enterDashboardLabel }));
    });

    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("shows fallback errors and toggles modes", async () => {
    auth.signIn.mockRejectedValueOnce("Failed");
    render(<SignInPage />);

    fireEvent.click(screen.getByText("Need an account?"));
    expect(screen.getByRole("button", { name: createWorkspaceLabel })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Already have access?"));
    expect(screen.getByText(enterDashboardLabel)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(emailLabel), { target: { value: loginEmail } });
    fireEvent.change(screen.getByLabelText(passwordLabel), { target: { value: loginPassword } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: enterDashboardLabel }));
    });

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
  });
});
