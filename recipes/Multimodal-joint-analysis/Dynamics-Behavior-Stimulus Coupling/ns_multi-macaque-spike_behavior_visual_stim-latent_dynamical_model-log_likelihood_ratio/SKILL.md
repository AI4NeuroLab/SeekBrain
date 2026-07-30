---
name: ns_multi-macaque-spike_behavior_visual_stim-latent_dynamical_model-log_likelihood_ratio
description: Evaluates the predictive performance of latent dynamical models against trial-averaged PSTH baselines by computing marginal log-likelihood improvements across neural populations.
triggers:
  - does the latent dynamical model outperform PSTH baselines?
  - how much better is the latent model at fitting spike data than trial averages?
  - calculate the improvement distribution of neural latent models
  - compare LDM and PSTH model fitting accuracy for neurons
  - assess the predictive gains of latent variable models over static trial-averaged spike rates
tags:
  - neural-coding
  - latent-dynamical-models
  - spike-train-analysis
  - log-likelihood
  - computational-neuroscience
version: '1.0'
---

# Quantifying Performance Gains of Latent Dynamical Models over PSTH Baselines

This recipe evaluates whether a latent dynamical model (LDM) offers superior predictive power to a trial-averaged peristimulus time histogram (PSTH) baseline. OUP and MJP latent models explicitly capture trial-to-trial fluctuations in latent states, whereas a PSTH baseline captures only the mean stimulus-locked firing rate.

By comparing the Marginal Log-Likelihood (MLLK) on held-out trials, this approach quantifies the "performance gain" ($\Delta LL$) of the LDM. This analysis is critical for distinguishing neurons whose dynamics are driven by latent variables from those that are well-described by static trial-averaging.

## When to use this

- Compare latent dynamical models with trial-averaged PSTH baselines using held-out marginal log likelihood.
- Summarize per-neuron or population log-likelihood improvements across model variants.
- Do not use this workflow when train/test partitions or likelihoods are not comparable across models.

## Scientific context

The PSTH baseline represents the "explainable variance" tied to task events. However, it fails to capture trial-to-trial variability. The LDM improves upon this by inferring a latent dynamical process $x(t)$ that modulates the neuron's firing rate across trials.

## Preconditions

- Python 3.8+
- `numpy`, `scipy` (for `scipy.optimize.minimize`)
- `matplotlib` (for visualization of $\Delta LL$)

## Inputs and outputs

1. Spike Train Matrix: Shape $(N, T, K)$ where $N=$ neurons, $T=$ time bins, $K=$ trials.
2. Model Parameters: Initial coupling strengths ($C$) and noise levels ($\sigma$).

1. A histogram plotting the distribution of $\Delta LL_i$.
2. A single numeric value representing the mean population gain.
3. A p-value indicating whether $\Delta LL$ is significantly greater than zero.

## Procedure

1. **Define Baseline:** Compute the trial-averaged firing rate $\bar{r}(t)$ for each neuron $i$.
2. **Compute Baseline Likelihood:** Calculate the Log-Likelihood of held-out test data under the Poisson assumption with rate $\bar{r}(t)$.
3. **Fit LDM:** Train the latent model (e.g., OUP or MJP) to extract the posterior rate $\hat{r}_{i,k}(t)$ using training trials.
4. **Compute Model Likelihood:** Calculate the Log-Likelihood of held-out test data using the model-derived posterior rates.
5. **Aggregate Performance:** Compute $\Delta LL = LL_{LDM} - LL_{PSTH}$ for every neuron and analyze the distribution across the population.

1. **PSTH Implementation (Assumption):** Since no explicit PSTH function exists, compute the PSTH by taking the mean of the spike train matrix across the trials dimension (`np.mean(data, axis=0)`).
2. **Train/Test Split:** Modify `model_fit.py` or the calling script to isolate 20% of trials as a test set to prevent overfitting, as LDMs possess more free parameters than the PSTH.
3. **Population Aggregation:** Create a wrapper to iterate over simulated neurons, collecting $\Delta LL$ values into an array to visualize the distribution as a histogram.

1. **Baseline Calculation:** Compute $\bar{r}(t)$ by averaging over $K$ for each neuron.
2. **Test-Set Evaluation:** Partition $K$ trials. Train model on $K_{train}$, evaluate $LL$ on $K_{test}$.
3. **Likelihood Computation:** Run `model_fit.py` to extract posterior states and calculate total log-likelihood for the LDM.
4. **Comparison:** Subtract PSTH log-likelihood from LDM log-likelihood to obtain $\Delta LL_i$.
5. **Statistical Verification:** Run a Wilcoxon signed-rank test on the resulting vector of $\Delta LL_i$ across all $N$ neurons.

## Expected results

The improvement distribution is expected to be heavy-tailed. Neurons with high trial-to-trial variance exhibit significantly positive $\Delta LL$, while neurons that are purely stimulus-locked exhibit $\Delta LL \approx 0$, indicating that the LDM and PSTH perform comparably for task-rigid cells.

- $\Delta LL$ must be evaluated on **held-out** data; if training-set $LL$ is used, results are invalid due to overfitting.
- The PSTH baseline must be calculated using the same time binning as the LDM.

## Pitfalls

- **Overfitting Risk:** Because LDMs are more flexible than a simple PSTH, they will almost always outperform the baseline on training data. Always use held-out test trials.
- **Data Sparsity:** If the data is highly sparse, consider using a Gaussian-smoothed PSTH as your baseline to prevent the log-likelihood from being dominated by extreme values.
- **Model Convergence:** Ensure that the optimizer in `model_fit.py` has a `success=True` flag for every neuron; skip neurons where optimization fails.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
# Example logic to run the comparison across a population
python example.py --mode compare_baseline --n_neurons 100 --train_split 0.8
```
