/** FE-02 (dialogs, navigation, keyboard), IN-03 (error states), FE-06 (tree and diff). */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { Shell } from "../src/app/Shell";
import { ConsentDialog } from "../src/components/ConsentDialog";
import { ConfirmDialog, ErrorState } from "../src/components/ui";
import { DiffView } from "../src/features/projects/DiffView";
import { FileTree } from "../src/features/projects/FileTree";
import { ApiError } from "../src/lib/api";
import { HEALTH, ok, renderPage, server } from "./helpers";

describe("ConfirmDialog", () => {
  it("focuses Cancel first for destructive actions and Confirm otherwise", () => {
    const { rerender } = render(<ConfirmDialog open danger title="Delete?" body="Gone forever." confirmLabel="Delete" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    rerender(<ConfirmDialog open={false} title="x" body="" confirmLabel="OK" onConfirm={() => {}} onCancel={() => {}} />);
    rerender(<ConfirmDialog open title="Allow?" body="" confirmLabel="Allow" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("button", { name: "Allow" })).toHaveFocus();
  });
  it("is labelled by its title and closes with Escape", () => {
    const cancel = vi.fn();
    render(<ConfirmDialog open title="Delete this memory?" body="Can't be undone." confirmLabel="Delete" onConfirm={() => {}} onCancel={cancel} />);
    const dialog = screen.getByRole("dialog", { name: "Delete this memory?" });
    expect(dialog).toHaveAccessibleDescription("Can't be undone.");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(cancel).toHaveBeenCalled();
  });
  it("gives focus back to the button that opened it", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Open</button><ConfirmDialog open={open} title="t" body="" confirmLabel="OK" onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)} /></>;
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("button", { name: "OK" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(opener).toHaveFocus();
  });
});

describe("ConsentDialog", () => {
  it("lists files, layout, size and redactions", () => {
    render(<ConsentDialog details={{ files: ["a.py", "b.py"], layout: true, chars: 2500, redactions: 1, model: "nvidia/x", provider: "nebius" }} onConfirm={() => {}} onCancel={() => {}} />);
    const d = screen.getByRole("dialog");
    expect(d).toHaveTextContent("2 file(s): a.py, b.py");
    expect(d).toHaveTextContent("project layout");
    expect(d).toHaveTextContent("2,500 characters, with 1 likely secret(s) redacted");
  });
});

describe("ErrorState (IN-03)", () => {
  const cases: [string, RegExp, RegExp | null][] = [
    ["backend_unreachable", /Backend not reachable/, /python scripts\/dev\.py/],
    ["provider_auth_failed", /rejected the API key/, /Open Settings/],
    ["rate_limited", /Too many requests/, /Wait a minute/],
    ["provider_empty_response", /no answer/, /NEBIUS_MAX_TOKENS/],
    ["file_too_large", /File too large/, /ORBIT_MAX_FILE_BYTES/],
    ["skill_disabled", /turned off/, /Open Skills/],
  ];
  it.each(cases)("%s has a clear title and recovery step", (code, title, hint) => {
    const retry = vi.fn();
    render(<MemoryRouter><ErrorState error={new ApiError(code, "Server message.", 500)} retry={retry} /></MemoryRouter>);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(title);
    expect(alert).toHaveTextContent("Server message.");
    if (hint) expect(alert.textContent).toMatch(hint);
  });
  it("offers retry only when retrying can help", () => {
    const retry = vi.fn();
    render(<ErrorState error={new ApiError("rate_limited", "x", 429)} retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
    render(<ErrorState error={new ApiError("path_excluded", "x", 403)} retry={retry} />);
    expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(1);
  });
  it("links work outside a router too", () => {
    render(<ErrorState error={new ApiError("provider_not_configured", "x", 503)} />);
    expect(screen.getByRole("link", { name: "Open Settings" })).toHaveAttribute("href", "/settings");
  });
});

describe("Shell navigation (FE-02)", () => {
  it("has a skip link, labelled navigation, and marks the current page", async () => {
    server.use(ok("/health", HEALTH), ok("/workspaces", []));
    renderPage(<Shell />, { route: "/memory" });
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Memory" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getAllByRole("link")).toHaveLength(8);
    expect(document.getElementById("main")).not.toBeNull();
    expect(await screen.findByText("Demo mode, no model")).toBeInTheDocument();
    expect(screen.getByLabelText("Active workspace")).toBeInTheDocument();
  });
});

describe("Collapsible sidebar", () => {
  beforeEach(() => localStorage.clear());
  it("starts as an icon rail on the AI Workspace, keeps labelled links, and expands from the logo", async () => {
    server.use(ok("/health", HEALTH), ok("/workspaces", []));
    renderPage(<Shell />, { route: "/chat" });
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "AI Workspace" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("button", { name: "Collapse sidebar" })).toBeNull();
    fireEvent.click(within(nav).getByRole("button", { name: "Expand sidebar" }));
    expect(within(nav).getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
    expect(localStorage.getItem("orbit-nav-chat")).toBe("expanded");
  });
  it("starts expanded on other pages", () => {
    server.use(ok("/health", HEALTH), ok("/workspaces", []));
    renderPage(<Shell />, { route: "/memory" });
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });
});

describe("FileTree (FE-06)", () => {
  const files = [{ path: "src/app/main.py", size: 100 }, { path: "src/util.py", size: 50 }, { path: "README.md", size: 10 }];
  it("starts collapsed, expands folders, and selects files", () => {
    const select = vi.fn();
    render(<FileTree files={files} selected={null} onSelect={select} />);
    expect(screen.queryByText("util.py")).toBeNull();
    const src = screen.getByRole("button", { name: /src\// });
    expect(src).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(src);
    expect(src).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: /util\.py/ }));
    expect(select).toHaveBeenCalledWith("src/util.py");
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByText("main.py")).toBeInTheDocument();
  });
  it("opens the folders of the selected file", () => {
    render(<FileTree files={files} selected="src/app/main.py" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /main\.py/ })).toHaveAttribute("aria-current", "true");
  });
  it("renders a thousand files without opening them", () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({ path: `pkg${i % 20}/mod${i}.py`, size: 1 }));
    render(<FileTree files={many} selected={null} onSelect={() => {}} />);
    expect(screen.getAllByRole("button", { name: /pkg\d+\// })).toHaveLength(20);
    expect(screen.queryByText("mod1.py")).toBeNull();
  });
});

describe("DiffView (FE-06)", () => {
  it("shows additions and removals and folds long unchanged runs", () => {
    const before = Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n");
    const after = before.replace("line 15", "line fifteen");
    render(<DiffView before={before} after={after} />);
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("−1")).toBeInTheDocument();
    expect(screen.getByText("line fifteen")).toBeInTheDocument();
    const fold = screen.getAllByRole("button", { name: /Show \d+ unchanged lines/ });
    expect(fold.length).toBe(2);
    expect(screen.queryByText("line 2")).toBeNull();
    fireEvent.click(fold[0]);
    expect(screen.getByText("line 2")).toBeInTheDocument();
  });
  it("labels a new file", () => {
    render(<DiffView before={null} after={"# Notes\n"} />);
    expect(screen.getByText(/New file/)).toBeInTheDocument();
  });
});
