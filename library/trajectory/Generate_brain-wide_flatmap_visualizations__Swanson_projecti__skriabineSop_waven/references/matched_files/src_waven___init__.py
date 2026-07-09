# Source: src/waven/__init__.py
# Summary: See repo_context.md

"""Public lowercase API for the Waven package.

The implementation currently lives in :mod:`Waven` for historical reasons.
This package provides the import style users expect after installation:

    import waven
    from waven import PipelineConfig
"""
from __future__ import annotations

import importlib

try:
    from importlib.metadata import version
except ImportError:  # pragma: no cover - Python < 3.8 fallback
    from importlib_metadata import version  # type: ignore

from .config import AnalysisConfig, GaborConfig, PipelineConfig, default_pipeline_config
from .pipeline import (
    PipelineOutputs,
    RFAnalysisResult,
    SimpleModelResult,
    SpikeData,
    WaveletData,
    create_gabor_library,
    load_coarse_wavelets,
    load_spikes_and_positions,
    prepare_stimulus_wavelets,
    run_full_model,
    run_pipeline,
    run_rf_analysis,
    run_simple_model,
    smooth_best_positions,
)

try:
    __version__ = version("waven")
except Exception:  # pragma: no cover - package may be imported from source
    __version__ = "0+unknown"

_PUBLIC_SUBMODULES = {"analysis_utils", "gui"}


def __getattr__(name: str):
    """Load public submodules only when users ask for them."""
    if name in _PUBLIC_SUBMODULES:
        module = importlib.import_module(f"{__name__}.{name}")
        globals()[name] = module
        return module
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "AnalysisConfig",
    "GaborConfig",
    "PipelineConfig",
    "PipelineOutputs",
    "RFAnalysisResult",
    "SimpleModelResult",
    "SpikeData",
    "WaveletData",
    "create_gabor_library",
    "default_pipeline_config",
    "load_coarse_wavelets",
    "load_spikes_and_positions",
    "prepare_stimulus_wavelets",
    "run_full_model",
    "run_pipeline",
    "run_rf_analysis",
    "run_simple_model",
    "smooth_best_positions",
    "analysis_utils",
    "gui",
]
