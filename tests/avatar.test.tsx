import React from "react";
import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { Avatar } from "../src/components/avatar";
afterEach(cleanup);
const google = {
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  photoURL: "https://lh3.googleusercontent.com/a/ada",
};
test("defaults to the Google sign-in photo", () => {
  const { container } = render(<Avatar choice="" name="" user={google} />);
  expect(container.querySelector("img")?.getAttribute("src")).toBe(
    google.photoURL,
  );
});
test("falls back to initials without a photo, or when the photo fails", () => {
  const { container, rerender } = render(
    <Avatar choice="" name="" user={{ ...google, photoURL: null }} />,
  );
  expect(container.textContent).toBe("AD");
  rerender(<Avatar choice="" name="Lee" user={google} />);
  fireEvent.error(container.querySelector("img")!);
  expect(container.textContent).toBe("LE");
});
test("a chosen preset or initials overrides the photo", () => {
  const { container, rerender } = render(
    <Avatar choice="fox" name="" user={google} />,
  );
  expect(container.textContent).toBe("🦊");
  rerender(<Avatar choice="initials" name="" user={google} />);
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toBe("AD");
});
