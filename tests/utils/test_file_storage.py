from __future__ import annotations

import io
from pathlib import Path

from app.utils.file_storage import FileStorage


def test_file_storage_writes_and_deletes(tmp_path: Path) -> None:
    storage = FileStorage(base_path=tmp_path)

    written = storage.write_text("hello", "nested/hello.txt")

    assert written.read_text(encoding="utf-8") == "hello"

    storage.delete_path("nested/hello.txt")

    assert not written.exists()
    assert (tmp_path / "nested").exists() is False


def test_file_storage_save_stream_and_protects_base(tmp_path: Path) -> None:
    storage = FileStorage(base_path=tmp_path)

    saved = storage.save_stream(io.BytesIO(b"data"), "uploads/sample.txt")

    assert saved.read_bytes() == b"data"

    external = tmp_path.parent / "outside.txt"
    external.write_text("leave", encoding="utf-8")

    storage.delete_path(external)

    assert external.exists()


def test_file_storage_delete_path_handles_missing(tmp_path: Path) -> None:
    storage = FileStorage(base_path=tmp_path)

    storage.delete_path(None)
    storage.delete_path("missing/file.txt")
