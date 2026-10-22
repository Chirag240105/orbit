import * as vscode from "vscode";

type ExplainResult = {
  mode: string; summary: string; files: { path: string; summary: string }[];
  flow_steps: string[]; risks: string[]; dependencies: string[]; unknowns: string[];
  redactions: number; external: boolean;
};

const TOKEN_KEY = "orbit.jwt";
const WORKSPACE_KEY = "orbit.workspaceId";
const SHARE_KEY = "orbit.hostedSharing";

export function activate(context: vscode.ExtensionContext) {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
  status.command = "orbit.linkWorkspace";
  const updateStatus = () => {
    const id = context.workspaceState.get<number>(WORKSPACE_KEY);
    const sharing = context.workspaceState.get<boolean>(SHARE_KEY, false);
    status.text = "$(hubot) ORBIT: " + (id ? "workspace linked" : "not linked") + " · sharing " + (sharing ? "on" : "off");
    status.tooltip = id ? "Authorized ORBIT workspace #" + id + "; click to relink" : "Click to link an authorized ORBIT workspace";
  };
  updateStatus();
  status.show();
  context.subscriptions.push(status);

  context.subscriptions.push(
    vscode.commands.registerCommand("orbit.setToken", async () => {
      const token = await vscode.window.showInputBox({ prompt: "Paste an ORBIT access token", password: true, ignoreFocusOut: true });
      if (token?.trim()) {
        await context.secrets.store(TOKEN_KEY, token.trim());
        vscode.window.showInformationMessage("ORBIT token stored in VS Code SecretStorage.");
      }
    }),
    vscode.commands.registerCommand("orbit.linkWorkspace", async () => {
      const id = await vscode.window.showInputBox({
        prompt: "Enter the workspace ID from ORBIT Projects (authorize this exact folder first)",
        validateInput: (value) => /^\d+$/.test(value) && Number(value) > 0 ? undefined : "Enter a positive workspace ID.",
      });
      if (id) {
        await context.workspaceState.update(WORKSPACE_KEY, Number(id));
        updateStatus();
        vscode.window.showInformationMessage("Linked ORBIT workspace #" + id + ". ORBIT can only read files allowed by that backend workspace.");
      }
    }),
    vscode.commands.registerCommand("orbit.toggleSharing", async () => {
      const enabled = !context.workspaceState.get<boolean>(SHARE_KEY, false);
      await context.workspaceState.update(SHARE_KEY, enabled);
      updateStatus();
      vscode.window.showInformationMessage(enabled
        ? "Hosted code sharing enabled. ORBIT still asks before each send."
        : "Hosted code sharing disabled.");
    }),
    vscode.commands.registerCommand("orbit.explainSelection", () => explainSelection(context)),
    vscode.commands.registerCommand("orbit.explainFile", () => explainFile(context, "file")),
    vscode.commands.registerCommand("orbit.explainProject", () => explainProject(context)),
    vscode.commands.registerCommand("orbit.traceFlow", () => explainFile(context, "flow")),
  );
}

async function explainSelection(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    vscode.window.showWarningMessage("Select some code first.");
    return;
  }
  const selection = editor.document.getText(editor.selection);
  await submit(context, { mode: "selection", selection });
}

async function explainFile(context: vscode.ExtensionContext, mode: "file" | "flow") {
  const workspaceId = context.workspaceState.get<number>(WORKSPACE_KEY);
  const editor = vscode.window.activeTextEditor;
  const folder = editor && vscode.workspace.getWorkspaceFolder(editor.document.uri);
  if (!workspaceId || !editor || !folder) {
    vscode.window.showWarningMessage("Open a workspace file and link its already authorized ORBIT workspace.");
    return;
  }
  const path = vscode.workspace.asRelativePath(editor.document.uri, false).replace(/\\/g, "/");
  await submit(context, { mode, workspace_id: workspaceId, path });
}

async function explainProject(context: vscode.ExtensionContext) {
  const workspaceId = context.workspaceState.get<number>(WORKSPACE_KEY);
  if (!workspaceId) {
    vscode.window.showWarningMessage("Link an authorized ORBIT workspace first.");
    return;
  }
  await submit(context, { mode: "project", workspace_id: workspaceId });
}

async function submit(
  context: vscode.ExtensionContext,
  body: { mode: "selection" | "file" | "project" | "flow"; workspace_id?: number; path?: string; selection?: string },
) {
  if (!context.workspaceState.get<boolean>(SHARE_KEY, false)) {
    vscode.window.showWarningMessage("Hosted code sharing is disabled. Enable it with ORBIT: Toggle Hosted Code Sharing.");
    return;
  }
  const consent = await vscode.window.showWarningMessage(
    "Send selected code to ORBIT's configured model after secret redaction? Redaction is best effort.",
    { modal: true }, "Send code",
  );
  if (consent !== "Send code") return;
  let token = await context.secrets.get(TOKEN_KEY);
  if (!token) {
    token = await vscode.window.showInputBox({ prompt: "Paste an ORBIT access token", password: true, ignoreFocusOut: true });
    if (!token?.trim()) return;
    await context.secrets.store(TOKEN_KEY, token.trim());
  }
  const baseUrl = vscode.workspace.getConfiguration("orbit").get<string>("apiBaseUrl", "http://127.0.0.1:8000").replace(/\/$/, "");
  const panel = vscode.window.createWebviewPanel("orbit.explanation", "ORBIT Code Explanation", vscode.ViewColumn.Beside, { enableScripts: false });
  panel.webview.html = "<!doctype html><meta charset=\"utf-8\"><body style=\"font:14px sans-serif;padding:1rem\">Analyzing authorized code…</body>";
  try {
    const response = await fetch(baseUrl + "/api/code/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ ...body, consent_external: true }),
    });
    const payload = await response.json() as ExplainResult | { error?: { message?: string } };
    if (!response.ok) throw new Error("error" in payload ? payload.error?.message ?? "ORBIT failed (" + response.status + ")" : "ORBIT failed (" + response.status + ")");
    const result = payload as ExplainResult;
    const lines = [
      "<h2>" + escapeHtml(result.mode) + " explanation</h2>",
      "<p>" + escapeHtml(result.summary) + "</p>",
      ...result.files.map((file) => "<h3>" + escapeHtml(file.path) + "</h3><p>" + escapeHtml(file.summary) + "</p>"),
      result.flow_steps.length ? "<h3>Flow</h3><ol>" + result.flow_steps.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ol>" : "",
      result.risks.length ? "<h3>Risks</h3><ul>" + result.risks.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul>" : "",
      result.dependencies.length ? "<h3>Dependencies</h3><ul>" + result.dependencies.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul>" : "",
      "<small>" + result.redactions + " possible secret(s) redacted. Verify important conclusions against source.</small>",
    ].join("");
    panel.webview.html = "<!doctype html><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'\"><body style=\"font:14px sans-serif;line-height:1.5;padding:1rem\">" + lines + "</body>";
  } catch (error) {
    panel.webview.html = "<!doctype html><meta charset=\"utf-8\"><body style=\"font:14px sans-serif;padding:1rem\"><h2>ORBIT could not explain this code</h2><p>" + escapeHtml(String(error)) + "</p></body>";
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character] ?? character);
}

export function deactivate() {}
