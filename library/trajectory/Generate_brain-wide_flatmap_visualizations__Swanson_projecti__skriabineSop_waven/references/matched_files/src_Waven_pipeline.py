# Source: src/Waven/pipeline.py
# Summary: See repo_context.md

"""High-level orchestration for Waven analysis.

The functions here deliberately delegate numerical work to the existing
modules.  Their job is to make execution explicit, reusable, and easier
to validate than a long top-level script.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional, Sequence, Tuple

import numpy as np

from .config import AnalysisConfig, GaborConfig, PipelineConfig

DEFAULT_MOVIE_FRAME_RATE_HZ = 30
SECONDS_PER_MINUTE = 60
DEFAULT_FRAMES_PER_MINUTE = (
    DEFAULT_MOVIE_FRAME_RATE_HZ * SECONDS_PER_MINUTE
)


@dataclass
class SpikeData:
    """Spike responses and corrected neuron positions."""

    spikes: np.ndarray
    aligned_spikes: Optional[np.ndarray]
    neuron_pos: np.ndarray


@dataclass
class WaveletData:
    """Coarse wavelet data used by the RF and model analyses."""

    wavelets_r: np.ndarray
    wavelets_i: np.ndarray
    wavelets_complex: np.ndarray


@dataclass
class RFAnalysisResult:
    """Outputs from repeatability and receptive-field analysis."""

    repeatability: np.ndarray
    rf_results: Tuple[Any, ...]
    wavelets: WaveletData


@dataclass
class SimpleModelResult:
    """Outputs from the fast nonlinear model."""

    raw_best_params: np.ndarray
    smoothed_best_params: np.ndarray
    predictions: np.ndarray
    nonlin_params: np.ndarray
    rho_phi_params: np.ndarray
    metrics: np.ndarray
    interpolators: Sequence[Any]


@dataclass
class PipelineOutputs:
    """Container returned by :func:`run_pipeline`."""

    gabor_library_path: Optional[Path] = None
    spike_data: Optional[SpikeData] = None
    rf_analysis: Optional[RFAnalysisResult] = None
    simple_model: Optional[SimpleModelResult] = None
    full_model: Optional[Tuple[Any, ...]] = None


def require_file(path: Path, label: str) -> None:
    """Raise a clear error when an expected input file is missing."""
    if not path.exists():
        raise FileNotFoundError(f"{label} not found: {path}")


def require_directory(path: Path, label: str) -> None:
    """Raise a clear error when an expected input directory is missing."""
    if not path.exists() or not path.is_dir():
        raise FileNotFoundError(f"{label} not found: {path}")


def legacy_directory_string(path: Path) -> str:
    """Return a directory string compatible with legacy path concatenation."""
    path_string = str(path)
    if path_string.endswith(("/", "\\")):
        return path_string
    return path_string + os.sep


def validate_spike_data(spikes: np.ndarray, neuron_pos: np.ndarray) -> None:
    """Validate the core shape contract used by the analysis functions."""
    if spikes.ndim != 3:
        raise ValueError(
            "Spike data must have shape "
            "(n_trials, n_timepoints, n_neurons)"
        )
    if neuron_pos.ndim != 2:
        raise ValueError("Neuron positions must be a 2D array")
    if neuron_pos.shape[0] != spikes.shape[2]:
        raise ValueError(
            "Neuron position count does not match spike neuron count: "
            f"{neuron_pos.shape[0]} != {spikes.shape[2]}"
        )


def create_gabor_library(config: GaborConfig) -> Path:
    """Create and save the Gabor filter library described by ``config``."""
    from . import WaveletGenerator as wg

    if config.has_independent_frequencies:
        filter_library = wg.makeFilterLibrary2(
            config.x_positions,
            config.y_positions,
            config.theta_radians,
            config.sigmas_array,
            config.phases_array,
            config.frequencies_array,
        )
    else:
        frequency = config.frequencies[0] if config.frequencies else 0.0
        filter_library = wg.makeFilterLibrary(
            config.x_positions,
            config.y_positions,
            config.theta_radians,
            config.sigmas_array,
            config.phases_array,
            frequency,
            freq=False,
        )

    config.save_path.parent.mkdir(parents=True, exist_ok=True)
    np.save(config.save_path, filter_library)
    return config.save_path


def prepare_stimulus_wavelets(
    analysis: AnalysisConfig,
    library_path: Optional[Path] = None,
    chunk_size: int = 1000,
) -> Path:
    """Downsample the stimulus movie and save both wavelet phases."""
    from . import WaveletGenerator as wg

    library_path = library_path or analysis.library_path
    require_file(analysis.movie_path, "Stimulus movie")
    require_file(library_path, "Gabor library")

    analysis.path_directory.mkdir(parents=True, exist_ok=True)
    ratio_x, ratio_y = analysis.coverage_ratios()
    wg.downsample_video_binary(
        str(analysis.movie_path),
        np.array(analysis.visual_coverage),
        np.array(analysis.analysis_coverage),
        shape=(analysis.ny, analysis.nx),
        chunk_size=chunk_size,
        ratios=(ratio_x, ratio_y),
    )

    downsampled_path = analysis.movie_path.with_name(
        f"{analysis.movie_path.stem}_downsampled.npy"
    )
    require_file(downsampled_path, "Downsampled stimulus")
    video_data = np.load(downsampled_path)
    video_data = (
        video_data.astype(int)
        - np.logical_not(video_data).astype(int)
    )

    wg.waveletDecomposition(
        video_data,
        0,
        analysis.sigmas_array,
        str(analysis.path_directory),
        str(library_path),
    )
    wg.waveletDecomposition(
        video_data,
        1,
        analysis.sigmas_array,
        str(analysis.path_directory),
        str(library_path),
    )
    return analysis.path_directory


def load_spikes_and_positions(
    analysis: AnalysisConfig,
    threshold: float = 1.25,
    method: str = "frame2ttl",
) -> SpikeData:
    """Load spike responses and neuron positions from suite2p or npy files."""
    from . import LoadPinkNoise as lpn

    if analysis.spks_path is None:
        require_directory(analysis.suite2p_dir, "suite2p directory")
        spikes, aligned_spikes, neuron_pos = lpn.loadSPKMesoscope(
            analysis.experiment_info,
            list(analysis.data_dir_strings),
            str(analysis.suite2p_dir),
            analysis.block_end,
            analysis.n_planes,
            analysis.nb_frames,
            threshold=threshold,
            last=True,
            method=method,
        )
    else:
        require_file(analysis.spks_path, "Spike file")
        spikes = np.load(analysis.spks_path)
        pos_path = analysis.spks_path.parent / "pos.npy"
        require_file(pos_path, "Neuron position file")
        neuron_pos = np.load(pos_path)
        aligned_spikes = None

    # neuron_pos = lpn.correctNeuronPos(neuron_pos, analysis.resolution)
    validate_spike_data(spikes, neuron_pos)
    return SpikeData(spikes=spikes, aligned_spikes=aligned_spikes, neuron_pos=neuron_pos)


def load_coarse_wavelets(analysis: AnalysisConfig, gabor: GaborConfig) -> WaveletData:
    """Load or create the coarse wavelet arrays used for RF estimation."""
    from . import LoadPinkNoise as lpn

    wavelets_r, wavelets_i, wavelets_complex = lpn.coarseWavelet(
        str(analysis.path_directory),
        False,
        nx0=analysis.nx,
        ny0=analysis.ny,
        nx=27,
        ny=11,
        no=gabor.n_thetas,
        ns=len(analysis.sigmas),
    )
    return WaveletData(
        wavelets_r=wavelets_r,
        wavelets_i=wavelets_i,
        wavelets_complex=wavelets_complex,
    )


def run_rf_analysis(
    analysis: AnalysisConfig,
    gabor: GaborConfig,
    spike_data: SpikeData,
    plotting: bool = True,
    neuron_id: Optional[int] = 2441,
) -> RFAnalysisResult:
    """Compute repeatability, RFs, and optional example tuning plots."""
    from . import Analysis_Utils as au

    repeatability = au.repetability_trial3(
        spike_data.spikes,
        spike_data.neuron_pos,
        plotting=plotting,
    )
    wavelets = load_coarse_wavelets(analysis, gabor)

    n_frames = min(
        analysis.nb_frames,
        wavelets.wavelets_complex.shape[0],
        spike_data.spikes.shape[1],
    )
    stimulus = wavelets.wavelets_complex[:n_frames].reshape(n_frames, -1)
    response = np.mean(spike_data.spikes[:, :n_frames], axis=0)
    rf_results = au.PearsonCorrelationPinkNoise(
        stimulus,
        response,
        spike_data.neuron_pos,
        27,
        11,
        len(analysis.sigmas),
        analysis.analysis_coverage,
        analysis.screen_ratio,
        analysis.sigmas_deg,
        plotting=plotting,
    )

    if (
        plotting
        and neuron_id is not None
        and 0 <= neuron_id < rf_results[0].shape[0]
    ):
        au.Plot_RF(
            rf_results[0][neuron_id],
            4,
            title=np.max(rf_results[0][neuron_id]),
        )
        au.PlotTuningCurve(
            rf_results,
            neuron_id,
            analysis.analysis_coverage,
            analysis.sigmas_deg,
            analysis.screen_ratio,
        )

    return RFAnalysisResult(
        repeatability=repeatability,
        rf_results=rf_results,
        wavelets=wavelets,
    )


def smooth_best_positions(
    raw_best_params: np.ndarray,
    neuron_pos: np.ndarray,
    radius_um: float = 30.0,
) -> np.ndarray:
    """Smooth preferred x/y positions by nearby neuron medians."""
    from scipy.spatial import cKDTree

    smoothed_best_params = raw_best_params.copy()
    tree = cKDTree(neuron_pos)
    neighbourhoods = tree.query_ball_tree(tree, radius_um, p=2)

    new_x = np.zeros_like(raw_best_params[0])
    new_y = np.zeros_like(raw_best_params[1])
    for neuron_index, neighbours in enumerate(neighbourhoods):
        new_x[neuron_index] = np.median(raw_best_params[0, neighbours])
        new_y[neuron_index] = np.median(raw_best_params[1, neighbours])

    smoothed_best_params[0, :] = new_x
    smoothed_best_params[1, :] = new_y
    return smoothed_best_params


def run_simple_model(
    rf_analysis: RFAnalysisResult,
    spike_data: SpikeData,
    dt1: int = 9000,
    n_min: int = 5,
    double_wavelet_model: bool = False,
    frames_per_minute: Optional[int] = None,
) -> SimpleModelResult:
    """Run the fast nonlinear model for all neurons."""
    from . import Analysis_Utils as au

    if frames_per_minute is None:
        frames_per_minute = DEFAULT_FRAMES_PER_MINUTE

    raw_best_params = np.array(rf_analysis.rf_results[1])
    smoothed_best_params = smooth_best_positions(
        raw_best_params,
        spike_data.neuron_pos,
    )
    results = au.run_Model(
        smoothed_best_params,
        raw_best_params,
        spike_data.spikes,
        rf_analysis.wavelets.wavelets_i,
        rf_analysis.wavelets.wavelets_r,
        dt1=dt1,
        n_min=n_min,
        double_wavelet_model=double_wavelet_model,
        frames_per_minute=frames_per_minute,
    )
    predictions, nonlin_params, rho_phi_params, metrics, interpolators = results
    return SimpleModelResult(
        raw_best_params=raw_best_params,
        smoothed_best_params=smoothed_best_params,
        predictions=predictions,
        nonlin_params=nonlin_params,
        rho_phi_params=rho_phi_params,
        metrics=metrics,
        interpolators=interpolators,
    )


def run_full_model(
    config: PipelineConfig,
    spike_data: SpikeData,
    rf_analysis: RFAnalysisResult,
    idxs: Optional[Sequence[int]] = None,
    n_min: int = 5,
    tt: Optional[Sequence[int]] = None,
) -> Tuple[Any, ...]:
    """Run the high-granularity model using configured external paths."""
    from . import Analysis_Utils as au

    analysis = config.analysis
    wavelet_path = analysis.full_model_wavelet_path
    save_path = analysis.full_model_save_path
    print('wavelet_path:', wavelet_path)
    if wavelet_path is None or save_path is None:
        raise ValueError(
            "Full Model Wavelet Path and Full Model Save Path are required"
        )
    raw_best_params = np.array(rf_analysis.rf_results[1])
    smoothed_best_params = smooth_best_positions(
        raw_best_params,
        spike_data.neuron_pos,
    )
    return au.run_Full_Model(
        raw_best_params,
        smoothed_best_params,
        spike_data.spikes,
        idxs,
        config.gabor.theta_radians,
        analysis.sigmas_array,
        np.array(analysis.frequencies),
        analysis.visual_coverage,
        spike_data.neuron_pos,
        wavelet_path=legacy_directory_string(wavelet_path),
        savepath=legacy_directory_string(save_path),
        n_min=n_min,
        tt=list(tt or [0, analysis.nb_frames]),
        memmapping=True,
        train_idx=[0, 2],
        test_idx=[1, 3],
        double_wavelet_model=False,
        lastmin=False,
        plotting=False,
        frames_per_minute=analysis.frames_per_minute,
        hz=analysis.hz,
    )


def run_pipeline(
    config: PipelineConfig,
    *,
    run_gabor: bool = False,
    run_wavelets: bool = False,
    run_model: bool = False,
    run_full: bool = False,
    plotting: bool = True,
    neuron_id: Optional[int] = 2441,
) -> PipelineOutputs:
    """Run the configurable Waven analysis pipeline."""
    outputs = PipelineOutputs()
    library_path = config.analysis.library_path

    if run_gabor:
        library_path = create_gabor_library(config.gabor)
        outputs.gabor_library_path = library_path

    if run_wavelets:
        prepare_stimulus_wavelets(config.analysis, library_path=library_path)

    spike_data = load_spikes_and_positions(config.analysis)
    outputs.spike_data = spike_data

    rf_analysis = run_rf_analysis(
        config.analysis,
        config.gabor,
        spike_data,
        plotting=plotting,
        neuron_id=neuron_id,
    )
    outputs.rf_analysis = rf_analysis

    if run_model or run_full:
        simple_model = run_simple_model(
            rf_analysis,
            spike_data,
            frames_per_minute=config.analysis.frames_per_minute,
        )
        outputs.simple_model = simple_model
    else:
        simple_model = None

    if run_full:
        if simple_model is None:
            raise RuntimeError("Full model requires simple model outputs")
        outputs.full_model = run_full_model(config, spike_data, rf_analysis)

    return outputs
