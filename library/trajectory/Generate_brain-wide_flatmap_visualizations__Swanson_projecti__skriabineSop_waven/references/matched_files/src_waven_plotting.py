# Source: src/waven/plotting.py
# Summary: See repo_context.md

"""Plotting helpers for Waven RF correlation analysis."""
from __future__ import annotations

from pathlib import Path
from typing import Iterable, Optional, Sequence, Tuple

import numpy as np


def finite_abs_max(values: np.ndarray, fallback: float = 1.0) -> float:
    """Return a finite absolute max, with a nonzero fallback for color scales."""
    if values.size == 0:
        return fallback
    max_value = np.nanmax(np.abs(values))
    if not np.isfinite(max_value) or max_value == 0:
        return fallback
    return float(max_value)


def plot_rf_grid(
    rf: np.ndarray,
    sigmas_deg: Sequence[float],
    title: str,
):
    """Plot one neuron's RF tensor as orientation x size panels."""
    import matplotlib.pyplot as plt

    n_orientations = rf.shape[2]
    n_sizes = rf.shape[3]
    fig, axes = plt.subplots(
        n_orientations,
        n_sizes,
        figsize=(1.7 * n_sizes, 1.15 * n_orientations),
        constrained_layout=True,
        squeeze=False,
    )
    vmax = finite_abs_max(rf)
    image = None
    for orientation_index in range(n_orientations):
        for size_index in range(n_sizes):
            ax = axes[orientation_index, size_index]
            image = ax.imshow(
                rf[:, :, orientation_index, size_index].T,
                cmap="coolwarm",
                vmin=-vmax,
                vmax=vmax,
                origin="lower",
                aspect="auto",
            )
            ax.set_xticks([])
            ax.set_yticks([])
            if orientation_index == 0:
                ax.set_title(f"size {sigmas_deg[size_index]:.2g}")
            if size_index == 0:
                ax.set_ylabel(f"ori {orientation_index}")

    fig.suptitle(title)
    if image is not None:
        fig.colorbar(image, ax=axes, shrink=0.7)
    return fig


def plot_retinotopic_maps(
    neuron_pos: np.ndarray,
    rf_results: Tuple[object, ...],
):
    """Plot peak correlation and preferred visual features over neurons."""
    import matplotlib.pyplot as plt

    _, _, maxe_corr, peak_correlations = rf_results
    maps = [
        ("Peak correlation", np.asarray(peak_correlations), "Greys"),
        ("Azimuth (deg)", np.asarray(maxe_corr[0]), "jet"),
        ("Elevation (deg)", np.asarray(maxe_corr[1]), "jet"),
        ("Orientation (deg)", np.asarray(maxe_corr[2]), "hsv"),
        ("Size (deg)", np.asarray(maxe_corr[3]), "coolwarm"),
    ]

    fig, axes = plt.subplots(2, 3, figsize=(13, 8), constrained_layout=True)
    axes_flat = axes.ravel()
    for ax, (title, values, cmap) in zip(axes_flat, maps):
        scatter = ax.scatter(
            neuron_pos[:, 1],
            neuron_pos[:, 0],
            s=5,
            c=values,
            cmap=cmap,
        )
        ax.set_title(title)
        ax.set_xlabel("position x (um)")
        ax.set_ylabel("position y (um)")
        fig.colorbar(scatter, ax=ax)

    axes_flat[-1].axis("off")
    fig.suptitle("RF correlation retinotopic maps")
    return fig


def plot_sign_map(
    neuron_pos: np.ndarray,
    rf_results: Tuple[object, ...],
):
    """Plot visual sign map from preferred azimuth/elevation."""
    import matplotlib.pyplot as plt
    from Waven import Analysis_Utils as au

    _, _, maxe_corr, _ = rf_results
    preferred_xy = np.vstack([maxe_corr[0], maxe_corr[1]])
    sign_map, sign_map_neurons = au.getSignMap(
        neuron_pos,
        preferred_xy,
        plotting=False,
    )

    vmax = finite_abs_max(sign_map)
    fig, axes = plt.subplots(1, 2, figsize=(11, 4), constrained_layout=True)
    image = axes[0].imshow(
        sign_map,
        cmap="coolwarm",
        vmin=-vmax,
        vmax=vmax,
        origin="lower",
    )
    axes[0].set_title("Visual sign map")
    fig.colorbar(image, ax=axes[0])

    scatter = axes[1].scatter(
        neuron_pos[:, 1],
        neuron_pos[:, 0],
        s=5,
        c=sign_map_neurons,
        cmap="coolwarm",
        vmin=-vmax,
        vmax=vmax,
    )
    axes[1].set_title("Visual sign at neuron positions")
    axes[1].set_xlabel("position x (um)")
    axes[1].set_ylabel("position y (um)")
    fig.colorbar(scatter, ax=axes[1])
    return fig


def save_figures(
    figures: Iterable[Tuple[str, object]],
    save_dir: Optional[Path],
) -> None:
    """Save named matplotlib figures to ``save_dir`` when provided."""
    if save_dir is None:
        return

    save_dir.mkdir(parents=True, exist_ok=True)
    for name, fig in figures:
        fig.savefig(save_dir / f"{name}.png", dpi=150, bbox_inches="tight")


__all__ = [
    "finite_abs_max",
    "plot_retinotopic_maps",
    "plot_rf_grid",
    "plot_sign_map",
    "save_figures",
]
