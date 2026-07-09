# Source: examples/example.py
# Summary: See repo_context.md

"""Example entry point for the Waven analysis pipeline.

Run the GUI:
    python example.py

Run the batch RF pipeline:
    python example.py --run

Create wavelets/Gabor libraries explicitly:
    python example.py --run --create-gabor --wavelets --model
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Optional, Sequence
import matplotlib
matplotlib.use("TkAgg")  # or "TkAgg" or "inline"

PROJECT_ROOT = Path(__file__).resolve().parent
SRC_DIR = PROJECT_ROOT / "src"
if SRC_DIR.exists() and str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from Waven.config import PipelineConfig, default_pipeline_config
from Waven.pipeline import run_pipeline


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    """Parse command-line options for GUI or batch execution."""
    parser = argparse.ArgumentParser(description="Run Waven analysis.")
    parser.add_argument(
        "--config",
        type=Path,
        help="Optional JSON config with 'gabor' and 'analysis' sections.",
    )
    parser.add_argument(
        "--gui",
        action="store_true",
        help="Open the Tkinter GUI. This is the default when no action is given.",
    )
    parser.add_argument(
        "--run",
        action="store_true",
        help="Run the batch receptive-field pipeline.",
    )
    parser.add_argument(
        "--create-gabor",
        action="store_true",
        help="Create the Gabor library before running analysis.",
    )
    parser.add_argument(
        "--wavelets",
        action="store_true",
        help="Downsample the movie and compute wavelet decompositions.",
    )
    parser.add_argument(
        "--model",
        action="store_true",
        help="Run the fast nonlinear model after RF analysis.",
    )
    parser.add_argument(
        "--full-model",
        action="store_true",
        help="Run the high-granularity model after RF analysis.",
    )
    parser.add_argument(
        "--no-plots",
        action="store_true",
        help="Disable plotting during analysis.",
    )
    parser.add_argument(
        "--neuron-id",
        type=int,
        default=2441,
        help="Neuron id to plot when plotting is enabled.",
    )
    return parser.parse_args(argv)


def load_config(config_path: Optional[Path]) -> PipelineConfig:
    """Load JSON configuration or fall back to the example defaults."""
    if config_path is None:
        return default_pipeline_config()
    return PipelineConfig.from_json(config_path)


def run_gui(config: PipelineConfig) -> None:
    """Open the Tkinter GUI with the same typed defaults."""
    from Waven import zebraGUI as ui

    ui.run(
        config.analysis.to_gui_mapping(),
        config.gabor.to_gui_mapping(),
    )


def main(argv: Optional[Sequence[str]] = None) -> None:
    """Run GUI or batch mode."""
    args = parse_args(argv)
    config = load_config(args.config)

    no_batch_action = not any(
        [
            args.run,
            args.create_gabor,
            args.wavelets,
            args.model,
            args.full_model,
        ]
    )
    if args.gui or no_batch_action:
        run_gui(config)
        return

    if args.no_plots:
        os.environ["WAVEN_NO_PLOTS"] = "1"
        os.environ.setdefault("MPLBACKEND", "Agg")

    run_pipeline(
        config,
        run_gabor=args.create_gabor,
        run_wavelets=args.wavelets,
        run_model=args.model,
        run_full=args.full_model,
        plotting=not args.no_plots,
        neuron_id=args.neuron_id,
    )


if __name__ == "__main__":
    main()
