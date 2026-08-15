import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Job } from "@/lib/types";

// JobPowerToolsModal pulls in motion/react, ProfileContext and fetch-backed AI
// tool calls — none of that is relevant to JobCard's own behavior, so it's
// replaced with a minimal stand-in that still lets us assert JobCard wires
// `showAnalysis` state and the `onClose` callback correctly.
vi.mock("@/components/JobPowerToolsModal", () => ({
  default: ({ job, onClose }: { job: Job; onClose: () => void }) => (
    <div data-testid="power-tools-modal">
      <span>Analysis for {job.title}</span>
      <button type="button" onClick={onClose}>
        close-modal
      </button>
    </div>
  ),
}));

vi.mock("@/lib/profile", () => ({
  getSavedJobIds: vi.fn(),
  toggleSavedJob: vi.fn(),
}));

import { getSavedJobIds, toggleSavedJob } from "@/lib/profile";
import JobCard from "./JobCard";

const mockGetSavedJobIds = vi.mocked(getSavedJobIds);
const mockToggleSavedJob = vi.mocked(toggleSavedJob);

const baseJob: Job = {
  id: "job-42",
  title: "Senior Backend Engineer",
  organization: "Acme Corp",
  location: "Berlin, Germany",
  workMode: "Remote",
  salaryMin: 90000,
  salaryMax: 120000,
  currency: "USD",
  experienceRequired: 5,
  technologies: ["Python", "PostgreSQL", "AWS", "Docker", "Kafka"],
  description: "Own the payments platform backend.",
  careerPageLink: "https://acme.example/careers",
  applicationLink: "https://acme.example/careers/job-42",
  verificationStatus: "VERIFIED",
  postedDate: "2026-08-01",
  matchReasons: ["Strong Python match", "Salary in range"],
  fitScore: 88,
  levelUp: false,
  source: "LinkedIn",
};

beforeEach(() => {
  mockGetSavedJobIds.mockReturnValue([]);
  mockToggleSavedJob.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("JobCard", () => {
  it("renders the job title and organization", () => {
    render(<JobCard job={baseJob} />);
    expect(screen.getByRole("heading", { name: "Senior Backend Engineer" })).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("exposes the whole card as a keyboard-focusable button with an accessible label", () => {
    render(<JobCard job={baseJob} />);
    const card = screen.getByRole("button", { name: "Senior Backend Engineer at Acme Corp" });
    expect(card).toHaveAttribute("tabindex", "0");
  });

  it("calls onSelect with the job when the card is clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<JobCard job={baseJob} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "Senior Backend Engineer at Acme Corp" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(baseJob);
  });

  it("calls onSelect when Enter is pressed on the card", () => {
    const onSelect = vi.fn();
    render(<JobCard job={baseJob} onSelect={onSelect} />);
    const card = screen.getByRole("button", { name: "Senior Backend Engineer at Acme Corp" });

    const notCancelled = fireEvent.keyDown(card, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(baseJob);
    expect(notCancelled).toBe(true); // Enter does not call preventDefault
  });

  it("calls onSelect and prevents default when Space is pressed on the card", () => {
    const onSelect = vi.fn();
    render(<JobCard job={baseJob} onSelect={onSelect} />);
    const card = screen.getByRole("button", { name: "Senior Backend Engineer at Acme Corp" });

    const notCancelled = fireEvent.keyDown(card, { key: " " });

    expect(onSelect).toHaveBeenCalledWith(baseJob);
    expect(notCancelled).toBe(false); // Space is prevented so the page doesn't scroll
  });

  it("ignores Enter/Space that bubbles up from a nested control instead of the card itself", () => {
    const onSelect = vi.fn();
    render(<JobCard job={baseJob} onSelect={onSelect} />);
    const aiButton = screen.getByRole("button", { name: "Run AI analysis for Senior Backend Engineer" });

    fireEvent.keyDown(aiButton, { key: "Enter" });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows the Verified badge for a verified job and Unverified otherwise", () => {
    const { rerender } = render(<JobCard job={baseJob} />);
    expect(screen.getByText("Verified")).toBeInTheDocument();

    rerender(<JobCard job={{ ...baseJob, verificationStatus: "UNVERIFIED" }} />);
    expect(screen.getByText("Unverified")).toBeInTheDocument();
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
  });

  describe("save toggle", () => {
    it("has aria-pressed=false when the job is not saved, and does not bubble to onSelect", async () => {
      mockGetSavedJobIds.mockReturnValue([]);
      const onSelect = vi.fn();
      const user = userEvent.setup();
      render(<JobCard job={baseJob} onSelect={onSelect} />);

      const saveButton = screen.getByRole("button", { name: "Save Senior Backend Engineer" });
      expect(saveButton).toHaveAttribute("aria-pressed", "false");

      await user.click(saveButton);

      expect(mockToggleSavedJob).toHaveBeenCalledWith("job-42");
      expect(onSelect).not.toHaveBeenCalled(); // click must not bubble to the card
    });

    it("has aria-pressed=true when the job is already saved, and flips to false on click", async () => {
      mockGetSavedJobIds.mockReturnValue(["job-42"]);
      mockToggleSavedJob.mockReturnValue(false);
      const user = userEvent.setup();
      render(<JobCard job={baseJob} />);

      const saveButton = screen.getByRole("button", {
        name: "Remove Senior Backend Engineer from saved jobs",
      });
      expect(saveButton).toHaveAttribute("aria-pressed", "true");

      await user.click(saveButton);

      expect(mockToggleSavedJob).toHaveBeenCalledWith("job-42");
      expect(screen.getByRole("button", { name: "Save Senior Backend Engineer" })).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    });
  });

  describe("AI analysis modal", () => {
    it("opens JobPowerToolsModal on AI click and closes it via its onClose callback", async () => {
      const user = userEvent.setup();
      render(<JobCard job={baseJob} />);

      expect(screen.queryByTestId("power-tools-modal")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Run AI analysis for Senior Backend Engineer" }));
      expect(screen.getByTestId("power-tools-modal")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "close-modal" }));
      expect(screen.queryByTestId("power-tools-modal")).not.toBeInTheDocument();
    });
  });
});
