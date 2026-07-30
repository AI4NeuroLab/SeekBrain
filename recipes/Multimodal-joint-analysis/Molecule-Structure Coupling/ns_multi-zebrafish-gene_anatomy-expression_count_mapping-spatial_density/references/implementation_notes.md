# Implementation notes

## Pipeline stages

1. Register each brain volume to the chosen atlas with the affine and deformable settings in `matched_files/containers_registration_maru.yaml`.
2. Segment nuclei and detect gene-specific RNA spots.
3. Assign spot coordinates to labeled cells with `matched_files/containers_spot_assignment_scripts_python_assign_spots.py`.
4. Join cell-wise counts to registered centroids and atlas labels.
5. Apply one documented threshold to all replicates, then compute eomesa-positive, pvalb7-positive, and intersection masks.
6. Render the three coordinate sets with atlas boundaries and summarize counts per animal and region.

`matched_files/examples_demo_medium.sh` illustrates orchestration. `matched_files/containers_segmentation_scripts_python_starfinity_prediction.py` and `matched_files/containers_rs_fish_maru.yaml` document the segmentation and spot-detection stages. The final point-cloud visualization is not bundled and must be implemented for the selected atlas viewer.

## Validation

Confirm transform direction, voxel units, and axis order before joining coordinates. Record unmatched spots, cells without atlas labels, replicate-level counts, and registration landmarks. Keep the positivity threshold fixed across animals after it is selected.
