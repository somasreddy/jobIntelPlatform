// Real-behavior tests for AnimatedStat. The "motion/react" `animate()` call is
// mocked at the module boundary (jsdom has no reliable rAF-driven animation
// timing), but everything AnimatedStat itself does — wiring the target value
// and duration into `animate`, formatting each reported frame, writing it to
// the DOM via the ref, and cleaning up on unmount/re-run — is exercised for
// real.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

const motionMocks = vi.hoisted(() => ({
  animateMock: vi.fn(),
  stopMock: vi.fn(),
  captured: { onUpdate: undefined as ((latest: number) => void) | undefined },
}));

vi.mock("motion/react", () => ({
  useMotionValue: (initial: number) => initial,
  animate: (
    _value: unknown,
    target: number,
    options: { duration: number; ease: string; onUpdate: (n: number) => void }
  ) => {
    motionMocks.animateMock(_value, target, options);
    motionMocks.captured.onUpdate = options.onUpdate;
    return { stop: motionMocks.stopMock };
  },
}));

import AnimatedStat from "./AnimatedStat";

afterEach(() => {
  cleanup();
  motionMocks.animateMock.mockClear();
  motionMocks.stopMock.mockClear();
  motionMocks.captured.onUpdate = undefined;
});

describe("AnimatedStat", () => {
  it("renders the initial value before the animation reports any progress", () => {
    const { container } = render(<AnimatedStat value={2450} />);
    expect(container.querySelector("span")).toHaveTextContent("0");
  });

  it("calls motion's animate toward the target value with the configured duration", () => {
    render(<AnimatedStat value={87} duration={1.2} />);

    expect(motionMocks.animateMock).toHaveBeenCalledTimes(1);
    const [, target, options] = motionMocks.animateMock.mock.calls[0];
    expect(target).toBe(87);
    expect(options.duration).toBe(1.2);
    expect(options.ease).toBe("easeOut");
  });

  it("uses the default duration of 0.7s when none is provided", () => {
    render(<AnimatedStat value={10} />);
    const [, , options] = motionMocks.animateMock.mock.calls[0];
    expect(options.duration).toBe(0.7);
  });

  it("writes each animation frame to the DOM as a rounded, formatted number", () => {
    const { container } = render(<AnimatedStat value={100} />);
    const span = container.querySelector("span")!;

    act(() => {
      motionMocks.captured.onUpdate?.(41.6);
    });
    expect(span).toHaveTextContent("42");

    act(() => {
      motionMocks.captured.onUpdate?.(100);
    });
    expect(span).toHaveTextContent("100");
  });

  it("supports a custom formatter for both the initial and animated values", () => {
    const formatter = (v: number) => `${v}%`;
    const { container } = render(<AnimatedStat value={87} formatter={formatter} />);
    const span = container.querySelector("span")!;

    expect(span).toHaveTextContent("0%");

    act(() => {
      motionMocks.captured.onUpdate?.(87);
    });
    expect(span).toHaveTextContent("87%");
  });

  it("stops the previous animation controls on unmount", () => {
    const { unmount } = render(<AnimatedStat value={5} />);
    expect(motionMocks.stopMock).not.toHaveBeenCalled();
    unmount();
    expect(motionMocks.stopMock).toHaveBeenCalledTimes(1);
  });

  it("restarts the animation toward a new target when `value` changes", () => {
    const { rerender } = render(<AnimatedStat value={10} />);
    expect(motionMocks.animateMock).toHaveBeenCalledTimes(1);

    rerender(<AnimatedStat value={99} />);

    expect(motionMocks.stopMock).toHaveBeenCalledTimes(1); // previous effect cleaned up
    expect(motionMocks.animateMock).toHaveBeenCalledTimes(2);
    const [, secondTarget] = motionMocks.animateMock.mock.calls[1];
    expect(secondTarget).toBe(99);
  });
});
