---
name: ns_ana-mouse-behavior-anova-task_performance
description: Analyzes the impact of bilateral HDB-OB cholinergic inactivation on olfactory discrimination learning and evaluates signal reversibility post-CNO washout.
triggers:
- Does chemogenetic inactivation of HDB-OB neurons impair olfactory learning?
- Assess reversibility of CNO inhibition on olfactory discrimination task performance
- Analyze behavioral learning curves for HDB-OB chemogenetic studies
- How does CNO-induced inactivation of OB-projecting neurons affect task performance?
- Evaluate experimental evidence for recovery after cholinergic inhibition in the olfactory bulb
tags:
- chemogenetics
- olfactory-bulb
- cholinergic-modulation
- neuroscience-behavior
- hM4Di
version: '1.0'
---

# Chemogenetic Analysis of HDB-OB Cholinergic Neurons

This recipe tests whether bilateral chemogenetic inhibition of cholinergic HDB-to-olfactory-bulb projections impairs olfactory discrimination learning and whether performance recovers after CNO washout. It combines behavioral learning curves with optional calcium-signal deconvolution to distinguish a reversible inhibition effect from lasting damage.

## When to use this

Use this recipe to compare control, CNO-inhibition, and washout performance across sessions, optionally alongside calcium imaging. Do not use it when behavioral trial logs or treatment timing are unavailable; calcium traces alone cannot establish a learning deficit.

## Scientific context

Cholinergic modulation of the olfactory bulb is critical for odor discrimination learning. By using an hM4Di-CNO system, researchers can temporarily silence these inputs. The fundamental requirement is to distinguish transient inhibition (reversible) from long-term synaptic or neuronal damage.

## Preconditions

- `oasis` (for signal deconvolution)
- `numpy`, `pandas` (for data organization)
- `scipy.stats` (for ANOVA/T-test validation)

## Inputs and outputs

1. **Behavioral Logs:** CSV files containing `Trial_ID`, `Odor_Pair`, `Response`, `Outcome (Correct/Incorrect)`, and `Timestamp`.
2. **Imaging Data:** Raw fluorescence traces ($\Delta F/F$) aligned to behavioral trials.
3. **Metadata:** Injection timing and CNO administration log.

- **Figures:** Time-course plot of performance (Accuracy % vs. Session Day).
- **Statistics:** $p$-values indicating (a) impairment significance and (b) recovery (washout) non-significance (vs. control).

## Procedure

1. **Surgical Targeting:** Bilateral AAV-DIO-hM4Di-mCherry injection into the HDB of ChAT-Cre mice to achieve projection-specific expression.
2. **Behavioral Paradigm:** Implementation of an olfactory discrimination task (e.g., Go/No-Go) with daily success rate recording.
3. **Chemogenetic Protocol:** Administration of CNO during specific acquisition windows, followed by a washout period to measure recovery.
4. **Verification:** IHC for ChAT-mCherry co-localization to confirm anatomical specificity.

The plan assumes the availability of external behavioral data (e.g., CSV/JSON logs of trial-by-trial accuracy) and raw fluorescence traces ($\Delta F/F$) from the imaged OB/HDB neurons.
1. **Behavioral Processing:** Aggregate trial results into daily success percentages for three epochs: Pre-CNO, CNO-Active, and Washout.
2. **Signal Extraction:** Use `oasis.functions.deconvolve` on the raw fluorescence traces to extract latent spike probability trains.
3. **Statistical Modeling:** Perform a repeated-measures ANOVA to compare the learning slopes ($\beta$) across groups and conditions.

1. **Data Alignment:** Use `pandas.merge_asof` to synchronize trial outcomes with neural activity traces.
2. **Spike Extraction:** Execute `oasis.functions.deconvolve(y, g=(g1, g2), penalty=1)` to clean neural signal per mouse.
3. **Learning Metric Computation:** Calculate the daily learning rate $\beta$ by fitting a sigmoid or linear regression to the success rates.
4. **Group Comparison:** Test for statistical difference in $\beta$ between control and CNO groups using `scipy.stats.ttest_ind`.
5. **Reversibility Testing:** Use `scipy.stats.ttest_rel` to compare post-washout performance against pre-CNO baseline.

## Expected results

The experimental group (hM4Di+CNO) should show a significant decrease in the slope of the learning curve compared to controls. Crucially, the "washout" sessions must show performance returning to control levels, confirming the transient nature of the manipulation.

1. Significant difference ($p < 0.05$) in accuracy between CNO-Active and Baseline.
2. No significant difference ($p > 0.05$) between Post-CNO Washout and Baseline.

## Pitfalls

- **Data Gap:** the implementation does not contain behavioral task logic. The user must provide the behavioral trial logs externally.
- **Computation:** Deconvolution is sensitive to the parameters `g` and `lam`. Ensure these are tuned based on the calcium indicator decay kinetics (e.g., GCaMP6s/f).
- **Irreversibility:** If washout performance does not return to baseline, ensure the data is checked for potential CNO toxicity or non-specific neuronal injury before assuming circuit-level failure.

## Bundled files

- `scripts/run_analysis.py`: Run the analysis workflow.
- `scripts/utils.py`: Shared analysis utilities.

## Usage

```bash
# Example of processing a raw fluorescence trace snippet using the OASIS engine
python -c "from oasis.functions import deconvolve; import numpy as np; \
signal = np.load('neural_trace.npy'); \
c, s, b, g, lam = deconvolve(signal, g=(0.95,), penalty=1); \
print('Spike train extracted')"
```
