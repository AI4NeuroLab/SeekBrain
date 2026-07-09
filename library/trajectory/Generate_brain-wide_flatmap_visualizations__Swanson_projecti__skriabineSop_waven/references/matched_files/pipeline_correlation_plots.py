# Source: pipeline_correlation_plots.py
# Summary: See repo_context.md

"""Run RF correlation analysis and plot RF/retinotopic maps.

This remains a convenient workspace script, but the reusable parts now come
from the public ``waven`` package API.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Optional, Sequence


PROJECT_ROOT = Path(__file__).resolve().parent
SRC_DIR = PROJECT_ROOT / "src"
if SRC_DIR.exists() and str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from waven.config import PipelineConfig
from waven.pipeline import load_spikes_and_positions, run_rf_analysis
from waven.plotting import (
    plot_retinotopic_maps,
    plot_rf_grid,
    plot_sign_map,
    save_figures,
)


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run Waven RF correlation analysis and plot maps."
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=PROJECT_ROOT / "pipeline_config.json",
        help="JSON config file. Defaults to pipeline_config.json.",
    )
    parser.add_argument(
        "--neuron-id",
        type=int,
        default=2441,
        help="Neuron index to use for the RF and tuning plots.",
    )
    parser.add_argument(
        "--save-dir",
        type=Path,
        help="Optional directory where figures are saved as PNG files.",
    )
    parser.add_argument(
        "--no-show",
        action="store_true",
        help="Do not open plot windows. Useful with --save-dir.",
    )
    parser.add_argument(
        "--skip-sign-map",
        action="store_true",
        help="Skip visual-sign-map computation.",
    )
    return parser.parse_args(argv)


def configure_backend(no_show: bool) -> None:
    """Use a non-interactive backend only for file-only plotting."""
    os.environ.setdefault("MPLCONFIGDIR", "/tmp/waven-matplotlib")
    if no_show:
        os.environ["WAVEN_NO_PLOTS"] = "1"
        os.environ.setdefault("MPLBACKEND", "Agg")


def main(argv: Optional[Sequence[str]] = None) -> None:
    args = parse_args(argv)
    configure_backend(args.no_show)

    import matplotlib.pyplot as plt
    from Waven import Analysis_Utils as au

    config = PipelineConfig.from_json(args.config)
    spike_data = load_spikes_and_positions(config.analysis)
    rf_analysis = run_rf_analysis(
        config.analysis,
        config.gabor,
        spike_data,
        plotting=False,
        neuron_id=None,
    )
    rf_results = rf_analysis.rf_results

    if not 0 <= args.neuron_id < rf_results[0].shape[0]:
        raise ValueError(
            f"neuron-id {args.neuron_id} is outside "
            f"0..{rf_results[0].shape[0] - 1}"
        )

    figures = [
        (
            "selected_neuron_rf",
            plot_rf_grid(
                rf_results[0][args.neuron_id],
                config.analysis.sigmas_deg,
                f"Neuron {args.neuron_id} RF correlation",
            ),
        ),
        (
            "retinotopic_maps",
            plot_retinotopic_maps(spike_data.neuron_pos, rf_results),
        ),
    ]

    before = set(plt.get_fignums())
    au.PlotTuningCurve(
        rf_results,
        args.neuron_id,
        config.analysis.analysis_coverage,
        config.analysis.sigmas_deg,
        config.analysis.screen_ratio,
    )
    for index, figure_number in enumerate(sorted(set(plt.get_fignums()) - before)):
        figures.append((f"selected_neuron_tuning_{index}", plt.figure(figure_number)))

    if not args.skip_sign_map:
        figures.append(
            (
                "visual_sign_map",
                plot_sign_map(spike_data.neuron_pos, rf_results),
            )
        )

    save_figures(figures, args.save_dir)

    if not args.no_show:
        plt.show()


if __name__ == "__main__":
    main()
