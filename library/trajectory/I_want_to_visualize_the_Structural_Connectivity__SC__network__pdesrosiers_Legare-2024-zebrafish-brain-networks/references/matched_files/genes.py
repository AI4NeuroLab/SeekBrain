# Source: genes.py
# Summary: See repo_context.md

import numpy as np
from numba import njit
from brainsmash.mapgen.base import Base


def shuffle_expression(expression, distances, preserve_autocorrelation=True, resample=True):
    expression_shuffled = np.zeros(expression.shape)
    for i in range(expression.shape[0]):
        if preserve_autocorrelation:
            base = Base(x=expression[i], D=distances, resample=resample)
            surrogate = base(n=1)
            expression_shuffled[i] = surrogate
        else:
            surrogate = np.copy(expression[i])
            np.random.shuffle(surrogate)
            expression_shuffled[i] = surrogate
    return expression_shuffled


@njit
def numba_triu_indices(n, k=1):
    rows, cols = [], []
    for i in range(n):
        for j in range(i + k, n):
            rows.append(i)
            cols.append(j)
    return np.array(rows), np.array(cols)


@njit
def numba_pearson(matrix1, matrix2):
    n = matrix1.shape[0]
    tri_rows, tri_cols = numba_triu_indices(n, 1)
    v1 = np.empty(len(tri_rows), dtype=matrix1.dtype)
    v2 = np.empty(len(tri_cols), dtype=matrix2.dtype)
    for i in range(len(tri_rows)):
        v1[i] = matrix1[tri_rows[i], tri_cols[i]]
        v2[i] = matrix2[tri_rows[i], tri_cols[i]]
    sum_v1 = np.sum(v1)
    sum_v2 = np.sum(v2)
    sum_v1v2 = np.sum(v1 * v2)
    sum_v1_sq = np.sum(v1 ** 2)
    sum_v2_sq = np.sum(v2 ** 2)
    N = len(v1)
    numerator = N * sum_v1v2 - sum_v1 * sum_v2
    denominator = np.sqrt((N * sum_v1_sq - sum_v1 ** 2) * (N * sum_v2_sq - sum_v2 ** 2))
    if denominator == 0:
        return 0
    return numerator / denominator


@njit
def select_random_elements(array, M):
    indices = np.arange(len(array))
    selected_indices = np.random.choice(indices, M, replace=False)
    return array[selected_indices]


@njit
def compute_coexpression(expression):
    coexpression_matrix = np.corrcoef(expression.T)
    return coexpression_matrix


@njit
def objective_function(expression, target, method='pearson'):
    coexpression_matrix = compute_coexpression(expression)
    if method == 'pearson':
        return numba_pearson(coexpression_matrix, target)
    elif method == 'nmi':
        return numba_nmi(coexpression_matrix, target)


@njit
def simulated_annealing(expression, target, N_selected=15, T=2.5, decay=0.9995, iterations=30000, method='pearson'):
    N = expression.shape[0]
    M = N_selected

    selected_genes = select_random_elements(np.arange(N), M)
    v0 = objective_function(expression[selected_genes, :], target, method=method)

    while iterations > 0:

        gene_to_swap = int(np.random.uniform(0, M))
        new_gene = int(np.random.uniform(0, N))

        if new_gene not in selected_genes:
            iterations -= 1
            test_genes = np.copy(selected_genes)
            test_genes[gene_to_swap] = new_gene
            v1 = objective_function(expression[test_genes, :], target, method=method)
            if v1 > v0:
                selected_genes = np.copy(test_genes)
                v0 = v1
            else:
                if np.random.uniform(0, 1) <= np.exp(-(v0 - v1) / T):
                    selected_genes = np.copy(test_genes)
                    v0 = v1
            T *= decay
    return selected_genes


@njit
def calc_histogram(data, bins):
    hist = np.zeros((bins,), dtype=np.int64)
    min_val = data.min()
    max_val = data.max()
    for d in data:
        idx = int(bins * (d - min_val) / (max_val - min_val))
        if idx == bins:  # Include the max value in the last bin
            idx -= 1
        hist[idx] += 1
    return hist


@njit
def calc_joint_histogram(data1, data2, bins):
    joint_hist = np.zeros((bins, bins), dtype=np.int64)
    min_val1, min_val2 = data1.min(), data2.min()
    max_val1, max_val2 = data1.max(), data2.max()
    for d1, d2 in zip(data1, data2):
        idx1 = int(bins * (d1 - min_val1) / (max_val1 - min_val1))
        idx2 = int(bins * (d2 - min_val2) / (max_val2 - min_val2))
        if idx1 == bins: idx1 -= 1  # Include the max value in the last bin
        if idx2 == bins: idx2 -= 1
        joint_hist[idx1, idx2] += 1
    return joint_hist


@njit
def calc_entropy(hist):
    n = hist.sum()
    entropy = 0.0
    for count in hist:
        if count > 0:
            p = count / n
            entropy -= p * np.log(p)
    return entropy


@njit
def numba_nmi(matrix1, matrix2, bins=10):
    flat1, flat2 = matrix1.ravel(), matrix2.ravel()
    hist1 = calc_histogram(flat1, bins)
    hist2 = calc_histogram(flat2, bins)
    joint_hist = calc_joint_histogram(flat1, flat2, bins)
    H1 = calc_entropy(hist1)
    H2 = calc_entropy(hist2)
    H12 = calc_entropy(joint_hist.ravel())
    mutual_info = H1 + H2 - H12
    NMI = 2 * mutual_info / (H1 + H2)
    return NMI