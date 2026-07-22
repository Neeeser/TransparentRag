"""Collection diagnostics: cross-pipeline compatibility findings.

Public API is `CollectionDiagnosticsService`; everything else (context, rules,
prober) is internal and imported from its owning submodule.
"""

from app.services.diagnostics.service import CollectionDiagnosticsService

__all__ = ["CollectionDiagnosticsService"]
