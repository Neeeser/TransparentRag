"""Pipeline engine: node contracts, registry, validation, and execution.

This package has no external consumers of a package-level barrel (nothing
does `from app.pipelines import X`); callers import the owning submodule
directly (`app.pipelines.definition`, `app.pipelines.registry`, ...). Keeping
this file import-free avoids re-introducing a barrel that would force every
submodule's import graph to resolve before any single submodule can be used.
"""

from __future__ import annotations
