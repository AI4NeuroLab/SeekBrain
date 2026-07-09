# Source: tests/test_zarr_compat.py
# Summary: See repo_context.md

import numpy as np
import zarr
from pathlib import Path

from Waven.zarr_compat import load_array


def test_load_prefers_zarr(tmp_path: Path):
    arr = np.arange(12).reshape(3, 4)
    npy_path = tmp_path / "a.npy"
    zarr_path = tmp_path / "a.zarr"

    np.save(npy_path, arr)
    zarr.save(str(zarr_path), arr)

    # load explicit zarr
    loaded = load_array(str(zarr_path))
    assert loaded.shape == arr.shape
    assert int(loaded[1, 2]) == int(arr[1, 2])

    # load npy path should prefer sibling .zarr
    loaded2 = load_array(str(npy_path))
    assert loaded2.shape == arr.shape
    assert int(loaded2[2, 3]) == int(arr[2, 3])


def test_load_numpy_memmap_fallback(tmp_path: Path):
    arr = np.arange(20)
    npy_path = tmp_path / "b.npy"
    np.save(npy_path, arr)

    loaded = load_array(str(npy_path), mmap_mode='r')
    assert loaded.shape == arr.shape
    assert int(loaded[5]) == int(arr[5])


def test_allow_pickle_skips_zarr(tmp_path: Path):
    obj = {'x': 1, 'y': [1,2,3]}
    pickled = tmp_path / "p.npy"
    np.save(pickled, obj, allow_pickle=True)

    loaded = load_array(str(pickled), allow_pickle=True)
    # When allow_pickle=True we expect the original object (numpy may wrap it)
    if isinstance(loaded, np.ndarray):
        assert loaded.shape == ()
        assert loaded[()] == obj
    else:
        assert loaded == obj

