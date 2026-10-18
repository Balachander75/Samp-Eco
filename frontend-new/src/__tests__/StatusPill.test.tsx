import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill, resolveStatusTone } from "@/components/ui/StatusPill";

describe("StatusPill component", () => {
  it("renders status text correctly", () => {
    render(<StatusPill status="Approved" />);
    expect(screen.getByText("Approved")).toBeDefined();
  });

  it("resolves tone for draft status", () => {
    const { tone } = resolveStatusTone("Draft");
    expect(tone).toBe("amber");
  });

  it("resolves tone for approved / success status", () => {
    const { tone } = resolveStatusTone("Approved");
    expect(tone).toBe("success");
  });

  it("resolves tone for rejected / critical status", () => {
    const { tone } = resolveStatusTone("Rejected");
    expect(tone).toBe("danger");
  });

  it("resolves tone for needs decision / action status", () => {
    const { tone } = resolveStatusTone("Needs Decision");
    expect(tone).toBe("purple");
  });
});
