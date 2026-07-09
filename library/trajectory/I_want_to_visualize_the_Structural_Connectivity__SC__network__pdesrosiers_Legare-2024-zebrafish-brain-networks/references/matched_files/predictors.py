# Source: predictors.py
# Summary: See repo_context.md

import numpy as np
import os
import sys
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
import networkx as nx
import bct
from scipy.stats import pearsonr, zscore
from scipy.linalg import expm

from main import *


def normalize(matrix):
    norm = np.linalg.norm(matrix)
    return matrix / norm


def compute_euclidean_proximity(ED, gamma=1):
    EP = inverse_matrix(ED, gamma=gamma, inf=False)
    return EP


def compute_shortest_path_wei(A, gamma=1):
    inv_A = np.copy(A)
    inv_A[inv_A != 0] = inv_A[inv_A != 0] ** -gamma
    inv_A[inv_A == 0] = np.inf
    PL, _ = bct.distance_wei(inv_A)
    PL = 0.5 * (PL + PL.T)
    return PL


def compute_inverse_shortest_path_wei(A, gamma=1):
    inv_A = np.copy(A)
    inv_A[inv_A != 0] = inv_A[inv_A != 0] ** -gamma
    inv_A[inv_A == 0] = np.inf
    ISPL, _ = bct.distance_wei(inv_A)
    ISPL[ISPL != 0] = 1 / ISPL[ISPL != 0]
    ISPL = 0.5 * (ISPL + ISPL.T)
    return ISPL


def compute_shortest_path_bin(A):
    bin_A = (A > 0).astype('float')
    PL = bct.distance_bin(bin_A)
    PL = 0.5 * (PL + PL.T)
    return PL


def compute_inverse_shortest_path_bin(A):
    bin_A = (A > 0).astype('float')
    ISPL = bct.distance_bin(bin_A)
    ISPL[ISPL != 0] = 1 / ISPL[ISPL != 0]
    ISPL = 0.5 * (ISPL + ISPL.T)
    return ISPL


def compute_communicability_wei(A):
    degrees = np.sum(A, axis=1)
    D = np.diag(degrees ** -0.5)
    DAD = D @ atlas.directed @ D
    comm = expm(DAD)
    comm[np.diag_indices(comm.shape[0])] = 0
    comm_sym = 0.5 * (comm + comm.T)
    return comm_sym


def communicability(A):
    """
    Compute basics statistics about the communicability of a NetworkX graph,
    concept defined in [1] for undirected and unweighted graphs and later 
    adapted in [2] for weighted networks by including normalization matrices.
    
    To avoid any convergence issue regarding the matrix exponential used to compute
    communicability, the graph's adjacency or weight matrix is made symmetric 
    and pseudo-inversion is used rather inversion. These operations don't 
    affect the result if the graph is undirected and all vertices have non-zero degree.
    
    References:
    [1] Estrada, E. and Hatano, N., 2008. Communicability in complex networks. Physical Review E, 77(3), p.036111.
        https://doi.org/10.1103/PhysRevE.77.036111
    [2] Crofts, J.J. and Higham, D.J., 2009. A weighted communicability measure applied to complex brain networks. 
        Journal of the Royal Society Interface, 6(33), pp.411-414.https://doi.org/10.1098/rsif.2008.0484
    """
    #A = nx.adjacency_matrix(g).todense() # adjacency matrix
    A = 0.5*(A+A.T) # symmetrized matrix, ensuring proper diaginalization bu real orthogonal matrices
   
    D = np.diagflat(np.sum(A, axis = 1)) # degree matrix
    sqrtDminus1 = np.linalg.pinv(np.sqrt(D)) # (degree matrix)^(-1/2), normalization factor as in [2]
                                             # pseudo inversion used to avoid problem when some degrees are zero
    
    A_normalized = sqrtDminus1 @ A @sqrtDminus1 # normalized matrix as defined in [2]
    eigval, eigvec = np.linalg.eigh(A_normalized) # np.linalg.eigh works for hermitian matrices, ensuring real eigenvalues
    
    communicability_mat = np.array(eigvec @ np.diagflat(np.exp(eigval)) @ eigvec.T ) # scipy version, expm(A_normalized), 
                                                                                     # doesn't always converge to the right answer 
    return communicability_mat


def cosine_similarity(vector1, vector2):
    dot_product = np.dot(vector1, vector2)
    norm_vector1 = np.linalg.norm(vector1)
    norm_vector2 = np.linalg.norm(vector2)
    if (norm_vector1 == 0) or (norm_vector2 == 0):
        return 0
    else:       
        return dot_product / (norm_vector1 * norm_vector2)


def compute_cosine_similarity_inputs(A):
    CS = np.zeros(A.shape)
    for i in range(A.shape[0]):
        for j in range(i + 1, A.shape[1]):
            CS[i, j] = cosine_similarity(A[i, :], A[j, :])
            CS[j, i] = CS[i, j]
    return CS


def compute_cosine_similarity_outputs(A):
    CS = np.zeros(A.shape)
    for i in range(A.shape[0]):
        for j in range(i + 1, A.shape[1]):
            CS[i, j] = cosine_similarity(A[:, i], A[:, j])
            CS[j, i] = CS[i, j]
    return CS


def pearson_coefficient(vector1, vector2):
    if np.allclose(vector1, np.mean(vector1)) or np.allclose(vector2, np.mean(vector2)):
        return 0
    if np.any(vector1) and np.any(vector2):
        return pearsonr(vector1, vector2)[0]
    else:
        return 0


def compute_correlation_inputs(A):
    CS = np.zeros(A.shape)
    for i in range(A.shape[0]):
        for j in range(i + 1, A.shape[1]):
            CS[i, j] = pearson_coefficient(A[i, :], A[j, :])
            CS[j, i] = CS[i, j]
    return CS


def compute_correlation_outputs(A):
    CS = np.zeros(A.shape)
    for i in range(A.shape[0]):
        for j in range(i + 1, A.shape[1]):
            CS[i, j] = pearson_coefficient(A[:, i], A[:, j])
            CS[j, i] = CS[i, j]
    return CS


def flow_graph(A, t):
    r = np.ones((A.shape[0],))
    s = np.sum(A, axis=0)
    z = np.sum(s / r)
    ps = s / (z * r)

    lap = -(A / s) * r[:, np.newaxis] - np.diag(r)
    dyn = z * expm(-t * lap) * ps
    dyn = (dyn + dyn.T) / 2

    return dyn


def distance_wei_floyd(adjacency, transform=False, gamma=1):
    """
    Computes the topological length of the shortest possible path connecting
    every pair of nodes in the network.

    Parameters
    ----------
    D : (N x N) array_like
        Weighted/unweighted, direct/undirected connection weight/length array
    transform : str, optional
        If `adjacency` is a connection weight array, specify a transform to map
        input connection weights to connection lengths. Options include ['log',
        'inv'], where 'log' is `-np.log(adjacency)` and 'inv' is `1/adjacency`.
        Default: None

    Returns
    -------
    SPL : (N x N) ndarray
        Weighted/unweighted shortest path-length array. If `D` is a directed
        graph, then `SPL` is not symmetric
    hops : (N x N) ndarray
        Number of edges in the shortest path array. If `D` is unweighted, `SPL`
        and `hops` are identical.
    Pmat : (N x N) ndarray
        Element `[i,j]` of this array indicates the next node in the shortest
        path between `i` and `j`. This array is used as an input argument for
        function `retrieve_shortest_path()`, which returns as output the
        sequence of nodes comprising the shortest path between a given pair of
        nodes.

    Notes
    -----
    There may be more than one shortest path between any pair of nodes in the
    network. Non-unique shortest paths are termed shortest path degeneracies
    and are most likely to occur in unweighted networks. When the shortest-path
    is degenerate, the elements of `Pmat` correspond to the first shortest path
    discovered by the algorithm.

    The input array may be either a connection weight or length array. The
    connection length array is typically obtained with a mapping from weight to
    length, such that higher weights are mapped to shorter lengths (see
    argument `transform`, above).

    Originally written in Matlab by Andrea Avena-Koenigsberger (IU, 2012)

    References
    ----------
    .. [1] Floyd, R. W. (1962). Algorithm 97: shortest path. Communications of
       the ACM, 5(6), 345.
    .. [2] Roy, B. (1959). Transitivite et connexite. Comptes Rendus
       Hebdomadaires Des Seances De L Academie Des Sciences, 249(2), 216-218.
    .. [3] Warshall, S. (1962). A theorem on boolean matrices. Journal of the
       ACM (JACM), 9(1), 11-12.
    .. [4] https://en.wikipedia.org/wiki/Floyd%E2%80%93Warshall_algorithm
    """

    #it is important not to do these transformations safely, to allow infinity
    if transform:
        with np.errstate(divide='ignore'):
                SPL = adjacency ** -gamma
    else:
        SPL = adjacency.copy().astype('float')
        SPL[SPL == 0] = np.inf

    n = adjacency.shape[1]

    hops = np.array(adjacency != 0).astype('float')
    Pmat = np.repeat(np.atleast_2d(np.arange(0, n)), n, 0)

    #print(SPL)

    for k in range(n):
        i2k_k2j = np.repeat(SPL[:, [k]], n, 1) + np.repeat(SPL[[k], :], n, 0)

        path = SPL > i2k_k2j
        i, j = np.where(path)
        hops[path] = hops[i, k] + hops[k, j]
        Pmat[path] = Pmat[i, k]

        SPL = np.min(np.stack([SPL, i2k_k2j], 2), 2)

    I = np.eye(n) > 0
    SPL[I] = 0

    hops[I], Pmat[I] = 0, 0

    return SPL, hops, Pmat


def path_transitivity(W, transform=True, gamma=1):
    '''
    This function computes the density of local detours (triangles) that
    are available along the shortest-paths between all pairs of nodes.

    Parameters
    ----------
    W : NxN np.ndarray
        weighted or unweighted undirected connection weight or length matrix
    transform : None or enum
        if the input is a connection length matrix, no transform is needed
        if the input is a connection weight matrix, use 'log' for
        log transform l_ij = -log(w_ij)
        or 'inv' for inversion l_ij = 1/w_ij
        The default value is None

    Returns
    -------
    T : NxN
        matrix of pairwise path transitivity
    '''
    n = len(W)
    m = np.zeros((n, n))
    T = np.zeros((n, n))

    for i in range(n-1):
        for j in range(i+1, n):
            x = 0
            y = 0
            z = 0
            
            for k in range(n):
                if W[i, k] != 0 and W[j, k] != 0 and k not in (i, j):
                    x += W[i, k] + W[j, k]
                if k != j:
                    y += W[i, k]
                if k != i:
                    z += W[j, k]

            m[i,j] = x/(y+z)

    m = m + m.T

    _, hops, pmat = distance_wei_floyd(W, transform=transform, gamma=gamma)

    for i in range(n-1):
        for j in range(i+1, n):

            x = 0
            path = bct.retrieve_shortest_path(i, j, hops, pmat)
            k = len(path)

            for t in range(k-1):
                for l in range(t+1, k):
                    x += m[path[t], path[l]]

            T[i, j] = 2 * x / (k * (k - 1))

    T = T + T.T
    return T


def search_information(adjacency, transform=False, gamma=1, has_memory=False):
    """
    Calculates search information of `adjacency`

    Computes the amount of information (measured in bits) that a random walker
    needs to follow the shortest path between a given pair of nodes.

    Parameters
    ----------
    adjacency : (N x N) array_like
        Weighted/unweighted, direct/undirected connection weight/length array
    transform : str, optional
        If `adjacency` is a connection weight array, specify a transform to map
        input connection weights to connection lengths. Options include ['log',
        'inv'], where 'log' is `-np.log(adjacency)` and 'inv' is `1/adjacency`.
        Default: None
    has_memory : bool, optional
        This flag defines whether or not the random walker "remembers" its
        previous step, which has the effect of reducing the amount of
        information needed to find the next state. Default: False

    Returns
    -------
    SI : (N x N) ndarray
        Pair-wise search information array. Note that `SI[i,j]` may be
        different from `SI[j,i]``; hence, `SI` is not a symmetric matrix even
        when `adjacency` is symmetric.

    References
    ----------
    .. [1] Goni, J., van den Heuvel, M. P., Avena-Koenigsberger, A., de
       Mendizabal, N. V., Betzel, R. F., Griffa, A., Hagmann, P.,
       Corominas-Murtra, B., Thiran, J-P., & Sporns, O. (2014). Resting-brain
       functional connectivity predicted by analytic measures of network
       communication. Proceedings of the National Academy of Sciences, 111(2),
       833-838.
    .. [2] Rosvall, M., Trusina, A., Minnhagen, P., & Sneppen, K. (2005).
       Networks and cities: An information perspective. Physical Review
       Letters, 94(2), 028701.
    """

    N = len(adjacency)

    if np.allclose(adjacency, adjacency.T):
        flag_triu = True
    else:
        flag_triu = False

    T = np.linalg.solve(np.diag(np.sum(adjacency, axis=1)), adjacency)
    _, hops, Pmat = distance_wei_floyd(adjacency, transform=transform, gamma=gamma)

    SI = np.zeros((N, N))
    SI[np.eye(N) > 0] = np.nan

    for i in range(N):
        for j in range(N):
            if (j > i and flag_triu) or (not flag_triu and i != j):
                path = bct.retrieve_shortest_path(i, j, hops, Pmat)
                lp = len(path) - 1
                if flag_triu:
                    if np.any(path):
                        pr_step_ff = np.zeros(lp)
                        pr_step_bk = np.zeros(lp)
                        if has_memory:
                            pr_step_ff[0] = T[path[0], path[1]]
                            pr_step_bk[lp-1] = T[path[lp], path[lp-1]]
                            for z in range(1, lp):
                                pr_step_ff[z] = T[path[z], path[z+1]] / (1 - T[path[z-1], path[z]])
                                pr_step_bk[lp-z-1] = T[path[lp-z], path[lp-z-1]] / (1 - T[path[lp-z+1], path[lp-z]])
                        else:
                            for z in range(lp):
                                pr_step_ff[z] = T[path[z], path[z+1]]
                                pr_step_bk[z] = T[path[z+1], path[z]]

                        prob_sp_ff = np.prod(pr_step_ff)
                        prob_sp_bk = np.prod(pr_step_bk)
                        SI[i, j] = -np.log2(prob_sp_ff)
                        SI[j, i] = -np.log2(prob_sp_bk)
                else:
                    if np.any(path):
                        pr_step_ff = np.zeros(lp)
                        if has_memory:
                            pr_step_ff[0] = T[path[0], path[1]]
                            for z in range(1, lp):
                                pr_step_ff[z] = T[path[z], path[z+1]] / (1 - T[path[z-1], path[z]])
                        else:
                            for z in range(lp):
                                pr_step_ff[z] = T[path[z], path[z+1]]

                        prob_sp_ff = np.prod(pr_step_ff)
                        SI[i, j] = -np.log2(prob_sp_ff)
                    else:
                        SI[i, j] = np.inf

    return SI


def compute_search_information(A, gamma=1, transform=True):
    SI = search_information(A, transform=transform, gamma=gamma)
    SI = 0.5 * (SI + SI.T)
    SI[np.diag_indices(SI.shape[0])] = 0
    SI[SI != 0] = 1 / SI[SI != 0]
    return SI
    
    
def inverse_matrix(A, gamma=1, inf=True):
    with np.errstate(divide='ignore'):
        inv_A = A ** -gamma
        if not inf:
            inv_A[inv_A == np.inf] = 0
        return inv_A


def compute_mfpt_wei(A):
    M = zscore(bct.mean_first_passage_time(A), axis=0)
    M = 0.5 * (M + M.T)    
    return M


def navigation_wu(L, D, max_hops=None):
    '''
    Navigation of connectivity length matrix L guided by nodal distance D
   
    % Navigation
    [sr, PL_bin, PL_wei] = navigation_wu(L,D);
    % Binary shortest path length
    sp_PL_bin = distance_bin(L);
    % Weighted shortest path length
    sp_PL_wei = distance_wei_floyd(L);
    % Binary efficiency ratio
    er_bin = mean(mean(sp_PL_bin./PL_bin));
    % Weighted efficiency ratio
    er_wei = mean(mean(sp_PL_wei./PL_wei));
   
    Parameters
    ----------
    L : NxN np.ndarray
        Weighted/unweighted directed/undirected NxN SC matrix of connection
        *lengths*, L(i,j) is the strength-to-length remapping of the connection
        weight between i and j. L(i,j) = 0 denotes the lack of a connection 
        between i and j.
   
    D : NxN np.ndarray
        Symmetric NxN nodal distance matrix (e.g., Euclidean distance between 
        node centroids)

    max_hops : int | None
        Limits the maximum number of hops of navigation paths
   
    Returns
    ------- 
    sr : int
        Success ratio scalar, proportion of node pairs successfully reached by
        navigation
    
    PL_bin : NxN np.ndarray
        NxN matrix of binary navigation path length (i.e., number of hops in 
        navigation paths). Infinite values indicate failed navigation paths
    
    PL_wei : NxN np.ndarray
        NxN matrix of weighted navigation path length (i.e., sum of connection
        weights as defined by C along navigation path). Infinite values
        indicate failed paths.
   
    PL_dis : NxN np.ndarray
        NxN matrix of distance-based navigation path length (i.e., sum of
        connection distances as defined by D along navigation paths. Infinite 
        values indicate failed paths.
   
    paths - dict(tuple -> list)
        array of nodes comprising navigation paths. The key (i,j) specifies
        the path from i to j, and the value is a list of all nodes traveled
        between i and j.
    '''

    n = len(L)
    PL_bin = np.zeros((n, n))
    PL_wei = np.zeros((n, n))
    PL_dis = np.zeros((n, n))
    paths = {}

    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            
            curr_node = i
            last_node = curr_node
            target = j
            curr_paths = [curr_node]

            pl_bin = 0
            pl_wei = 0
            pl_dis = 0

            while curr_node != target:
                #print(curr_node, "WHEEF")
                #print(np.where(L[curr_node, :] != 0))         
                #print(np.shape(np.where(L[curr_node, :] != 0)))

                neighbors, = np.where(L[curr_node, :] != 0)
                if len(neighbors) == 0:
                    pl_bin = np.inf
                    pl_wei = np.inf
                    pl_dis = np.inf
                    break

                min_ix = np.argmin(D[target, neighbors])
                next_node = neighbors[min_ix]

                if (next_node == last_node or 
                    (max_hops is not None and pl_bin > max_hops)):

                    pl_bin = np.inf
                    pl_wei = np.inf
                    pl_dis = np.inf
                    break

                curr_paths.append(next_node)
                pl_bin += 1
                pl_wei += L[curr_node, next_node]
                pl_dis += D[curr_node, next_node]

                last_node = curr_node
                curr_node = next_node
                
            PL_bin[i, j] = pl_bin
            PL_wei[i, j] = pl_wei
            PL_dis[i, j] = pl_dis
            paths[(i, j)] = curr_paths

    np.fill_diagonal(PL_bin, np.inf)
    np.fill_diagonal(PL_wei, np.inf)
    np.fill_diagonal(PL_dis, np.inf)

    inf_ixes, = np.where(PL_bin.flat == np.inf)
    sr = 1 - (len(inf_ixes) - n)/(n**2 - n)

    return sr, PL_bin, PL_wei, PL_dis, paths
    
    
def invsym(A, gamma=1, inf=True):
    inv_A = inverse_matrix(A, gamma=gamma, inf=inf)
    return 0.5 * (inv_A + inv_A.T)
    
    
class Predictors:

    def __init__(self, A_dir, A_und, ED, excluded=None, directed=True):

        if excluded is None:
            self.excluded = []
        else:
            self.excluded = excluded

        self.A = A_dir
        self.A_und = A_und
        #self.A_und = 0.5 * (A_dir + A_dir.T)
        self.euclidean_distance = ED

        self.predictors = None
        self.predictors_list = []
        self.predictors_names = []
        self.gamma_values = [0.125, 0.25, 0.5, 1.0, 2.5, 5.0]
        self.t_values = [2.5, 5.0, 10.0]

        self.delete = delete_rows_and_columns

    def exclude_regions(self):
        for i in range(len(self.predictors_list)):
            self.predictors_list[i] = delete_rows_and_columns(self.predictors_list[i], self.excluded)

    def normalize_predictors(self):
        for i in range(len(self.predictors_list)):
            p = self.predictors_list[i]
            p[np.diag_indices(p.shape[0])] = 0
            p = normalize(p)
            self.predictors_list[i] = p

    def compute_predictors(self, directed=False):
        
        euc = []
        for gamma in self.gamma_values:
            if gamma <= 1: # Correlations drop abruptly beyond this value
                euc.append(compute_euclidean_proximity(self.euclidean_distance,
                                                  gamma=gamma))
                self.predictors_names.append('euc-{}'.format(gamma))
        self.predictors_list += euc

        if directed:
            pl_bin = compute_inverse_shortest_path_bin(self.A)
        else:
            pl_bin = compute_inverse_shortest_path_bin(self.A_und)
        self.predictors_list.append(pl_bin)
        self.predictors_names.append('pl-bin')

        pl_wei = []
        for gamma in self.gamma_values:
            if directed:
                pl = compute_inverse_shortest_path_wei(self.A, gamma=gamma)
            else:
                pl = compute_inverse_shortest_path_wei(self.A_und, gamma=gamma)
            self.predictors_names.append('pl-wei-{}'.format(gamma))
            pl_wei.append(pl)
        self.predictors_list += pl_wei

        comm_bin = communicability(self.A > 0)
        comm_wei = communicability(self.A)
        self.predictors_list.append(comm_bin)
        self.predictors_list.append(comm_wei)
        self.predictors_names.append('comm-bin')
        self.predictors_names.append('comm-wei')

        if directed:
            cs_in = compute_cosine_similarity_inputs(self.A)
            cs_out = compute_cosine_similarity_outputs(self.A)
            self.predictors_list.append(cs_in)
            self.predictors_list.append(cs_out)
            self.predictors_names.append('cs-in')
            self.predictors_names.append('cs-out')

            mi_out, mi_in, _ = bct.matching_ind(self.A)
            self.predictors_list.append(mi_in)
            self.predictors_list.append(mi_out)
            self.predictors_names.append('mi-in')
            self.predictors_names.append('mi-out')
        else:
            cs = compute_cosine_similarity_inputs(self.A_und)
            self.predictors_list.append(cs)
            self.predictors_names.append('cs')

            mi, _, _ = bct.matching_ind(self.A)
            self.predictors_list.append(mi)
            self.predictors_names.append('mi')

        fg_bin = []
        for t in self.t_values:
            fg_bin.append(flow_graph(self.A_und > 0, t))
            self.predictors_names.append('fg-bin-t{}'.format(t))

        self.predictors_list += fg_bin

        fg_wei = []
        for t in self.t_values:
            fg_wei.append(flow_graph(self.A_und, t))
            self.predictors_names.append('fg-wei-t{}'.format(t))
        self.predictors_list += fg_wei

        pt_bin = path_transitivity((self.A_und > 0).astype('float'))
        self.predictors_list.append(pt_bin)
        self.predictors_names.append('pt-bin')

        pt_wei = []
        for gamma in self.gamma_values:
            pt = path_transitivity(self.A_und, gamma=gamma)
            pt_wei.append(pt)
            self.predictors_names.append('pt-wei-{}'.format(gamma))
        self.predictors_list += pt_wei

        si_bin = compute_search_information((self.A_und > 0).astype('float'), transform=True, gamma=1)
        self.predictors_list.append(si_bin)
        self.predictors_names.append('si-bin')

        si_wei = []
        for gamma in self.gamma_values:
            si = compute_search_information(self.A_und, transform=True, gamma=gamma)
            si_wei.append(si)
            self.predictors_names.append('si-wei-{}'.format(gamma))
        self.predictors_list += si_wei

        if directed:
            outputs = navigation_wu(inverse_matrix(self.A, inf=False), self.euclidean_distance, max_hops=10000)
        else:
            outputs = navigation_wu(inverse_matrix(self.A_und, inf=False), self.euclidean_distance, max_hops=10000)

        nav_num_bin = invsym(outputs[1])
        nav_num_wei = invsym(outputs[2])
        nav_dist = invsym(outputs[3])
        self.predictors_list.append(nav_num_bin)
        self.predictors_list.append(nav_num_wei)
        self.predictors_list.append(nav_dist)
        self.predictors_names.append('nav-num-bin')
        self.predictors_names.append('nav-num-wei')
        self.predictors_names.append('nav-dist')

        self.exclude_regions()
        self.normalize_predictors()

        predictors_flattened = []
        for p in self.predictors_list:
            predictors_flattened.append(p.flatten())
        self.predictors = np.stack(predictors_flattened, axis=1)
        self.predictors = zscore(self.predictors, axis=0)

    def correlate_single_predictors(self, FC):
        triangle = np.triu_indices(FC.shape[0], 1)
        correlations_single = []
        for p in self.predictors_list:
            r = pearsonr(p[triangle], FC[triangle])[0]
            if np.isnan(r):
                correlations_single.append(0)
            else:
                correlations_single.append(r)
        return np.array(correlations_single)
