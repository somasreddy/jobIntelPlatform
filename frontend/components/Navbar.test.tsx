import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Navbar pulls in several app-wide contexts (routing, profile, theme, auth)
// plus two independent components (ThemeSelector, NotificationBell) that
// each do their own data fetching. Those are stubbed so this file can test
// Navbar's own rendering/toggle logic in isolation, while still exercising
// real behavior: which groups are open, aria-expanded state, the mobile menu
// toggle, and the signed-in/signed-out footer.
const navMocks = vi.hoisted(() => ({
  pathname: "/jobs",
  push: vi.fn(),
  profile: null as { name: string } | null,
  user: null as { name: string } | null,
  logout: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navMocks.pathname,
  useRouter: () => ({ push: navMocks.push }),
}));

vi.mock("@/lib/ProfileContext", () => ({
  useProfile: () => ({ profile: navMocks.profile }),
}));

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "executive", setTheme: vi.fn() }),
}));

vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({ user: navMocks.user, logout: navMocks.logout }),
}));

vi.mock("@/components/ThemeSelector", () => ({
  default: () => null,
}));

vi.mock("@/components/NotificationBell", () => ({
  default: () => <div data-testid="notification-bell-stub" />,
}));

import Navbar from "./Navbar";

beforeEach(() => {
  navMocks.pathname = "/jobs";
  navMocks.profile = null;
  navMocks.user = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Navbar", () => {
  it("renders the pinned home item and every nav group label", () => {
    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Command Center" })).toBeInTheDocument();
    for (const label of ["Discover", "Apply", "Prepare", "Grow", "Insights"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("auto-expands only the group containing the active route", () => {
    navMocks.pathname = "/jobs"; // belongs to the "Discover" group
    render(<Navbar />);

    // Discover is open, so its item is rendered.
    expect(screen.getByRole("link", { name: "Find Jobs" })).toBeInTheDocument();

    // Apply is collapsed by default on this route.
    expect(screen.getByRole("button", { name: "Expand Apply section" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Pipeline" })).not.toBeInTheDocument();
  });

  it("expands and collapses a group when its header is clicked", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    const applyToggle = screen.getByRole("button", { name: "Expand Apply section" });
    expect(applyToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Campaign" })).not.toBeInTheDocument();

    await user.click(applyToggle);
    expect(applyToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Campaign" })).toBeInTheDocument();

    await user.click(applyToggle);
    expect(applyToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Campaign" })).not.toBeInTheDocument();
  });

  it("toggles the mobile sidebar open via the header button and closed via the sidebar's close button", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    const aside = screen.getByRole("complementary");
    expect(aside.className).toContain("-translate-x-full");

    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));
    expect(aside.className).not.toContain("-translate-x-full");

    await user.click(screen.getByRole("button", { name: "Close navigation menu" }));
    expect(aside.className).toContain("-translate-x-full");
  });

  it("closes the mobile sidebar when the backdrop overlay is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<Navbar />);

    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const aside = screen.getByRole("complementary");
    expect(aside.className).not.toContain("-translate-x-full");

    const backdrop = container.querySelector(".z-40.bg-black\\/60");
    expect(backdrop).not.toBeNull();
    await user.click(backdrop as Element);

    expect(aside.className).toContain("-translate-x-full");
  });

  it("shows a Sign In link when no user is present", () => {
    navMocks.user = null;
    render(<Navbar />);
    expect(screen.getByRole("link", { name: /Sign In/i })).toBeInTheDocument();
  });

  it("shows the signed-in user's initials and signs out via the footer button", async () => {
    navMocks.user = { name: "Jane Doe" };
    const user = userEvent.setup();
    render(<Navbar />);

    expect(screen.getByText("JD")).toBeInTheDocument();
    expect(screen.getByText("Signed in")).toBeInTheDocument();

    await user.click(screen.getByTitle("Sign out"));

    expect(navMocks.logout).toHaveBeenCalledTimes(1);
    expect(navMocks.push).toHaveBeenCalledWith("/login");
  });
});
