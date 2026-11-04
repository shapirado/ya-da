import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AppShell from "./AppShell";

describe("AppShell", () => {
  it("shows the 4 Hebrew nav labels", () => {
    render(
      <AppShell>
        <div>תוכן</div>
      </AppShell>
    );

    expect(screen.getByText("לוח בקרה")).toBeInTheDocument();
    expect(screen.getByText("תצוגה שנתית")).toBeInTheDocument();
    expect(screen.getByText("משפחות")).toBeInTheDocument();
    expect(screen.getByText("חוגים")).toBeInTheDocument();
  });
});
