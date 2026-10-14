"""One command to set up and run ORBIT on Windows, macOS or Linux (DEMO-04).

    python scripts/dev.py            # installs what is missing, then starts backend (:8000) and frontend (:5173)
    python scripts/dev.py --demo     # same, with ORBIT_DEMO_MODE=true for this run (no model, labeled output)
    python scripts/dev.py --no-install

Ctrl+C stops both. Needs Python 3.11+ and Node 20+ on PATH."""
import argparse
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND, FRONTEND = ROOT / "backend", ROOT / "frontend"
WINDOWS = os.name == "nt"
VENV_PY = BACKEND / ".venv" / ("Scripts/python.exe" if WINDOWS else "bin/python")
NPM = "npm.cmd" if WINDOWS else "npm"


def run(cmd: list[str], cwd: Path) -> None:
    print(f"$ {' '.join(map(str, cmd))}  (in {cwd.name}/)", flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)


def install() -> None:
    if sys.version_info < (3, 11):  # noqa: UP036  (this script may be run by an older Python)
        sys.exit("ORBIT needs Python 3.11 or newer.")
    if not shutil.which(NPM):
        sys.exit("npm was not found. Install Node.js 20 or newer.")
    if not VENV_PY.exists():
        run([sys.executable, "-m", "venv", ".venv"], BACKEND)
    if subprocess.run([str(VENV_PY), "-c", "import fastapi, alembic"], capture_output=True, check=False).returncode:
        run([str(VENV_PY), "-m", "pip", "install", "-q", "-e", ".[dev]"], BACKEND)
    if not (FRONTEND / "node_modules").exists():
        run([NPM, "ci", "--no-audit", "--no-fund"], FRONTEND)
    env_file = ROOT / ".env"
    if not env_file.exists():
        shutil.copy(ROOT / ".env.example", env_file)
        print("Created .env from .env.example. Add NEBIUS_API_KEY there, or start with --demo.", flush=True)


def wait_for(url: str, proc: subprocess.Popen, timeout: float = 90) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline and proc.poll() is None:
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                return r.status == 200
        except OSError:
            time.sleep(0.5)
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--demo", action="store_true", help="run with ORBIT_DEMO_MODE=true")
    parser.add_argument("--no-install", action="store_true", help="skip dependency checks")
    args = parser.parse_args()
    if not args.no_install:
        install()
    env = {**os.environ, **({"ORBIT_DEMO_MODE": "true"} if args.demo else {})}
    flags = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if WINDOWS else {"start_new_session": True}
    backend = subprocess.Popen([str(VENV_PY), "-m", "uvicorn", "app.main:app_factory", "--factory", "--host", "127.0.0.1", "--port", "8000", "--reload"], cwd=BACKEND, env=env, **flags)
    procs = [backend]
    try:
        if not wait_for("http://127.0.0.1:8000/api/health", backend):
            sys.exit("The backend did not start (is port 8000 in use?). See the messages above.")
        frontend = subprocess.Popen([NPM, "run", "dev"], cwd=FRONTEND, env=env, **flags)
        procs.append(frontend)
        if not wait_for("http://localhost:5173/", frontend):
            sys.exit("The frontend did not start (is port 5173 in use?). See the messages above.")
        print("\nORBIT is running: open http://localhost:5173  (Ctrl+C to stop)\n", flush=True)
        while all(p.poll() is None for p in procs):
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        for p in procs:
            if p.poll() is None:
                if WINDOWS:
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(p.pid)], capture_output=True, check=False)
                else:
                    os.killpg(p.pid, signal.SIGTERM)


if __name__ == "__main__":
    main()
