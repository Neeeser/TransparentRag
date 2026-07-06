"""File storage helpers for saving and removing uploads."""

from __future__ import annotations

from pathlib import Path
from typing import BinaryIO

from fastapi import UploadFile

from app.core.config import get_settings


class FileStorage:
    """Persist and delete files under a configured storage path."""

    def __init__(self, base_path: Path | None = None) -> None:
        """Initialize storage and ensure the base directory exists."""
        settings = get_settings()
        self.base_path = base_path or settings.storage_path
        self.base_path.mkdir(parents=True, exist_ok=True)

    def save_stream(self, stream: BinaryIO, relative_path: str) -> Path:
        """Stream a binary file to the storage path and return the destination."""
        destination = self.base_path / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("wb") as out_file:
            while True:
                chunk = stream.read(1024 * 1024)
                if not chunk:
                    break
                out_file.write(chunk)
        return destination

    def save_upload(self, upload: UploadFile, relative_path: str) -> Path:
        """Save an uploaded file to the storage path and return the destination."""
        return self.save_stream(upload.file, relative_path)

    def write_text(self, text: str, relative_path: str) -> Path:
        """Write text content to a relative file path and return the destination."""
        destination = self.base_path / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(text, encoding="utf-8")
        return destination

    def delete_path(self, target_path: str | Path | None) -> None:
        """Remove a stored file and clean up empty parent directories."""
        if not target_path:
            return
        path = Path(target_path)
        if not path.is_absolute():
            path = self.base_path / path
        try:
            path.relative_to(self.base_path)
        except ValueError:
            return
        if path.exists():
            path.unlink()
        parent = path.parent
        while parent != self.base_path and parent.is_dir():
            try:
                parent.rmdir()
            except OSError:
                break
            parent = parent.parent
