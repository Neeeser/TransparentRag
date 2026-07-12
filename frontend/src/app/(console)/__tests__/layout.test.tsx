import { readFileSync } from "node:fs";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConsoleLayout from "@/app/(console)/layout";
import { makeUser } from "@/test/fixtures";
import { setMockAuth } from "@/test/mocks";
import { getMockRouter, setMockPathname } from "@/test/test-utils";

vi.mock("@/providers/auth-provider", async () => (await import("@/test/mocks")).mockAuth());
vi.mock("@/providers/theme-provider", async () => (await import("@/test/mocks")).mockTheme());

const signOutName = "Sign out";

describe("ConsoleLayout", () => {
  let auth: ReturnType<typeof setMockAuth>;

  beforeEach(() => {
    auth = setMockAuth();
    setMockPathname("/dashboard");
  });

  it("renders both decorative theme marks for pre-paint selection", () => {
    const globalStyles = readFileSync("src/app/globals.css", "utf8");
    const style = document.createElement("style");
    style.textContent = globalStyles.match(/\/\* The no-flash[\s\S]*?(?=\/\* Tailwind)/)?.[0] ?? "";
    expect(style.textContent).toContain(".ragworks-mark-dark");
    document.head.append(style);
    render(<ConsoleLayout>Child</ConsoleLayout>);

    const brandLink = screen.getByText("Control Room").closest("a");
    const marks = brandLink?.querySelectorAll("img") ?? [];

    expect(marks).toHaveLength(2);
    expect(marks[0]).toHaveAttribute("src", "/ragworks-mark-dark.svg");
    expect(marks[1]).toHaveAttribute("src", "/ragworks-mark-light.svg");
    expect(marks[0]).toHaveAttribute("alt", "");
    expect(marks[1]).toHaveAttribute("alt", "");

    document.documentElement.dataset.theme = "dark";
    expect(getComputedStyle(marks[0]).display).toBe("block");
    expect(getComputedStyle(marks[1]).display).toBe("none");

    document.documentElement.dataset.theme = "light";
    expect(getComputedStyle(marks[0]).display).toBe("none");
    expect(getComputedStyle(marks[1]).display).toBe("block");
  });

  it("redirects to sign-in when user is missing", () => {
    setMockAuth({ user: null });
    render(<ConsoleLayout>Child</ConsoleLayout>);

    expect(screen.getByText(/Preparing your workspace/)).toBeInTheDocument();
    expect(getMockRouter().replace).toHaveBeenCalledWith("/auth/sign-in");
  });

  it("renders navigation and toggles the account menu", () => {
    render(<ConsoleLayout>Child</ConsoleLayout>);

    expect(screen.getByText("Control Room")).toBeInTheDocument();
    const avatarButton = screen.getByRole("button", { expanded: false });
    fireEvent.click(avatarButton);
    expect(screen.getByText(signOutName)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Settings"));
    expect(screen.queryByText(signOutName)).not.toBeInTheDocument();

    fireEvent.click(avatarButton);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText(signOutName)).not.toBeInTheDocument();

    fireEvent.click(avatarButton);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText(signOutName)).not.toBeInTheDocument();

    fireEvent.click(avatarButton);
    fireEvent.click(screen.getByText(signOutName));
    expect(auth.signOut).toHaveBeenCalled();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText(signOutName)).not.toBeInTheDocument();
  });

  it("renders avatar fallbacks when profile data is minimal", () => {
    setMockAuth({
      user: makeUser({ id: "", full_name: "", email: "solo@example.com" }),
    });
    render(<ConsoleLayout>Child</ConsoleLayout>);

    expect(screen.getByRole("button", { name: "S" })).toBeInTheDocument();
    expect(screen.getAllByText("solo@example.com").length).toBeGreaterThan(0);
  });

  it("renders chat and pipelines routes with special layout", () => {
    setMockPathname("/chat");
    const { rerender } = render(<ConsoleLayout>Chat Child</ConsoleLayout>);
    expect(screen.getByText("Chat Child")).toBeInTheDocument();

    setMockPathname("/pipelines");
    rerender(<ConsoleLayout>Pipeline Child</ConsoleLayout>);
    expect(screen.getByText("Pipeline Child")).toBeInTheDocument();
  });
});
