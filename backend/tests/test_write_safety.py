"""SEC-04: writes cannot be redirected outside the workspace by swapping a directory for a symlink
after the policy check, and every write is verified on disk."""
import os

import pytest

from app.core.errors import AppError
from app.workspace import service


def _symlink_dir(target, link):
    try:
        os.symlink(target, link, target_is_directory=True)
    except OSError as exc:
        if getattr(exc, "winerror", None) == 1314:
            pytest.skip("Windows symlink creation requires a privilege unavailable to this account")
        raise


def test_directory_swapped_for_symlink_after_check_cannot_escape(project, tmp_path, monkeypatch):
    outside = tmp_path / "outside"
    outside.mkdir()
    (project / "docs").mkdir()
    real_check = service.check_writable_target

    def check_then_swap(path, max_bytes, content):
        real_check(path, max_bytes, content)
        os.rename(project / "docs", project / "docs_real")
        _symlink_dir(outside, project / "docs")

    monkeypatch.setattr(service, "check_writable_target", check_then_swap)
    with pytest.raises(AppError) as e:
        service.apply_write(str(project), "docs/notes.md", "# x\n", 10_000)
    assert e.value.code == "path_not_allowed"
    assert list(outside.iterdir()) == []


def test_creates_missing_folders_and_preserves_newlines(project):
    service.apply_write(str(project), "docs/new/notes.md", "a\nb\n", 10_000)
    assert (project / "docs" / "new" / "notes.md").read_bytes() == b"a\nb\n"
    assert not (project / "docs" / "new" / "notes.md.orbit-tmp").exists()


def test_write_is_verified(project, monkeypatch):
    monkeypatch.setattr(service, "file_hash", lambda p: "0" * 64)
    with pytest.raises(AppError) as e:
        service.apply_write(str(project), "README.md", "changed\n", 10_000)
    assert e.value.code == "write_verification_failed"


def test_overwrite_keeps_file_inside_workspace(project):
    service.apply_write(str(project), "README.md", "# New\n", 10_000)
    assert (project / "README.md").read_text() == "# New\n"
