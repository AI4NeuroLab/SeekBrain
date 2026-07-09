# Source: wavelet_zarr.py
# Summary: See repo_context.md


import numpy as np
import zarr
from numcodecs import Blosc
from tqdm import trange
import os

# ======================
# CONFIG
# ======================
path = "/media/sophie/Expansion1/UCL/datatest/videos/2screens/30/"

npy_i = os.path.join(path, "dwt_videodata2_i.npy")
npy_r = os.path.join(path, "dwt_videodata2_r.npy")

path='/home/sophie/Documents/POSTDOC/TEMP/'
zarr_i = os.path.join(path, "dwt_videodata2_i.zarr")
zarr_r = os.path.join(path, "dwt_videodata2_r.zarr")

chunks = (1800, 1, 1, 8, 5, 4)

compressor = Blosc(
    cname="zstd",
    clevel=3,
    shuffle=Blosc.BITSHUFFLE,
)

# ======================
# LOAD NPY AS MEMMAP
# ======================
print("Opening NPY as memmap...")
w_i = np.load(npy_i, mmap_mode="r")
w_r = np.load(npy_r, mmap_mode="r")

assert w_i.shape == w_r.shape
shape = w_i.shape
dtype = w_i.dtype

print("Shape:", shape)
print("Dtype:", dtype)

# ======================
# CREATE ZARR ARRAYS
# ======================
print("Creating Zarr arrays...")

z_i = zarr.open(
    zarr_i,
    mode="w",
    shape=shape,
    chunks=chunks,
    dtype=dtype,
    compressor=compressor,
)

z_r = zarr.open(
    zarr_r,
    mode="w",
    shape=shape,
    chunks=chunks,
    dtype=dtype,
    compressor=compressor,
)

# ======================
# COPY DATA BY TIME CHUNKS
# ======================
t_chunk = chunks[0]
nT = shape[0]

print("Converting...")
for t in trange(0, nT, t_chunk, desc="Time chunks"):
    t1 = min(t + t_chunk, nT)

    # Important: slice only time, rest stays contiguous
    z_i[t:t1] = w_i[t:t1]
    z_r[t:t1] = w_r[t:t1]

print("✅ Conversion finished successfully.")
print("Zarr files written:")
print(zarr_i)
print(zarr_r)