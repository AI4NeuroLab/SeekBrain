# Source: examples/run_waven_parts.py
# Summary: See repo_context.md


import os
import sys
from pathlib import Path
from typing import Optional, Sequence
import matplotlib
import numpy as np

matplotlib.use("TkAgg")  # or "TkAgg" or "inline"
import matplotlib.pyplot as plt
import waven


from waven.pipeline import (  # noqa: E402
    create_gabor_library,
    load_spikes_and_positions,
    prepare_stimulus_wavelets,
    run_full_model,
    run_rf_analysis,
    run_simple_model,
)
from waven.plotting import (  # noqa: E402
    plot_retinotopic_maps,
    plot_rf_grid,
    plot_sign_map,
    save_figures,
)
from waven.analysis_utils import PlotTuningCurve

# def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
#     parser = argparse.ArgumentParser(
#         description="Import Waven and run selected pipeline pieces."
#     )
#     parser.add_argument(
#         "--config",
#         type=Path,
#         default=PROJECT_ROOT / "pipeline_config.json",
#         help="JSON config file. Defaults to pipeline_config.json.",
#     )
#     parser.add_argument(
#         "--create-gabor",
#         action="store_true",
#         help="Create the Gabor filter library.",
#     )
#     parser.add_argument(
#         "--wavelets",
#         action="store_true",
#         help="Downsample the movie and compute wavelet decompositions.",
#     )
#     parser.add_argument(
#         "--rf",
#         action="store_true",
#         help="Run repeatability and RF correlation analysis.",
#     )
#     parser.add_argument(
#         "--model",
#         action="store_true",
#         help="Run the simple nonlinear model after RF analysis.",
#     )
#     parser.add_argument(
#         "--full-model",
#         action="store_true",
#         help="Run the full model after the simple model.",
#     )
#     parser.add_argument(
#         "--plot-rf",
#         action="store_true",
#         help="Plot selected-neuron RF and retinotopic maps after RF analysis.",
#     )
#     parser.add_argument(
#         "--neuron-id",
#         type=int,
#         default=2441,
#         help="Neuron index to plot when --plot-rf is used.",
#     )
#     parser.add_argument(
#         "--save-dir",
#         type=Path,
#         help="Optional directory where generated figures are saved.",
#     )
#     parser.add_argument(
#         "--no-show",
#         action="store_true",
#         help="Do not open plot windows. Useful with --save-dir.",
#     )
#     parser.add_argument(
#         "--skip-sign-map",
#         action="store_true",
#         help="Skip visual-sign-map plotting.",
#     )
#     return parser.parse_args(argv)
#
#
# def configure_backend(no_show: bool) -> None:
#     """Use a non-interactive backend only for file-only plotting."""
#     os.environ.setdefault("MPLCONFIGDIR", "/tmp/waven-matplotlib")
#     if no_show:
#         os.environ["WAVEN_NO_PLOTS"] = "1"
#         os.environ.setdefault("MPLBACKEND", "Agg")
#
#
# args = parse_args(argv)
# configure_backend(args.no_show)

#
# if not any(
#     [
#         args.create_gabor,
#         args.wavelets,
#         args.rf,
#         args.model,
#         args.full_model,
#         args.plot_rf,
#     ]
# ):
#     args.rf = True
#     args.plot_rf = True

config = waven.PipelineConfig.from_json(Path('/home/sophie/Projects/ZebrAnalysis/zebranalysis/pipeline_config.json'))
library_path = config.analysis.library_path
create_library=False
prepare_wavelets=False
plot_rf=True

#
if create_library:
    library_path = create_gabor_library(config.gabor)
    print(f"Created Gabor library: {library_path}")

if prepare_wavelets:
    output_dir = prepare_stimulus_wavelets(
        config.analysis,
        library_path=library_path,
    )
    print(f"Prepared wavelets in: {output_dir}")


spike_data = load_spikes_and_positions(config.analysis)

rf_analysis = run_rf_analysis(
    config.analysis,
    config.gabor,
    spike_data,
    plotting=True,
    neuron_id=2441,
)
print("RF correlation analysis complete")


full_model = run_full_model(config, spike_data, rf_analysis, tt = [0, 36000])
print(f"Full model complete: {type(full_model).__name__}")



neuron_id = 2441
no_show=True
save_dir = config.analysis.full_model_save_path
if plot_rf:
    rf_results = rf_analysis.rf_results
    if not 0 <= neuron_id < rf_results[0].shape[0]:
        raise ValueError(
            f"neuron-id {neuron_id} is outside "
            f"0..{rf_results[0].shape[0] - 1}"
        )

    figures = [
        (
            "selected_neuron_rf",
            plot_rf_grid(
                rf_results[0][neuron_id],
                config.analysis.sigmas_deg,
                f"Neuron {neuron_id} RF correlation",
            ),
        ),
        (
            "retinotopic_maps",
            plot_retinotopic_maps(spike_data.neuron_pos, rf_results),
        ),
    ]

    before = set(plt.get_fignums())
    PlotTuningCurve(
        rf_results,
        neuron_id,
        config.analysis.analysis_coverage,
        config.analysis.sigmas_deg,
        config.analysis.screen_ratio,
    )
    for index, figure_number in enumerate(
        sorted(set(plt.get_fignums()) - before)
    ):
        figures.append(
            (f"selected_neuron_tuning_{index}", plt.figure(figure_number))
        )

        figures.append(
            (
                "visual_sign_map",
                plot_sign_map(spike_data.neuron_pos, rf_results),
            )
        )

    save_figures(figures, save_dir)
    if not no_show:
        plt.show()



waven.gui.run(
    config.analysis.to_gui_mapping(),
    config.gabor.to_gui_mapping(),
)