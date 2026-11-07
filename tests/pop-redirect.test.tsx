import React from "react";
import { expect, test, vi } from "vitest";
import { render } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

test("the old Bubble Calm page sends visitors to Crowd Rush", async () => {
  const { PopRedirect } = await import("../src/app/pop/redirect");
  render(<PopRedirect />);
  expect(replace).toHaveBeenCalledWith("/crowd/");
});
