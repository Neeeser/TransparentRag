"""Pipeline execution: run context (`context.py`) and the node executor (`executor.py`).

No package-level barrel: `context.py` is a dependency-free leaf that `node.py`
needs, while `executor.py` depends on `registry.py` (which depends on
`node.py`). An eager re-export here would force every import of
`app.pipelines.execution.context` to also load `executor.py` -> `registry.py`
-> `node.py` first, recreating the exact cycle this package split was meant
to avoid. Import the owning submodule directly.
"""

from __future__ import annotations
