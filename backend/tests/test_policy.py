import os
from pathlib import Path

import pytest

from app.core.errors import AppError
from app.workspace.policy import check_readable_file, resolve_inside, validate_workspace_root


def code(fn, *a, **k):
    with pytest.raises(AppError) as e:
        fn(*a, **k)
    return e.value.code


def test_ok_path(project):
    assert resolve_inside(project, "src/app.py").name == "app.py"


@pytest.mark.parametrize("bad", ["../x", "src/../../x", "/etc/passwd", "C:\\Windows\\x", "..\\x"])
def test_traversal_and_absolute_rejected(project, bad):
    assert code(resolve_inside, project, bad) == "path_not_allowed"


def test_symlink_escape_rejected(project, tmp_path):
    outside = tmp_path / "outside.txt"
    outside.write_text("secret")
    try:
        os.symlink(outside, project / "link.txt")
    except OSError as exc:
        if getattr(exc, "winerror", None) == 1314:
            pytest.skip("Windows symlink creation requires a privilege unavailable to this account")
        raise
    assert code(resolve_inside, project, "link.txt") == "path_not_allowed"


def test_symlinked_dir_escape_rejected(project, tmp_path):
    try:
        os.symlink(tmp_path, project / "up")
    except OSError as exc:
        if getattr(exc, "winerror", None) == 1314:
            pytest.skip("Windows symlink creation requires a privilege unavailable to this account")
        raise
    assert code(resolve_inside, project, "up/outside.txt") == "path_not_allowed"


@pytest.mark.parametrize("name", [".env", ".env.local", "id_rsa", "server.pem", "credentials.json"])
def test_sensitive_files_excluded(project, name):
    (project / name).write_text("x")
    assert code(resolve_inside, project, name) == "path_excluded"


def test_env_example_allowed(project):
    (project / ".env.example").write_text("A=1")
    assert resolve_inside(project, ".env.example").exists()


def test_excluded_dir(project):
    (project / "node_modules").mkdir()
    (project / "node_modules" / "a.js").write_text("x")
    assert code(resolve_inside, project, "node_modules/a.js") == "path_excluded"


def test_size_and_type_limits(project):
    big = project / "big.txt"
    big.write_text("a" * 5000)
    assert code(check_readable_file, big, 1000) == "file_too_large"
    assert code(check_readable_file, project / "notes.bin", 1000) == "unsupported_file"


def test_workspace_root_too_broad(tmp_path):
    assert code(validate_workspace_root, str(Path(tmp_path.anchor))) == "workspace_too_broad"
    assert code(validate_workspace_root, str(os.path.expanduser("~"))) == "workspace_too_broad"
    assert code(validate_workspace_root, "relative/path") == "invalid_path"
    assert code(validate_workspace_root, str(tmp_path / "missing")) == "invalid_path"
