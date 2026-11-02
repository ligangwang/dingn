import React from "react";
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MindGame } from "../src/components/mind-game";
afterEach(cleanup);
test("logic rounds lock answers, explain mistakes, and reset the score", async () => {
  const user = userEvent.setup();
  render(<MindGame mode="logic" />);
  await user.click(screen.getByRole("button", { name: "30" }));
  expect(screen.getByRole("status").textContent).toContain("24 × 2 = 48");
  expect(
    (screen.getByRole("button", { name: "48 ✓" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  for (const answer of ["No", "Mia", "25"]) {
    await user.click(screen.getByRole("button", { name: /Next round/ }));
    await user.click(screen.getByRole("button", { name: answer }));
  }
  await user.click(screen.getByRole("button", { name: /See results/ }));
  expect(screen.getByRole("status").textContent).toContain("3 of 4");
  await user.click(screen.getByRole("button", { name: "Play again" }));
  expect(screen.getByText("0 POINTS")).toBeTruthy();
});
test("decision answers change with the objective and complete a session", async () => {
  const user = userEvent.setup();
  render(<MindGame mode="decisions" />);
  const answers = ["Route B", "Route A", "Two scanners", "Take the new path"];
  for (let i = 0; i < answers.length; i++) {
    await user.click(
      screen.getByRole("button", { name: answers[i] }),
    );
    expect(screen.getByRole("status").textContent).toContain("You found it.");
    await user.click(
      screen.getByRole("button", {
        name: i === 3 ? /See results/ : /Next round/,
      }),
    );
  }
  expect(screen.getByRole("status").textContent).toContain("4 of 4");
});
