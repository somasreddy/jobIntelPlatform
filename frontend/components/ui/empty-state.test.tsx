import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Briefcase, Plus } from "lucide-react";
import { EmptyState } from "./empty-state";

afterEach(() => {
  cleanup();
});

describe("EmptyState", () => {
  it("renders the icon, title and description", () => {
    const { container } = render(
      <EmptyState icon={Briefcase} title="No jobs yet" description="Try adjusting your filters." />
    );

    expect(screen.getByText("No jobs yet")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your filters.")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("omits the icon wrapper and description when they are not provided", () => {
    const { container } = render(<EmptyState title="Nothing here" />);

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    // Only the title paragraph should be rendered, no description paragraph.
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("renders the action as a Link when action.href is provided", () => {
    render(<EmptyState title="No results" action={{ label: "Browse jobs", href: "/jobs" }} />);

    const link = screen.getByRole("link", { name: "Browse jobs" });
    expect(link).toHaveAttribute("href", "/jobs");
  });

  it("renders the action as a button and fires onClick when no href is provided", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<EmptyState title="No results" action={{ label: "Retry", onClick }} />);

    const button = screen.getByRole("button", { name: "Retry" });
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders the action icon alongside its label", () => {
    render(<EmptyState title="No results" action={{ label: "Add one", icon: Plus }} />);

    const button = screen.getByRole("button", { name: "Add one" });
    expect(button.querySelector("svg")).toBeInTheDocument();
  });

  it("renders custom children instead of the declarative action when both are given", () => {
    render(
      <EmptyState title="No results" action={{ label: "Should not render" }}>
        <button type="button">Custom CTA</button>
      </EmptyState>
    );

    expect(screen.getByRole("button", { name: "Custom CTA" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Should not render" })).not.toBeInTheDocument();
  });
});
