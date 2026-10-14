/** IN-03: a clear title and a recovery step for each error the backend (or the network) can produce.
 * The backend's own message is shown under the title; it is already written for people, not developers. */
export type ErrorHelp = { title: string; hint?: string; link?: { to: string; label: string }; retry?: boolean };

const HELP: Record<string, ErrorHelp> = {
  backend_unreachable: { title: "Backend not reachable", hint: "Start ORBIT with `python scripts/dev.py`, or run the backend on port 8000.", retry: true },
  unauthorized: { title: "ORBIT couldn't verify this page", hint: "Open ORBIT from its dev server (http://localhost:5173). If you restarted the backend, reload the page.", retry: true },
  provider_not_configured: { title: "No model is configured", hint: "Add NEBIUS_API_KEY to .env and restart the backend, or set ORBIT_DEMO_MODE=true to try the interface.", link: { to: "/settings", label: "Open Settings" } },
  provider_auth_failed: { title: "The model provider rejected the API key", hint: "Check NEBIUS_API_KEY in .env, then restart the backend.", link: { to: "/settings", label: "Open Settings" } },
  provider_model_not_found: { title: "The model was not found", hint: "Run `python scripts/list_models.py` and set NEBIUS_MODEL in .env." },
  provider_unreachable: { title: "Can't reach the model provider", hint: "Check your internet connection.", retry: true },
  provider_rate_limited: { title: "The model provider is busy", hint: "Wait a moment, then try again.", retry: true },
  provider_empty_response: { title: "The model returned no answer", hint: "It spent its budget reasoning. Try again, or raise NEBIUS_MAX_TOKENS.", retry: true },
  provider_error: { title: "The model provider had a problem", retry: true },
  provider_bad_response: { title: "The model provider sent an unexpected reply", retry: true },
  rate_limited: { title: "Too many requests", hint: "Wait a minute, then try again.", retry: true },
  cancelled: { title: "Stopped", hint: "You cancelled this request." },
  skill_disabled: { title: "That skill is turned off", link: { to: "/skills", label: "Open Skills" } },
  no_skills_enabled: { title: "All skills are turned off", link: { to: "/skills", label: "Open Skills" } },
  permission_denied: { title: "Not allowed", link: { to: "/projects", label: "Open Projects" } },
  file_too_large: { title: "File too large", hint: "Pick a smaller file, or raise ORBIT_MAX_FILE_BYTES in .env." },
  unsupported_file: { title: "File type not supported", hint: "ORBIT reads text and source files only." },
  path_excluded: { title: "Protected file", hint: "Secrets such as .env files and keys are never read or written." },
  path_not_allowed: { title: "Path outside the workspace", hint: "Use a path relative to the authorized folder." },
  workspace_too_broad: { title: "Folder too broad", hint: "Choose a project folder, not a drive root, home folder or system folder." },
  invalid_path: { title: "Invalid path" },
  not_found: { title: "Not found" },
  duplicate: { title: "Already authorized" },
  stale_change: { title: "The file changed since this proposal", hint: "Propose the change again so you review the current version." },
  no_change: { title: "Nothing to change", hint: "The draft is identical to the current file." },
  draft_failed: { title: "No usable draft", hint: "Rephrase the instruction and try again.", retry: true },
  validation_error: { title: "Check the form", hint: "Some fields are missing or too long." },
  internal_error: { title: "Something went wrong on the server", hint: "The backend log has details.", retry: true },
};

export const errorHelp = (code: string | undefined): ErrorHelp => (code && HELP[code]) || { title: "Something went wrong", retry: true };
