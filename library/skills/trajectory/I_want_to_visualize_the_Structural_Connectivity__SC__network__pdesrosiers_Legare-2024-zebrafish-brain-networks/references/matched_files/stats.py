# Source: stats.py
# Summary: See repo_context.md

import numpy as np
from scipy.signal import convolve
import cv2
from numba import njit
import pathlib
from calimba.analysis import *
from scipy.linalg import pinv
from scipy.ndimage import gaussian_filter
from scipy.spatial import cKDTree
from scipy.stats import norm, f_oneway, percentileofscore, shapiro, levene, ttest_ind, mannwhitneyu
import statsmodels.sandbox.stats.multicomp as mc


def check_normality(data):
    stat, p = shapiro(data)
    return p > 0.05


def check_variances(data1, data2):
    stat, p = levene(data1, data2)
    return p > 0.05


def compare_groups(data1, data2, print_results=True):
    normality_data1 = check_normality(data1)
    normality_data2 = check_normality(data2)
    equal_variances = check_variances(data1, data2)
    if normality_data1 and normality_data2 and equal_variances:
        stat, p = ttest_ind(data1, data2)
        if print_results: 
            print(f"Independent T-Test: Statistics={stat:.3f}, p={p:.12f}")
    else:
        stat, p = mannwhitneyu(data1, data2)
        if print_results: 
            print(f"Mann-Whitney U Test: Statistics={stat:.3f}, p={p:.12f}")
    return stat, p


def groups_ANOVA_Tukey(data, significance_ANOVA=0.05):
    """
    Data: list of 1D numpy arrays.
    """

    f_value, p_value = f_oneway(*data)
    print(f'ANOVA results: F = {f_value}, p = {p_value}')
    print('')
    if p_value < significance_ANOVA:
        data_flat = np.concatenate(data)
        groups = np.array([])
        for i in range(len(data)):
            groups = np.append(groups, [f'Group {i+1}'] * len(data[i]))
        tukey = mc.MultiComparison(data_flat, groups)
        result = tukey.tukeyhsd()
        print(result.summary())


def find_elbow_point(x, y):
    x = np.array(x)
    y = np.array(y)
    x_norm = (x - np.min(x)) / (np.max(x) - np.min(x))
    y_norm = (y - np.min(y)) / (np.max(y) - np.min(y))
    line_vec = np.array([x_norm[-1] - x_norm[0], y_norm[-1] - y_norm[0]])
    line_vec_norm = line_vec / np.sqrt(np.sum(line_vec**2))
    distances = np.empty(x_norm.shape)
    for i in range(len(x_norm)):
        point_vec = np.array([x_norm[i] - x_norm[0], y_norm[i] - y_norm[0]])
        proj_length = np.dot(point_vec, line_vec_norm)
        proj_vec = proj_length * line_vec_norm
        distances[i] = np.linalg.norm(point_vec - proj_vec)
    elbow_index = np.argmax(distances)
    elbow_point = (x[elbow_index], y[elbow_index])
    return elbow_point
    

def spatial_p_value_test(centroids_list, labels_list, N_shuffles=100):
    """centroids_list: list that contains N centroids arrays (shape Mx3)
       labels_list: list that contains N boolean vectors (shape Mx1) that indicate a subset of centroids (i.e. stimulus-correlated neurons)
       N_shuffles: number of times the boolean vectors get shuffled to compute null distance distributions

       Returns a p-value for each labeled neuron, indicating the significance of spatial overlap with other larvae.
       Smaller p-values are associated with higher spatial reproducibility across larvae.
    """
    # Real distances
    centroids = get_centroids_from_labels(centroids_list, labels_list)
    distances_real = compute_mean_nn_distances(centroids)

    # Measuring null distances
    dist_pvalues = []
    for i in tqdm(range(len(centroids_list)), file=sys.stdout):
        shuffled_dists = []
        for _ in range(N_shuffles): # N shuffles
            shuffled_labels_list = shuffle_labels(labels_list)
            centroids = get_centroids_from_labels(centroids_list, shuffled_labels_list)
            centroids[i] = np.copy(centroids_list[i][labels_list[i]]) # Leaving one element unshuffled
            dists = compute_mean_nn_distances_single(centroids, i)
            shuffled_dists.append(dists)
        shuffled_dists = np.stack(shuffled_dists, axis=1)
        pvalues = []
        for j in range(shuffled_dists.shape[0]):
            pvalues.append(compute_pvalue(distances_real[i][j], shuffled_dists[j]))
        dist_pvalues.append(pvalues)
    return dist_pvalues


def compute_pvalue(values, distribution):
    "One-sided, value smaller than distribution."
    mean, std = np.mean(distribution), np.std(distribution)
    zscores = (values - mean) / std
    pvalues = norm.cdf(zscores)
    return pvalues


def shuffle_labels(labels_list):
    shuffled_labels_list = []
    for i in range(len(labels_list)):
        shuffled_labels = np.copy(labels_list[i])
        np.random.shuffle(shuffled_labels)
        shuffled_labels_list.append(shuffled_labels)
    return shuffled_labels_list


def compute_mean_nn_distances(centroids_list):
    trees = []
    for c in centroids_list:
        trees.append(cKDTree(c))
    distance_vectors = []
    for i in tqdm(range(len(centroids_list)), file=sys.stdout):
        centroids = centroids_list[i]
        distances = []
        for j in range(len(centroids_list)):
            if i != j:
                d, _ = trees[j].query(centroids)
                distances.append(d)
        distances = np.mean(np.stack(distances, axis=1), axis=1)
        distance_vectors.append(distances)      
    return distance_vectors


def compute_mean_nn_distances_single(centroids_list, array_id):
    trees = []
    for c in centroids_list:
        trees.append(cKDTree(c))
    for i in range(len(centroids_list)):
        if i == array_id:
            centroids = centroids_list[i]
            distances = []
            for j in range(len(centroids_list)):
                if i != j:
                    d, _ = trees[j].query(centroids)
                    distances.append(d)
            distances = np.mean(np.stack(distances, axis=1), axis=1)
            return distances


def get_centroids_from_labels(centroids_list, labels_list):
    centroids = []
    for i in range(len(centroids_list)):
        centroids.append(centroids_list[i][labels_list[i]])
    return centroids
     

class Regressors:

    def __init__(self, sequence=None, fps=1):
        self.sequence = sequence
        self.t = np.linspace(0, len(sequence) / fps, len(sequence), endpoint=False)
        self.t_ref = None
        self.tau = 3
        self.stimuli = {}
        self.regressors = {}
        self.names_list = []

    @property
    def names(self):
        return self.names_list

    def __getitem__(self, item):
        return self.regressors[item]

    def set_reference_timestamps(self, t_ref):
        self.t_ref = t_ref

    def create_regressor(self, name, keywords):
        stimulus = []
        for item in self.sequence:
            if all(keyword in item for keyword in keywords):
                stimulus.append(1)
            else:
                stimulus.append(0)
        stimulus = np.array(stimulus)

        # Full regressor
        resampled = np.array([0] * len(self.t_ref))
        for i in range(len(resampled)):
            idmin = np.abs(self.t - self.t_ref[i]).argmin()
            if self.t[idmin] < self.t_ref[i]:
                resampled[i] = stimulus[idmin]
            else:
                resampled[i] = stimulus[idmin - 1]
        self.stimuli[name] = resampled
        regressor = convolve(resampled, self.exponential(self.t_ref, self.tau))[:len(self.t_ref)]
        self.regressors[name] = normalize(regressor)
        self.names_list.append(name)

    def create_trial_regressors(self, name):
        try:
            stimulus = self.stimuli[name]
        except:
            print('Full regressor first has to be created before extracting individual trials.')
        single_trials = find_plateaus(stimulus)
        trial_regressors = np.zeros(single_trials.shape)
        for i in range(trial_regressors.shape[0]):
            trial_regressors[i] = normalize(
                convolve(single_trials[i], self.exponential(self.t_ref, self.tau))[:len(self.t_ref)])
        self.regressors[name + '_trials'] = trial_regressors

    def create_behavior_regressors(self, behavior_events, fps):
        resampled = np.array([0] * len(self.t_ref))
        t_behav = np.linspace(0, len(behavior_events) / fps, len(behavior_events), endpoint=False)
        for i in range(len(resampled)):
            idmin = np.abs(t_behav - self.t_ref[i]).argmin()
            if t_behav[idmin] < self.t_ref[i]:
                resampled[i] = behavior_events[idmin]
            else:
                resampled[i] = behavior_events[idmin - 1]
        self.stimuli['behavior'] = resampled
        regressor = convolve(resampled, self.exponential(self.t_ref, self.tau))[:len(self.t_ref)]
        self.regressors['behavior'] = normalize(regressor)
        self.names_list.append('behavior')

        behavioral_events = find_plateaus(self.stimuli['behavior'])
        behav_regressors = np.zeros(behavioral_events.shape)
        for i in range(behav_regressors.shape[0]):
            behav_regressors[i] = normalize(
                convolve(behavioral_events[i], self.exponential(self.t_ref, self.tau))[:len(self.t_ref)])
        self.regressors['behavior_events'] = behav_regressors

    def correlate(self, timeseries, name):
        regressor = self.regressors[name]
        correlations = correlate_timeseries(timeseries, regressor)
        return correlations

    def correlate_shuffled(self, timeseries, name):
        regressor = self.regressors[name]
        regressor = self.cyclic_permutation(regressor)
        correlations = correlate_timeseries(timeseries, regressor)
        return correlations

    def fit(self, timeseries, names, bias=True):
        # Creating regressors matrix
        if type(names) == list:
            vectors = self.regressors[names[0]]
            if len(vectors.shape) == 1:
                vectors = np.expand_dims(vectors, axis=0)
            for name in names[1:]:
                if len(self.regressors[name].shape) == 1:
                    vectors = np.append(vectors, np.expand_dims(self.regressors[name], axis=0), axis=0)
                else:
                    vectors = np.append(vectors, self.regressors[name], axis=0)
        else:
            vectors = self.regressors[names]
            if len(vectors.shape) == 1:
                vectors = np.expand_dims(vectors, axis=0)
        if bias:
            vectors = np.append(vectors, np.expand_dims(np.array([1] * vectors.shape[1]), axis=0), axis=0)

        # Pseudo-inversion to retrieve coefficients
        if len(timeseries.shape) == 1:
            coefficients = np.expand_dims(timeseries, axis=0) @ pinv(vectors)
        else:
            coefficients = timeseries @ pinv(vectors)
        # Matrix product to retrieve fit vectors
        fits = coefficients @ vectors
        correlations = rowwise_correlations(timeseries, fits)
        return coefficients, fits, correlations

    def fit_shuffled(self, timeseries, names, bias=True):
        # Creating regressors matrix
        if type(names) == list:
            vectors = self.regressors[names[0]]
            if len(vectors.shape) == 1:
                vectors = np.expand_dims(vectors, axis=0)
            for name in names[1:]:
                if len(self.regressors[name].shape) == 1:
                    vectors = np.append(vectors, np.expand_dims(self.regressors[name], axis=0), axis=0)
                else:
                    vectors = np.append(vectors, self.regressors[name], axis=0)
        else:
            vectors = self.regressors[names]
            if len(vectors.shape) == 1:
                vectors = np.expand_dims(vectors, axis=0)
        if bias:
            vectors = np.append(vectors, np.expand_dims(np.array([1] * vectors.shape[1]), axis=0), axis=0)

        # Shuffling regressors matrix
        for i in range(vectors.shape[0]):
            vectors[i] = self.cyclic_permutation(vectors[i])

        # Pseudo-inversion to retrieve coefficients
        if len(timeseries.shape) == 1:
            coefficients = np.expand_dims(timeseries, axis=0) @ pinv(vectors)
        else:
            coefficients = timeseries @ pinv(vectors)

        # Matrix product to retrieve fit vectors
        fits = coefficients @ vectors
        correlations = rowwise_correlations(timeseries, fits)

        # return coefficients, fits, correlations
        return coefficients, fits, correlations

    @staticmethod
    def exponential(t, tau=3.5):
        return np.exp(-1 * (t / tau))


    @staticmethod
    def cyclic_permutation(vector, index=None):
        if index is None:
            index = int(np.random.uniform(0, len(vector)))
        return list(vector)[index:] + list(vector)[:index]


@njit
def correlate_timeseries(timeseries, regressor):
    correlations = []
    for i in range(timeseries.shape[0]):
        correlations.append(np.corrcoef(timeseries[i], regressor)[0, 1])
    return np.array(correlations)


@njit
def rowwise_correlations(timeseries, regressors):
    correlations = []
    for i in range(timeseries.shape[0]):
        correlations.append(np.corrcoef(timeseries[i], regressors[i])[0, 1])
    return np.array(correlations)




