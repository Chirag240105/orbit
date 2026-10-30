"""Scan tracked files and git history for potential leaked secrets.

Rule 1 check:
- .env is in .gitignore
- .env.example contains placeholders only
- No hosted API keys anywhere in tracked files or commit history
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECRET_PATTERNS = [
    re.compile(r"nvapi-[A-Za-z0-9_-]{20,}", re.IGNORECASE),
    re.compile("AI" + "za" + r"[0-9A-Za-z-_]{35}", re.IGNORECASE),
]


def check_gitignore() -> bool:
    gitignore = ROOT / ".gitignore"
    if not gitignore.exists():
        print("FAIL: .gitignore missing")
        return False
    content = gitignore.read_text(encoding="utf-8")
    lines = [line.strip() for line in content.splitlines()]
    if ".env" not in lines:
        print("FAIL: .env not found in .gitignore")
        return False
    return True


def check_env_example() -> bool:
    example = ROOT / ".env.example"
    if not example.exists():
        print("FAIL: .env.example missing")
        return False
    content = example.read_text(encoding="utf-8")
    for pattern in SECRET_PATTERNS:
        if pattern.search(content):
            print("FAIL: Found secret pattern in .env.example")
            return False
    # Check for actual api key values filled
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip()
            if "API_KEY" in key and val and not val.startswith("your_"):
                print(f"FAIL: .env.example contains value for {key}")
                return False
    return True


def scan_tracked_files() -> bool:
    try:
        proc = subprocess.run(
            ["git", "ls-files"],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"FAIL: could not run git ls-files: {exc}")
        return False

    passed = True
    for rel_path in proc.stdout.splitlines():
        rel_path = rel_path.strip()
        if not rel_path:
            continue
        full_path = ROOT / rel_path
        if not full_path.is_file():
            continue
        try:
            content = full_path.read_text(encoding="utf-8", errors="ignore")
        except OSError as exc:
            print(f"FAIL: could not read tracked file {rel_path}: {exc}")
            passed = False
            continue
        for pattern in SECRET_PATTERNS:
            match = pattern.search(content)
            if match:
                print(f"FAIL: Secret pattern found in tracked file {rel_path}: {match.group(0)[:10]}...")
                passed = False
    return passed


def scan_git_history() -> bool:
    for prefix in ["nvapi-", "AI" + "za"]:
        try:
            proc = subprocess.run(
                ["git", "log", "-S", prefix, "--oneline"],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                check=True,
            )
            if proc.stdout.strip():
                print(f"FAIL: Git history contains commits mentioning {prefix}:\n{proc.stdout}")
                return False
        except (OSError, subprocess.CalledProcessError) as exc:
            print(f"FAIL: could not check git log for {prefix}: {exc}")
            return False
    return True


def main() -> int:
    ok = True
    print("Checking .gitignore...")
    if not check_gitignore():
        ok = False
    print("Checking .env.example...")
    if not check_env_example():
        ok = False
    print("Scanning tracked files...")
    if not scan_tracked_files():
        ok = False
    print("Scanning git history...")
    if not scan_git_history():
        ok = False

    if ok:
        print("PASS: No secrets detected in repo or history. .env is ignored and .env.example is clean.")
        return 0
    else:
        print("FAIL: Secret scanner detected issues.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
