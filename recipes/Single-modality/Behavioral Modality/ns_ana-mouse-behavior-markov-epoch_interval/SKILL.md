---
name: ns_ana-mouse-behavior-markov-epoch_interval
description: Decomposes trial-based behavioral data into latent states like engagement and side-bias using GLM-HMM architecture and Viterbi state sequence decoding.
triggers:
- How do I decompose behavioral session data into discrete states?
- Identify hidden behavioral strategies using GLM-HMM
- Visualize state probability traces for individual experimental sessions
- How to model bias and engagement states in behavioral choice data?
- Determine the optimal number of hidden states for animal behavior
tags:
- GLM-HMM
- Behavioral Modeling
- Latent State Inference
- Expectation-Maximization
- Viterbi Decoding
version: '1.0'
---

# Decomposing Behavioral Strategies using GLM-HMM

This recipe outlines the process of applying a Hidden Markov Model (HMM) framework to characterize discrete behavioral states—specifically "engaged," "left-bias," and "right-bias"—within individual experimental sessions. By incorporating a Generalized Linear Model (GLM) component, this approach allows for the interpretation of behavioral choices as a function of task-relevant inputs (stimuli and history) conditioned on a latent state.

The methodology relies on an Expectation-Maximization (EM) algorithm for parameter estimation and the Viterbi algorithm for decoding. While standard HMM implementations focus on observation frequencies, the GLM-HMM requires integrating a logistic regression link function to map external trial-by-trial regressors to choice probabilities within each latent state.

## When to use this

Use this recipe to infer discrete engagement and side-bias states from trial-by-trial choices and task regressors. Do not use it for continuous latent dynamics or sessions too short to support stable state-transition estimates.

## Scientific context

The GLM-HMM assumes that at any given trial $t$, a subject operates in one of $K$ discrete latent states. Each state is governed by a distinct set of GLM weights ($\beta$), which map task inputs (e.g., stimuli, previous outcomes) to choice probabilities. Transitions between states represent shifts in internal strategy.

## Preconditions

* MATLAB (or compatible numerical environment).
* Standard matrix computation libraries (included in `src/`).

## Inputs and outputs

1. **Choices:** Vector of binary responses (0 for Left, 1 for Right).
2. **Regressors ($X$):** Matrix of trial-by-trial features (e.g., Stimulus intensity, previous trial outcome).
3. **Hyperparameters:** Number of states $K$ (suggested: 3 for Engaged/Left-bias/Right-bias).

* **Weight Matrix ($\beta$):** $K \times F$ matrix describing the strategy of each state.
* **Posterior Traces:** Time-series plot of $P(s_t|y_{1:T})$.
* **Model Fit:** AIC/BIC values for model selection validation.

## Procedure

1. **Model Architecture:** Define the hidden state sequence $S$ and the observation model $p(y_t | s_t, x_t, \beta_{s_t})$, where $y$ is the choice and $x$ is the input vector.
2. **Parameter Estimation:** Utilize the Expectation-Maximization (EM) algorithm to estimate the transition matrix ($A$), initial state distribution ($\pi$), and state-specific weights ($\beta$).
3. **State Decoding:** Use the Viterbi algorithm to identify the most likely sequence of hidden states for a given session.
4. **Model Selection:** Apply AIC/BIC criteria to determine the optimal number of states ($K$).

*Assumptions: The existing `mHMM` framework assumes multinoulli emissions; we assume a modification is made to the emission function to support logistic regression.*
1. Prepare a behavioral matrix ($T \times F$) containing choices and history-based regressors.
2. Replace the static Multinomial emission probability with a logistic regression function: $P(y_t=1 | s_t) = \sigma(\beta_{s_t} \cdot X_t)$.
3. Perform a grid search over $K=1..4$ using `AIC.m`/`BIC.m` to confirm $K=3$ is optimal.
4. Execute Viterbi decoding to generate trial-by-trial state assignment sequences.

1. **Format Data:** Assemble the behavioral matrix ensuring temporal alignment of choices and task inputs.
2. **Initialize Weights:** Initialize the $\beta$ matrix for $K=3$. Assign high intercept bias to states 2 and 3, and high stim-sensitivity to state 1.
3. **Fit Model:** Call `mHMM` training functions to iterate the EM algorithm until convergence in log-likelihood.
4. **Decode:** Run the Viterbi algorithm to generate the state sequence.
5. **Visualize:** Use `plotpHMMtrials.m` to overlay the posterior probability traces on the choice raster.

## Expected results

The model should produce posterior probability traces $P(s_t|y_{1:T})$ that show transitions between states on timescales of tens to hundreds of trials. Learned weights ($\beta$) should reveal distinct strategies, such as a strong side-bias intercept for biased states vs. high stimulus weight for the engaged state.

1. **Separability:** Learned $\beta$ intercepts must be significantly different across states (e.g., significantly negative vs. positive).
2. **Predictive Power:** Likelihood on held-out trials must exceed that of a standard single-state GLM.
3. **Consistency:** Inferred state probabilities should correlate with observed side-bias metrics in raw data.

## Pitfalls

* **GLM Extension:** the referenced implementation is a structural skeleton for HMMs. It does not contain an "out-of-the-box" logistic regression emission layer. You must extend the `mHMM` logic to handle $\beta$-weighted emissions.
* **Initialization:** To avoid converging to trivial states, add small random noise to the initial $\beta$ values to break symmetry.
* **Transition Stability:** If state switching appears too "jittery," consider enforcing a "sticky" HMM by increasing the diagonal values of the transition matrix $A$.

## Bundled files

- `scripts/run_analysis.py`: Run the analysis workflow.
- `scripts/utils.py`: Shared analysis utilities.

## Usage

```bash
# Example pseudo-command to trigger the demo
mHMMdemo(behavioral_data_matrix, num_states=3);
```
