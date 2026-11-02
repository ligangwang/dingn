import React from "react";
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MindGame, starsFor } from "../src/components/mind-game";
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
  expect(screen.getByLabelText("2 of 3 stars")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Play again" }));
  expect(screen.getByText("Round 1 of 4")).toBeTruthy();
  expect(screen.getByText("points")).toBeTruthy();
});
test("decision answers change with the objective and complete a session", async () => {
  const user = userEvent.setup();
  render(<MindGame mode="decisions" />);
  const answers = ["Route B", "Route A", "Two scanners", "Take the new path"];
  for (let i = 0; i < answers.length; i++) {
    await user.click(screen.getByRole("button", { name: answers[i] }));
    expect(screen.getByRole("status").textContent).toContain("You found it.");
    await user.click(
      screen.getByRole("button", {
        name: i === 3 ? /See results/ : /Next round/,
      }),
    );
  }
  expect(screen.getByRole("status").textContent).toContain("4 of 4");
  expect(screen.getByText("Flawless run!")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Next game: Logic/ })).toBeTruthy();
});
test("the score label is singular for one point", async () => {
  const user = userEvent.setup();
  render(<MindGame mode="logic" />);
  await user.click(screen.getByRole("button", { name: "48" }));
  expect(screen.getByText("point")).toBeTruthy();
});
test("stars reward near-perfect and perfect runs", () => {
  expect([0, 1, 2, 3, 4].map((n) => starsFor(n, 4))).toEqual([0, 1, 1, 2, 3]);
});
