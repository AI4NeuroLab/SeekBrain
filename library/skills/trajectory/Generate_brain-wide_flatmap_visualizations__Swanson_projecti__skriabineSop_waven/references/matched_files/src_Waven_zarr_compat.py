# Source: src/Waven/zarr_compat.py
# Summary: See repo_context.md

"""
Helper to load large arrays preferring zarr datasets when available.
Provides load_array(path, ...) which will try to open a .zarr dataset (or sibling .zarr)
and fall back to numpy.load(..., mmap_mode=...).

Returns either a zarr Array/Group or a numpy array/memmap depending on what was loaded.
"""
from __future__ import annotations

import os
import logging
from typing import Optional, Any

import numpy as np

logger = logging.getLogger(__name__)

try:
    import zarr
    HAS_ZARR = True
except Exception:
    zarr = None  # type: ignore
    HAS_ZARR = False


def _is_zarr_dir(path: str) -> bool:
    """Return True if path looks like a zarr store (directory containing .zarray/.zgroup)."""
    try:
        if os.path.isdir(path):
            if os.path.exists(os.path.join(path, ".zarray")):
                return True
            if os.path.exists(os.path.join(path, ".zgroup")):
                return True
        return False
    except Exception:
        return False


def load_array(
    path: str,
    *,
    mmap_mode: Optional[str] = "r",
    allow_pickle: bool = False,
    prefer_zarr: bool = True,
    raise_on_error: bool = True,
    zarr_kwargs: Optional[dict] = None,
) -> Any:
    """
    Load an array-like object from disk.

    Behavior:
    - If prefer_zarr and zarr is available and path points to a zarr store (or a sibling .zarr exists), open with zarr.open(..., mode='r').
    - Otherwise, try np.load(path, mmap_mode=mmap_mode, allow_pickle=allow_pickle).

    Notes:
    - If allow_pickle is True, we avoid trying zarr because pickled numpy objects are not representable in zarr.
    - Returns a zarr Array/Group or numpy array/memmap depending on what was loaded.
    - On error, either re-raises (raise_on_error=True) or returns None.
    """
    zarr_kwargs = {} if zarr_kwargs is None else dict(zarr_kwargs)
    path = str(path)

    # If caller requested pickles, prefer numpy loader
    if allow_pickle:
        logger.debug("allow_pickle=True -> using numpy.load for %s", path)
        try:
            return np.load(path, allow_pickle=True, mmap_mode=mmap_mode)
        except Exception as e:
            logger.exception("np.load failed for %s", path)
            if raise_on_error:
                raise
            return None

    # First: if the path itself is a zarr store
    if prefer_zarr and HAS_ZARR:
        try:
            if _is_zarr_dir(path):
                logger.debug("Opening zarr store at %s", path)
                return zarr.open(path, mode="r", **zarr_kwargs)

            # If path ends with .npy but a sibling .zarr exists, prefer it
            if path.endswith(".npy"):
                sibling = path[:-4] + ".zarr"
                if _is_zarr_dir(sibling):
                    logger.debug("Found sibling zarr %s for %s", sibling, path)
                    return zarr.open(sibling, mode="r", **zarr_kwargs)

            # Also accept explicit .zarr filename
            if path.endswith(".zarr") and os.path.exists(path):
                logger.debug("Opening explicit zarr path %s", path)
                return zarr.open(path, mode="r", **zarr_kwargs)

        except Exception:
            logger.exception("Failed opening as zarr, will try numpy.load for %s", path)

    # Fallback to numpy load with mmap when requested
    try:
        logger.debug("Using numpy.load for %s (mmap_mode=%r)", path, mmap_mode)
        return np.load(path, mmap_mode=mmap_mode, allow_pickle=allow_pickle)
    except Exception:
        logger.exception("np.load failed for %s", path)
        # Try without mmap
        try:
            logger.debug("Retrying numpy.load without mmap for %s", path)
            return np.load(path, allow_pickle=allow_pickle)
        except Exception:
            logger.exception("np.load (no-mmap) failed for %s", path)
            if raise_on_error:
                raise
            return None


__all__ = ["load_array"]

