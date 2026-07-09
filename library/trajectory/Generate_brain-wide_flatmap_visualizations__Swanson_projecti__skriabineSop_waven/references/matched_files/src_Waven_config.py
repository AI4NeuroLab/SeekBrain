# Source: src/Waven/config.py
# Summary: See repo_context.md

"""Configuration helpers for Waven analysis pipelines.

The GUI historically stores values as strings so they can be edited in
text fields.  This module keeps that interface available while providing
typed, validated objects for scripts and tests.
"""
from __future__ import annotations

import ast
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

import numpy as np


DEFAULT_GABOR_PARAMS: Dict[str, str] = {
    "N_thetas": "8",
    "Sigmas": "[2, 3, 4, 5, 6, 8]",
    "Frequencies": "[0.015, 0.04, 0.07, 0.1]",
    "Phases": "[0, 90]",
    "NX": "135",
    "NY": "54",
    "Save Path": "/home/sophie/Documents/POSTDOC/TEMP/gabors_library.npy",
}

DEFAULT_ANALYSIS_PARAMS: Dict[str, str] = {
    "Path Directory": "/media/sophie/Expansion1/UCL/datatest/videos",
    "Dirs": "/media/sophie/Seagate Basic/datasets",
    "Experiment Info": "('SS002', '2024-07-23', 3)",
    "Number of Planes": "1",
    "Block End": "0",
    "screen_x": "4096",
    "screen_y": "1536",
    "NX": "135",
    "NY": "54",
    "Resolution": "1.3671",
    "Sigmas": "[2, 3, 4, 5, 6, 8]",
    "Sigmas Full Model": "[2, 4, 6, 8, 10]",
    "Frequencies": "[0.015, 0.04, 0.07, 0.1]",
    "Visual Coverage": "[-135, 45, 34, -34]",
    "Analysis Coverage": "[-135, 0, 34, -34]",
    "Hz": "30",
    "Number of Frames": "18000",
    "Number of Trials to Keep": "3",
    "Movie Path": (
        "/home/sophie/Documents/POSTDOC/TEMP/videos/"
        "perlin_stimulus_10min.mp4"
    ),
    "Library Path": "/home/sophie/Documents/POSTDOC/TEMP/gabors_library.npy",
    "Spks Path": "None",
    "Full Model Wavelet Path": "",
    "Full Model Save Path": "",
}

NONE_STRINGS = {"", "none", "null", "nil"}


def parse_literal(value: Any, field_name: str = "value") -> Any:
    """Parse a Python literal from a string without executing code."""
    if not isinstance(value, str):
        return value

    stripped = value.strip()
    if stripped.lower() in NONE_STRINGS:
        return None

    try:
        return ast.literal_eval(stripped)
    except (SyntaxError, ValueError) as exc:
        raise ValueError(f"Invalid literal for {field_name}: {value!r}") from exc


def parse_path(value: Any, field_name: str) -> Path:
    """Return a normalized path, expanding ``~`` and environment variables."""
    if value is None:
        raise ValueError(f"{field_name} is required")
    path = os.path.expandvars(os.path.expanduser(str(value)))
    return Path(path)


def parse_optional_path(value: Any) -> Optional[Path]:
    """Return ``None`` for empty/None-like values, otherwise a normalized path."""
    if value is None:
        return None
    if isinstance(value, str) and value.strip().lower() in NONE_STRINGS:
        return None
    return parse_path(value, "path")


def _as_tuple(value: Any, field_name: str) -> Tuple[Any, ...]:
    parsed = parse_literal(value, field_name)
    if parsed is None:
        return tuple()
    if isinstance(parsed, np.ndarray):
        parsed = parsed.tolist()
    if isinstance(parsed, (list, tuple)):
        return tuple(parsed)
    return (parsed,)


def _as_float_tuple(value: Any, field_name: str) -> Tuple[float, ...]:
    return tuple(float(item) for item in _as_tuple(value, field_name))


def _as_int(value: Any, field_name: str) -> int:
    parsed = parse_literal(value, field_name)
    if parsed is None:
        raise ValueError(f"{field_name} is required")
    return int(parsed)


def _as_float(value: Any, field_name: str) -> float:
    parsed = parse_literal(value, field_name)
    if parsed is None:
        raise ValueError(f"{field_name} is required")
    return float(parsed)


def _as_path_tuple(value: Any, field_name: str) -> Tuple[Path, ...]:
    if value is None:
        return tuple()

    if isinstance(value, str):
        stripped = value.strip()
        if stripped.lower() in NONE_STRINGS:
            return tuple()
        try:
            parsed = ast.literal_eval(stripped)
        except (SyntaxError, ValueError):
            return (parse_path(stripped, field_name),)
    else:
        parsed = value

    if parsed is None:
        return tuple()
    if isinstance(parsed, (list, tuple)):
        return tuple(parse_path(item, field_name) for item in parsed)
    return (parse_path(parsed, field_name),)


def _get(mapping: Mapping[str, Any], key: str, default: Any = None) -> Any:
    return mapping[key] if key in mapping else default


def _path_to_gui(path: Optional[Path]) -> str:
    return "None" if path is None else str(path)


@dataclass(frozen=True)
class GaborConfig:
    """Typed configuration for the Gabor filter library."""

    n_thetas: int
    sigmas: Tuple[float, ...]
    frequencies: Tuple[float, ...]
    phases: Tuple[float, ...]
    nx: int
    ny: int
    save_path: Path

    @classmethod
    def from_mapping(cls, mapping: Mapping[str, Any]) -> "GaborConfig":
        return cls(
            n_thetas=_as_int(_get(mapping, "N_thetas"), "N_thetas"),
            sigmas=_as_float_tuple(_get(mapping, "Sigmas"), "Sigmas"),
            frequencies=_as_float_tuple(
                _get(mapping, "Frequencies"),
                "Frequencies",
            ),
            phases=_as_float_tuple(_get(mapping, "Phases"), "Phases"),
            nx=_as_int(_get(mapping, "NX"), "NX"),
            ny=_as_int(_get(mapping, "NY"), "NY"),
            save_path=parse_path(_get(mapping, "Save Path"), "Save Path"),
        )

    @property
    def x_positions(self) -> np.ndarray:
        return np.arange(self.nx)

    @property
    def y_positions(self) -> np.ndarray:
        return np.arange(self.ny)

    @property
    def theta_radians(self) -> np.ndarray:
        return np.array(
            [(index * np.pi) / self.n_thetas for index in range(self.n_thetas)]
        )

    @property
    def sigmas_array(self) -> np.ndarray:
        return np.array(self.sigmas)

    @property
    def phases_array(self) -> np.ndarray:
        return np.array(self.phases)

    @property
    def frequencies_array(self) -> np.ndarray:
        return np.array(self.frequencies)

    @property
    def has_independent_frequencies(self) -> bool:
        return bool(self.frequencies) and any(freq != 0 for freq in self.frequencies)

    def to_gui_mapping(self) -> Dict[str, str]:
        return {
            "N_thetas": str(self.n_thetas),
            "Sigmas": repr(list(self.sigmas)),
            "Frequencies": repr(list(self.frequencies)),
            "Phases": repr(list(self.phases)),
            "NX": str(self.nx),
            "NY": str(self.ny),
            "Save Path": str(self.save_path),
        }


@dataclass(frozen=True)
class AnalysisConfig:
    """Typed configuration for stimulus, suite2p, and RF analysis."""

    path_directory: Path
    data_dirs: Tuple[Path, ...]
    experiment_info: Tuple[str, str, int]
    n_planes: int
    block_end: int
    screen_x: int
    screen_y: int
    nx: int
    ny: int
    resolution: float
    sigmas: Tuple[float, ...]
    sigmas_full_model: Tuple[float, ...]
    frequencies: Tuple[float, ...]
    visual_coverage: Tuple[float, float, float, float]
    analysis_coverage: Tuple[float, float, float, float]
    hz: int
    nb_frames: int
    n_trials_to_keep: int
    movie_path: Path
    library_path: Path
    spks_path: Optional[Path] = None
    full_model_wavelet_path: Optional[Path] = None
    full_model_save_path: Optional[Path] = None

    @classmethod
    def from_mapping(cls, mapping: Mapping[str, Any]) -> "AnalysisConfig":
        experiment_info = _as_tuple(
            _get(mapping, "Experiment Info"),
            "Experiment Info",
        )
        if len(experiment_info) != 3:
            raise ValueError("Experiment Info must be (mouse, date, number)")

        visual_coverage = _as_float_tuple(
            _get(mapping, "Visual Coverage"),
            "Visual Coverage",
        )
        analysis_coverage = _as_float_tuple(
            _get(mapping, "Analysis Coverage"),
            "Analysis Coverage",
        )
        if len(visual_coverage) != 4 or len(analysis_coverage) != 4:
            raise ValueError("Coverage values must contain four numbers")

        return cls(
            path_directory=parse_path(
                _get(mapping, "Path Directory"),
                "Path Directory",
            ),
            data_dirs=_as_path_tuple(_get(mapping, "Dirs"), "Dirs"),
            experiment_info=(
                str(experiment_info[0]),
                str(experiment_info[1]),
                int(experiment_info[2]),
            ),
            n_planes=_as_int(_get(mapping, "Number of Planes"), "Number of Planes"),
            block_end=_as_int(_get(mapping, "Block End"), "Block End"),
            screen_x=_as_int(_get(mapping, "screen_x"), "screen_x"),
            screen_y=_as_int(_get(mapping, "screen_y"), "screen_y"),
            nx=_as_int(_get(mapping, "NX"), "NX"),
            ny=_as_int(_get(mapping, "NY"), "NY"),
            resolution=_as_float(_get(mapping, "Resolution"), "Resolution"),
            sigmas=_as_float_tuple(_get(mapping, "Sigmas"), "Sigmas"),
            sigmas_full_model=_as_float_tuple(
                _get(mapping, "Sigmas Full Model"),
                "Sigmas Full Model",
            ),
            frequencies=_as_float_tuple(
                _get(mapping, "Frequencies"),
                "Frequencies",
            ),
            visual_coverage=visual_coverage,  # type: ignore[arg-type]
            analysis_coverage=analysis_coverage,  # type: ignore[arg-type]
            hz=_as_int(_get(mapping, "Hz"), "Hz"),
            nb_frames=_as_int(_get(mapping, "Number of Frames"), "Number of Frames"),
            n_trials_to_keep=_as_int(
                _get(mapping, "Number of Trials to Keep"),
                "Number of Trials to Keep",
            ),
            movie_path=parse_path(_get(mapping, "Movie Path"), "Movie Path"),
            library_path=parse_path(_get(mapping, "Library Path"), "Library Path"),
            spks_path=parse_optional_path(_get(mapping, "Spks Path")),
            full_model_wavelet_path=parse_optional_path(
                _get(mapping, "Full Model Wavelet Path"),
            ),
            full_model_save_path=parse_optional_path(
                _get(mapping, "Full Model Save Path"),
            ),
        )

    @property
    def data_dir_strings(self) -> Sequence[str]:
        return [str(path) for path in self.data_dirs]

    @property
    def experiment_dir(self) -> Path:
        if not self.data_dirs:
            raise ValueError("At least one data directory is required")
        subject, date, experiment_number = self.experiment_info
        return self.data_dirs[0] / subject / date / str(experiment_number)

    @property
    def suite2p_dir(self) -> Path:
        return self.experiment_dir / "suite2p"

    @property
    def screen_ratio(self) -> float:
        return abs(self.visual_coverage[0] - self.visual_coverage[1]) / self.nx

    @property
    def sigmas_array(self) -> np.ndarray:
        return np.array(self.sigmas)

    @property
    def sigmas_deg(self) -> np.ndarray:
        x_max, x_min, _, _ = self.analysis_coverage
        deg_per_pix = abs(x_max - x_min) / self.nx
        return np.trunc(2 * deg_per_pix * self.sigmas_array * 100) / 100

    @property
    def frames_per_minute(self) -> int:
        """Number of movie frames in one minute of stimulus."""
        return self.hz * 60

    def coverage_ratios(self) -> Tuple[float, float]:
        if self.visual_coverage == self.analysis_coverage:
            return 1.0, 1.0

        visual = np.array(self.visual_coverage)
        analysis = np.array(self.analysis_coverage)
        ratio_x = 1 - (
            ((visual[0] - visual[1]) - (analysis[0] - analysis[1]))
            / (visual[0] - visual[1])
        )
        ratio_y = 1 - (
            ((visual[2] - visual[3]) - (analysis[2] - analysis[3]))
            / (visual[2] - visual[3])
        )
        return float(ratio_x), float(ratio_y)

    def to_gui_mapping(self) -> Dict[str, str]:
        data_dirs = [str(path) for path in self.data_dirs]
        dirs_value = data_dirs[0] if len(data_dirs) == 1 else repr(data_dirs)
        return {
            "Path Directory": str(self.path_directory),
            "Dirs": dirs_value,
            "Experiment Info": repr(self.experiment_info),
            "Number of Planes": str(self.n_planes),
            "Block End": str(self.block_end),
            "screen_x": str(self.screen_x),
            "screen_y": str(self.screen_y),
            "NX": str(self.nx),
            "NY": str(self.ny),
            "Resolution": str(self.resolution),
            "Sigmas": repr(list(self.sigmas)),
            "Sigmas Full Model": repr(list(self.sigmas_full_model)),
            "Frequencies": repr(list(self.frequencies)),
            "Visual Coverage": repr(list(self.visual_coverage)),
            "Analysis Coverage": repr(list(self.analysis_coverage)),
            "Hz": str(self.hz),
            "Number of Frames": str(self.nb_frames),
            "Number of Trials to Keep": str(self.n_trials_to_keep),
            "Movie Path": str(self.movie_path),
            "Library Path": str(self.library_path),
            "Spks Path": _path_to_gui(self.spks_path),
            "Full Model Wavelet Path": _path_to_gui(self.full_model_wavelet_path),
            "Full Model Save Path": _path_to_gui(self.full_model_save_path),
        }


@dataclass(frozen=True)
class PipelineConfig:
    """Top-level configuration for a Waven analysis run."""

    gabor: GaborConfig
    analysis: AnalysisConfig

    @classmethod
    def from_mappings(
        cls,
        gabor_params: Optional[Mapping[str, Any]] = None,
        analysis_params: Optional[Mapping[str, Any]] = None,
    ) -> "PipelineConfig":
        merged_gabor = dict(DEFAULT_GABOR_PARAMS)
        merged_analysis = dict(DEFAULT_ANALYSIS_PARAMS)
        if gabor_params:
            merged_gabor.update(gabor_params)
        if analysis_params:
            merged_analysis.update(analysis_params)
        return cls(
            gabor=GaborConfig.from_mapping(merged_gabor),
            analysis=AnalysisConfig.from_mapping(merged_analysis),
        )

    @classmethod
    def from_json(cls, path: Path) -> "PipelineConfig":
        path = Path(path)
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return cls.from_mappings(
            payload.get("gabor", {}),
            payload.get("analysis", {}),
        )


def default_pipeline_config() -> PipelineConfig:
    """Return the default example configuration."""
    return PipelineConfig.from_mappings()
