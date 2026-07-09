# Source: main.py
# Summary: See repo_context.md

from calimba.analysis import *
from skimage import io
from scipy.sparse import load_npz
from scipy.ndimage.filters import gaussian_filter
from scipy.ndimage.measurements import center_of_mass
from tqdm import tqdm
from numba import njit
from scipy.ndimage import gaussian_filter1d, minimum_filter1d
import h5py
from scipy.stats import pearsonr
from sklearn.metrics import normalized_mutual_info_score, adjusted_rand_score, jaccard_score, fowlkes_mallows_score
from scipy.cluster.hierarchy import dendrogram, linkage, fcluster, ward, leaves_list, set_link_color_palette
import networkx as nx
import bct
from matplotlib import patches
from scipy.interpolate import interp1d
import nrrd
from tifffile import imwrite
from skimage.io import imread
from scipy.ndimage import median_filter, maximum_filter
from scipy.signal import medfilt
import contextlib
import pickle
from scipy.signal import convolve


@contextlib.contextmanager
def temp_random_state(seed=None):
    state = np.random.get_state()  # Save the current state
    np.random.seed(seed)  # Set the temporary seed
    try:
        yield  # Perform your operations within this block
    finally:
        np.random.set_state(state)  # Restore the original state


def get_datasets(top_directory, keywords=[], exclude=[]):
    folders = identify_folders(top_directory, ['dpf'])
    datasets = []
    for folder in folders:
        datasets += identify_folders(folder, keywords=keywords, exclude=exclude)
    return datasets


def identify_files(path, keywords=None, exclude=None):
    items = os.listdir(path)
    if keywords is None:
        keywords = []
    if exclude is None:
        exclude = []
    files = []
    for item in items:
        if all(keyword in item for keyword in keywords):
            if any(excluded in item for excluded in exclude):
                pass
            else:
                files.append(item)
    files.sort()
    return files


def identify_folders(path, keywords=None, exclude=None):
    initial_folders = [f.path for f in os.scandir(path) if f.is_dir()]
    if keywords is None:
        keywords = []
    if exclude is None:
        exclude = []
    folders = []
    for folder in initial_folders:
        if all(keyword in folder for keyword in keywords):
            if any(excluded in folder for excluded in exclude):
                pass
            else:
                folders.append(folder)
    for i in range(len(folders)):
        folders[i] += '/'
    folders.sort()
    return folders


def get_region_name(atlas, keyword):
    region_ids = []
    for i, name in enumerate(atlas.names):
        if keyword in name:
            region_ids.append(i)
    return region_ids


@njit
def compute_correlation_matrix(timeseries, arctanh=False):
    N = timeseries.shape[0]
    matrix = np.zeros((N, N))
    for i in range(N):
        for j in range(i + 1, N):
            if arctanh:
                matrix[i, j] = np.arctanh(np.corrcoef(timeseries[i], timeseries[j])[0, 1])
            else:
                matrix[i, j] = np.corrcoef(timeseries[i], timeseries[j])[0, 1]
            matrix[j, i] = matrix[i, j]
    return matrix


def get_correlation_matrices(timeseries_list):
    corr_matrices = []
    for i in range(len(timeseries_list)):
        matrix = compute_correlation_matrix(timeseries_list[i])
        matrix[np.isnan(matrix)] = 0
        corr_matrices.append(matrix)
    return corr_matrices


def baseline_minfilter(signal, window=300, sigma1=5, sigma2=100, debug=False):
    signal_flatstart = np.copy(signal)
    signal_flatstart[0] = signal[1]
    smooth = gaussian_filter1d(signal_flatstart, sigma1)
    mins = minimum_filter1d(smooth, window)
    baseline = gaussian_filter1d(mins, sigma2)
    if debug:
        debug_out = np.asarray([smooth, mins, baseline])
        return debug_out
    else:
        return baseline


def compute_dff_using_minfilter(timeseries, window=200, sigma1=0.1, sigma2=50):
    if len(timeseries.shape) == 1:
        baseline = baseline_minfilter(timeseries, window=window, sigma1=sigma1, sigma2=sigma2)
        dff = (timeseries - baseline) / baseline
    else:
        dff = np.zeros(timeseries.shape)
        for i in range(timeseries.shape[0]):
            if np.any(timeseries[i]):
                baseline = baseline_minfilter(timeseries[i], window=window, sigma1=sigma1, sigma2=sigma2)
                dff[i] = (timeseries[i] - baseline) / baseline
    return dff


def load_metadata(directory):
    files = identify_files(directory, ['info', '.txt'])
    if any(files):
        if len(files) > 1:
            raise Warning('There is more than one info file. Loading the first one.')
        metadata = read_info_file(directory + files[0])
        return metadata
    else:
        raise FileNotFoundError('No info file found in directory.')


def read_info_file(path, strings=False):
    f = open(path, 'r')
    info = f.readlines()
    f.close()
    metadata = {}
    for line in info:
        attribute, value = line.split('=')[0].strip(), line.split('=')[1].strip()
        metadata[attribute] = value
    if strings is False:
        for key in metadata.keys():
            if key in ['laser.power', 'x.pixels', 'y.pixels', 'z.planes', 't.frames',
                             'frame.rate', 'volume.rate', 'x.pixel.size', 'y.pixel.size', 'z.spacing']:
                try:
                    metadata[key] = float(metadata[key])
                except:
                    pass
    return metadata


def load_data(directory):
    files = identify_files(directory, ['data', '.hdf5'])
    if any(files):
        if len(files) > 1:
            raise Warning('Multiple data files in directory. Loading the first one.')
        return load_hdf5(directory + files[0])
    else:
        raise FileNotFoundError('No .hdf5 data file identified in directory.')


def load_hdf5(path):
    data = {}
    file = h5py.File(path, 'r')
    for dataset in file.keys():
        data[dataset] = np.array(file[dataset])
    file.close()
    return data


def correlate_matrix_lists(matrix_list1, matrix_list2):
    L1, L2 = len(matrix_list1), len(matrix_list2)
    N = matrix_list1[0].shape[0]
    correlation_matrix = np.zeros((L1, L2))
    triangle = np.triu_indices(N, 1)
    for i in range(L1):
        for j in range(L2):
            correlation_matrix[i, j] = pearsonr(matrix_list1[i][triangle], matrix_list2[j][triangle])[0]
    return correlation_matrix


def fit_signal(signal1, signal2):
    """Fit one-dimensional signal1 to signal2 using simple inversion of a linear matrix equation.
    Returns: fit coefficients (a, b) and fit signal a * signal1 + b."""
    signal1 = np.expand_dims(signal1.flatten(), axis=1)  # (N x 1) vector
    signal2 = np.expand_dims(signal2.flatten(), axis=1)  # (N x 1) vector
    vectors = np.concatenate([signal1, np.ones((signal1.shape[0], 1))], axis=1)  # (N x 2) matrix
    coeffs = (np.linalg.pinv(vectors) @ signal2).flatten()
    fit = coeffs[0] * signal1 + coeffs[1]
    return coeffs, fit.flatten()


def remove_global_signal(timeseries):
    """Computes mean signal, then fits and subtracts this mean signal to each individual signal (row)."""
    global_signal = np.mean(timeseries, axis=0)
    regressed = np.zeros(timeseries.shape)
    for i in range(timeseries.shape[0]):
        _, fit = fit_signal(global_signal, timeseries[i])
        regressed[i] = timeseries[i] - fit
    return regressed


def filter_timeseries(timeseries, sigma=2):
    filtered = np.zeros(timeseries.shape)
    for i in range(timeseries.shape[0]):
        filtered[i] = gaussian_filter1d(timeseries[i], sigma)
    return filtered


@njit
def compute_distances(centroids):
    dist_matrix = np.zeros((centroids.shape[0], centroids.shape[0]))
    for i in range(centroids.shape[0]):
        for j in range(i + 1):
            dist_matrix[i, j] = np.sqrt(np.sum((centroids[i] - centroids[j]) ** 2))
            dist_matrix[j, i] = dist_matrix[i, j]
    return dist_matrix


class MapzebrainAtlas:

    def __init__(self, path):
        """
        Class that contains many atlas-related things like brain region masks, names, functions to map centroids into
        binary masks, etc. Must be provided a 'path' to a folder containing all atlas-related files that are loaded
        when the object is first instanciated. Make sure the path ends with a '/'.
        """
        self.path = path
        self.dimensions = np.array([974, 597, 359])
        self.shape = np.array([974, 597, 359])
        self.volume = np.product(self.dimensions) # Volume (in voxels)
        self.masks = load_npz(path + 'regions.npz')
        self.relativeVolumes = np.load(path + 'volumes.npy')
        self.regionNames = self.loadRegionNames(path)
        self.region_acronyms = self.load_acronyms(path)
        self.regionCentroids = self.loadRegionCentroids(path)
        self.regionCentroids['right'][57, 0] = self.dimensions[1] - self.regionCentroids['left'][57, 0] # Correcting coordinate
        self.excludedRegions = []
        self.rostroCaudalOrder = self.establishRostroCaudalOrder()
        self.XYprojection = io.imread(path + 'XY_H2BGCaMP6s.tif')
        self.XZprojection = io.imread(path + 'XZ_H2BGCaMP6s.tif')

    @property
    def order(self):
        if any(self.excludedRegions):
            order = np.delete(self.rostroCaudalOrder, self.excludedRegions)
            newOrder = np.array([0] * len(order))
            for i, element in enumerate(np.unique(order)):
                newOrder[order == element] = i
            return newOrder
        else:
            return self.rostroCaudalOrder

    @property
    def names(self):
        return list(np.delete(self.regionNames, self.excludedRegions))

    @property
    def acronyms(self):
        return list(np.delete(self.region_acronyms, self.excludedRegions))

    @property
    def centroids(self):
        centroids = {}
        centroids['left'] = np.delete(np.copy(self.regionCentroids['left']), self.excludedRegions, axis=0)
        centroids['right'] = np.delete(np.copy(self.regionCentroids['right']), self.excludedRegions, axis=0)
        return centroids

    def excludeRegions(self, excludedRegions):
        self.excludedRegions = excludedRegions

    def getRegionMask(self, ID, orientation='vertical'):
        if orientation == 'vertical':
            mask = np.flip(np.flip(np.flip(np.swapaxes(np.swapaxes(np.rot90(np.reshape(self.masks[:, ID].toarray(),
                                                                                       (597, 974, 359), order='F'),
                                                                            k=3), 0, 2), 1, 2), axis=1), axis=0),
                           axis=2)
        elif orientation == 'horizontal':
            mask = np.flip(np.swapaxes(np.transpose(np.reshape(self.masks[:, ID].toarray(), (597, 974, 359), order='F'),
                                                    (1, 0, 2)), 0, 2), axis=0)
        return mask

    def mapCentroids(self, centroids, orientation='vertical'):
        centroids = self.trim_centroids(centroids, orientation=orientation)
        regionLabels = np.zeros((centroids.shape[0], len(self.regionNames)))
        for i in tqdm(range(len(self.regionNames)), file=sys.stdout):
            mask = self.getRegionMask(i, orientation=orientation)
            # regionLabels[:, i] = mask[centroids[:, 1], centroids[:, 0], centroids[:, 2]]
            regionLabels[:, i] = mask[centroids[:, 2], centroids[:, 1], centroids[:, 0]]
        regionLabels = regionLabels.astype('bool')
        return regionLabels

    def mapCentroidsLeftRight(self, centroids, orientation='vertical'):
        centroids = self.trim_centroids(centroids, orientation=orientation)
        regionLabels = {}
        regionLabels['left'] = np.zeros((centroids.shape[0], len(self.regionNames)))
        regionLabels['right'] = np.zeros((centroids.shape[0], len(self.regionNames)))
        for i in tqdm(range(len(self.regionNames)), file=sys.stdout):
            mask = self.getRegionMask(i, orientation=orientation)
            for hemisphere in ['left', 'right']:
                halfMask = np.copy(mask)
                if hemisphere == 'left':
                    if orientation == 'vertical':
                        halfMask[:, :, 284:] = 0
                    elif orientation == 'horizontal':
                        halfMask[:, 284:, :] = 0
                elif hemisphere == 'right':
                    if orientation == 'vertical':
                        halfMask[:, :, :284] = 0
                    elif orientation == 'horizontal':
                        halfMask[:, :284, :] = 0
                regionLabels[hemisphere][:, i] = halfMask[centroids[:, 2], centroids[:, 1], centroids[:, 0]]
        regionLabels['left'] = regionLabels['left'].astype('bool')
        regionLabels['right'] = regionLabels['right'].astype('bool')

        return np.concatenate([regionLabels['left'], regionLabels['right']], axis=1)

    def computeDistanceBetweenRegions(self):
        N = len(self.regionNames)
        distance = np.zeros((N, N))
        left = self.regionCentroids['left']
        right = self.regionCentroids['right']
        for i in range(N):
            for j in range(i + 1, N):
                distanceMax = np.sqrt(
                    (left[i, 0] - right[j, 0]) ** 2 + (left[i, 1] - right[j, 1]) ** 2 + (left[i, 2] - right[j, 2]) ** 2)
                distanceMin = np.sqrt(
                    (left[i, 0] - left[j, 0]) ** 2 + (left[i, 1] - left[j, 1]) ** 2 + (left[i, 2] - left[j, 2]) ** 2)
                distance[i, j] = (distanceMax + distanceMin) / 2
                distance[j, i] = distance[i, j]
        return distance

    def computeRegionCentroids(self):
        COMs = {}
        COMs['left'] = np.zeros((len(self.regionNames), 3))
        COMs['right'] = np.zeros((len(self.regionNames), 3))
        for i in range(len(self.regionNames)):
            mask = self.getRegionMask(i)
            for hemisphere in ['left', 'right']:
                halfMask = np.copy(mask)
                if hemisphere == 'left':
                    halfMask[284:, :, :] = 0
                elif hemisphere == 'right':
                    halfMask[:284, :, :] = 0
                COMs[hemisphere][i, :] = center_of_mass(halfMask)
        COMs['right'][:, 1] = COMs['left'][:, 1]
        COMs['right'][:, 2] = COMs['left'][:, 2]
        self.regionCentroids = COMs

    def loadRegionNames(self, path):
        file = open(path + 'names.txt', 'r')
        lines = file.readlines()
        file.close()
        regions = []
        for line in lines:
            regions.append(line.split('\n')[0])
        return regions

    def load_acronyms(self, path):
        file = open(path + 'acronyms.txt', 'r')
        lines = file.readlines()
        file.close()
        regions = []
        for line in lines:
            regions.append(line.split('\n')[0])
        return regions

    def loadRegionCentroids(self, path):
        file = open(path + 'regionCentroids.pkl', 'rb')
        regionCentroids = pickle.load(file)
        file.close()
        return regionCentroids

    def establishRostroCaudalOrder(self):
        positions = []
        for region in range(len(self.regionNames)):
            # positions.append((self.regionCentroids['left'][region, 1] + self.regionCentroids['right'][region, 1]) / 2)
            positions.append(self.regionCentroids['left'][region, 1])
        order = []
        for i in range(len(self.regionNames)):
            order.append(np.where(np.flip(np.sort(positions)) == positions[i])[0][0])
        return np.array(order)

    def trim_centroids(self, centroids, orientation='vertical'):
        if orientation == 'vertical':
            centroids[:, 0] = np.clip(centroids[:, 0], 0, 596)
            centroids[:, 1] = np.clip(centroids[:, 1], 0, 973)
        elif orientation == 'horizontal':
            centroids[:, 0] = np.clip(centroids[:, 0], 0, 973)
            centroids[:, 1] = np.clip(centroids[:, 1], 0, 596)
        centroids[:, 2] = np.clip(centroids[:, 2], 0, 358)
        return centroids

    def generate_video_projection(self, timeseries, centroids, view='top', filter_noise=False, sigma=1):
        if filter:
            for i in range(timeseries.shape[0]):
                timeseries[i] = medfilt(timeseries[i], 3)
        if view == 'top':
            divider = np.zeros((self.dimensions[0], self.dimensions[1]))
            for c in centroids:
                divider[c[1], c[0]] += 1
            divider[divider == 0] = 1
            frames = []
            for i in tqdm(range(timeseries.shape[1]), file=sys.stdout):
                frame = np.zeros((self.dimensions[0], self.dimensions[1]))
                for j in range(timeseries.shape[0]):
                    frame[centroids[j][1], centroids[j][0]] += timeseries[j, i]
                frame /= divider
                frame = gaussian_filter(frame, sigma)
                frames.append(frame)
        if view == 'side':
            divider = np.zeros((self.dimensions[2], self.dimensions[1]))
            for c in centroids:
                divider[c[2], c[0]] += 1
            divider[divider == 0] = 1
            frames = []
            for i in tqdm(range(timeseries.shape[1]), file=sys.stdout):
                frame = np.zeros((self.dimensions[2], self.dimensions[1]))
                for j in range(timeseries.shape[0]):
                    frame[centroids[j][2], centroids[j][0]] += timeseries[j, i]
                frame /= divider
                frame = gaussian_filter(frame, sigma)
                frames.append(frame)
        video = np.stack(frames, axis=0)
        video -= np.amin(video)
        video /= np.amax(video)
        video *= 255
        return video

    def plot_centroids(self, ax, centroids, view='top', cmap='hot', sigma=2, vmin=0, vmax=1, s=30, alpha=0.1):
        # Loading outline
        density = np.zeros(self.dimensions)
        for c in centroids:
            density[c[1], c[0], c[2]] += 1
        # Computing density
        if view == 'top':
            density = np.sum(density, axis=2)
            density = gaussian_filter(density, sigma)
            density[density > vmax] = vmax
            density[density < vmin] = vmin
            intensity_values = density[centroids[:, 1], centroids[:, 0]]
        elif view == 'side':
            density = np.swapaxes(np.sum(density, axis=0), 0, 1)
            density = gaussian_filter(density, sigma)
            density[density > vmax] = vmax
            density[density < vmin] = vmin

            intensity_values = density[centroids[:, 2], centroids[:, 0]]
        if view == 'top':
            ax.scatter(centroids[:, 0], centroids[:, 1], s=s, alpha=alpha, c=intensity_values, cmap=cmap,
                       edgecolor='none')
        else:
            ax.scatter(centroids[:, 0], centroids[:, 2], s=s, alpha=alpha, c=intensity_values, cmap=cmap,
                       edgecolor='none')
        ax.axis('off')

    def plot_centroid_density(self, ax, centroids, view='top', cmap='hot',
                              threshold=0.02, sigma=1.5, vmin=0, vmax=0.6):
        # Loading outline
        # Computing density
        if view == 'top':
            density = np.zeros((self.dimensions[0], self.dimensions[1]))
            for c in centroids:
                density[c[1], c[0]] += 1
        elif view == 'side':
            density = np.zeros((self.dimensions[2], self.dimensions[1]))
            for c in centroids:
                density[c[2], c[0]] += 1
        density = gaussian_filter(density, sigma)
        density[density < threshold] = np.nan
        ax.imshow(density, cmap=cmap, vmin=vmin, vmax=vmax)
        ax.axis('off')

    def generate_centroid_density(self, centroids, sigma=0, crop=False):
        density = np.zeros(self.dimensions)
        density[centroids[:, 1], centroids[:, 0], centroids[:, 2]] = 1
        if sigma > 0:
            density = gaussian_filter(density, sigma)
        density = np.swapaxes(np.swapaxes(density, 0, 2), 1, 2)
        density = density.astype('double')
        density -= np.amin(density)
        density /= np.amax(density)
        density *= 65535
        # To fit with current cropped version of the atlas (deprecated)
        # if crop:
        #    density = rescale_image(density, (180, 597, 974))
        #    density = density[:, :, 200:-57]
        return density


def double(vector):
    """Duplicates values in a 1D vector to make it twice as long."""
    return np.concatenate([vector, vector])


def reorder_clusters_anteroposterior(clusters):
    """Assuming that indices are ordered from anterior to posterior, reorders the cluster ids such that cluster 1 is
    the most anterior and cluster N is the most posterior."""
    mean_cluster_ids = []
    for c in np.unique(clusters):
        mean_cluster_ids.append(np.percentile(np.where(clusters == c)[0], 33))
    order = np.argsort(mean_cluster_ids) + 1
    new_clusters = np.zeros((len(clusters),))
    for i, c in enumerate(order):
        new_clusters[clusters == c] = i + 1
    return new_clusters.astype('int')


def permute_timeseries(timeseries):
    permuted = np.copy(timeseries)
    for i in range(permuted.shape[0]):
        j = int(np.random.uniform(0, timeseries.shape[1]))
        permuted[i, :] = np.concatenate([permuted[i, j:], permuted[i, :j]])
    return permuted


def plot_matrix_communities(ax, matrix, communities, cmap='coolwarm', colors=None, edgecolor='black', linewidth=1, output=False, vmin=None, vmax=None):
    if vmin is None:
        vmin = np.min(matrix)
    if vmax is None:
        vmax = np.max(matrix)
    ids = np.argsort(communities)
    transitions = list(np.where(np.diff(communities[ids]) != 0)[0])
    boundaries = [0]
    for value in transitions:
        boundaries.append(value + 1)
    boundaries.append(matrix.shape[0])

    im = ax.imshow(matrix[ids, :][:, ids], cmap=cmap, vmin=vmin, vmax=vmax)
    for i, community in enumerate(np.unique(communities)):
        r1, r2 = boundaries[i] - 0.5, boundaries[i + 1] - 0.5
        if colors is not None:
            rect = patches.Rectangle((r1, r1), r2 - r1, r2 - r1, linewidth=linewidth, edgecolor=colors[i], facecolor='none')
        else:
            rect = patches.Rectangle((r1, r1), r2 - r1, r2 - r1, linewidth=linewidth, edgecolor=edgecolor, facecolor='none')
        ax.add_patch(rect)
    if output:
        return im


def compute_communities_overlap(communities1, communities2, method='NMI', excluded=None):
    if excluded is None:
        excluded = []
    if method == 'NMI':
        score = normalized_mutual_info_score(communities1, np.delete(communities2, excluded))
    elif method == 'Jaccard':
        score = jaccard_score(communities1, np.delete(communities2, excluded), average='weighted')
    elif method == 'FMI':
        score = fowlkes_mallows_score(communities1, np.delete(communities2, excluded))
    elif method == 'Rand':
        score = adjusted_rand_score(communities1, np.delete(communities2, excluded))
    return score


def compute_communities_overlap_curve(coassignment1, coassignment2, method='NMI', N_communities=np.arange(2, 11), excluded=None, linkage_method='ward'):
    if excluded is None:
        excluded = []
    scores = []
    for N in N_communities:
        Z = linkage(1 - coassignment1, linkage_method)
        communities1 = reorder_clusters_anteroposterior(fcluster(Z, t=N, criterion='maxclust'))
        Z = linkage(1 - coassignment2, linkage_method)
        communities2 = reorder_clusters_anteroposterior(fcluster(Z, t=N, criterion='maxclust'))
        if method == 'NMI':
            score = normalized_mutual_info_score(communities1, np.delete(communities2, excluded))
        elif method == 'Jaccard':
            score = jaccard_score(communities1, np.delete(communities2, excluded), average='weighted')
        elif method == 'FMI':
            score = fowlkes_mallows_score(communities1, np.delete(communities2, excluded))
        elif method == 'Rand':
            score = adjusted_rand_score(communities1, np.delete(communities2, excluded))
        scores.append(score)
    return scores


def compute_communities_overlap_curve_shuffled(coassignment1, coassignment2, method='NMI', N_communities=np.arange(2, 11), excluded=None, N_shuffles=1000, linkage_method='ward'):
    if excluded is None:
        excluded = []
    scores_null = []
    for N in tqdm(N_communities, file=sys.stdout):
        Z = linkage(1-coassignment1, linkage_method)
        communities1 = reorder_clusters_anteroposterior(fcluster(Z, t=N, criterion='maxclust'))
        Z = linkage(1-coassignment2, linkage_method)
        communities2 = reorder_clusters_anteroposterior(fcluster(Z, t=N, criterion='maxclust'))
        null_values = []
        for _ in range(N_shuffles):
            np.random.shuffle(communities1)
            if method == 'NMI':
                score = normalized_mutual_info_score(communities1, np.delete(communities2, excluded))
            elif method == 'Jaccard':
                score = jaccard_score(communities1, np.delete(communities2, excluded), average='weighted')
            elif method == 'FMI':
                score = fowlkes_mallows_score(communities1, np.delete(communities2, excluded))
            elif method == 'Rand':
                score = adjusted_rand_score(communities1, np.delete(communities2, excluded))
            null_values.append(score)
        scores_null.append(null_values)
    return scores_null


def compute_coassignment_probability(W, N_iters=1000, gamma_min=0.7, gamma_max=2.2, threshold=True):
    if np.array_equal(W, W.T):
        directed = False
    else:
        directed = True

    gammas = np.linspace(gamma_min, gamma_max, N_iters)
    communities = np.zeros((W.shape[0], N_iters))

    for i in tqdm(range(N_iters), file=sys.stdout):
        if directed:
            communities[:, i], _ = bct.modularity_louvain_dir(W, gamma=gammas[i])
        else:
            communities[:, i], _ = bct.modularity_louvain_und(W, gamma=gammas[i])

    coassignment_matrix = compute_consensus_matrix_from_labels(communities)

    if threshold:
        communities_null = shuffle_communities(communities)
        coassignment_matrix_null = compute_consensus_matrix_from_labels(communities_null)
        coassignment_matrix -= np.mean(coassignment_matrix_null)
        coassignment_matrix[coassignment_matrix < 0] = 0

    return coassignment_matrix


@njit
def compute_consensus_matrix_from_labels(communities):
    R = communities.shape[0]
    coassignment_matrix = np.zeros((R, R))
    for i in range(R):
        for j in range(i + 1, R):
            coassignment_matrix[i, j] = len(np.where((communities[i, :] == communities[j, :]) == True)[0]) / \
                                        communities.shape[1]
            coassignment_matrix[j, i] = coassignment_matrix[i, j]
    return coassignment_matrix


@njit
def shuffle_communities(communities):
    null_communities = np.copy(communities)
    for i in range(null_communities.shape[1]):
        vector = null_communities[:, i]
        np.random.shuffle(vector)
        null_communities[:, i] = vector
    return null_communities


def compute_coassignment_probability_nx(W, N_iters=1000, gamma_min=0.8, gamma_max=3, threshold=True):
    gammas = np.linspace(gamma_min, gamma_max, N_iters)
    communities = np.zeros((W.shape[0], N_iters))

    for i in tqdm(range(N_iters), file=sys.stdout):
        communities[:, i] = communities_louvain(W, gamma=gammas[i])

    coassignment_matrix = compute_consensus_matrix_from_labels(communities)

    if threshold:
        communities_null = shuffle_communities(communities)
        coassignment_matrix_null = compute_consensus_matrix_from_labels(communities_null)
        coassignment_matrix -= np.mean(coassignment_matrix_null)
        coassignment_matrix[coassignment_matrix < 0] = 0

    return coassignment_matrix


def communities_louvain(W, gamma=1.0):
    communities = np.zeros((W.shape[0],))
    G = nx.from_numpy_array(W)
    output = nx.community.louvain_communities(G, resolution=gamma)
    for cid, s in enumerate(output):
        for node in s:
            communities[node] = cid
    return communities.astype('int')


def interpolate_signal(signal, new_size):
    signal = signal.flatten()
    x = np.arange(0, len(signal))
    y = signal
    f = interp1d(x, y)
    x_new = np.linspace(0, len(signal) - 1, new_size, endpoint=False)
    interpolated = f(x_new)
    return interpolated


def load_stack(path):
    if '.tif' in path:
        return imread(path)
    elif '.nrrd' in path:
        array, metadata = nrrd.read(path)
        array = np.swapaxes(array, 0, 2)
        return array, metadata


def save_stack(path, stack, header=None):
    """
    Function to save a numpy array in a 16-bit .tif format.
    """
    if '.tif' in path:
        imwrite(path, stack.astype('uint16'))
    elif '.nrrd' in path:
        if header is None:
            nrrd.write(path, np.transpose(stack.astype('uint16'), (2, 1, 0)))
        else:
            nrrd.write(path, np.transpose(stack.astype('uint16'), (2, 1, 0)), header)


def find_onsets(binary_vector):
    return np.where(np.append([0], np.diff(binary_vector.astype('float'))) > 0)[0]


def find_plateaus(binary_vector):
    onsets = find_onsets(binary_vector.astype('float'))
    plateaus = np.zeros((len(onsets), len(binary_vector)))
    for i, onset in enumerate(onsets):
        j = onset
        plateaus[i, j] = 1
        while plateaus[i, j] == 1:
            j += 1
            try:
                plateaus[i, j] = binary_vector[j]
            except:
                break
    return plateaus
    

def find_offsets(binary_vector):
    return np.where(np.append([0], np.diff(binary_vector.astype('float'))) < 0)[0]
    
    
def max_interpolate_signal(signal, desired_length):
    original_length = len(signal)
    bin_size = original_length / desired_length
    interpolated_signal = []
    for i in range(desired_length):
        start = int(i * bin_size)
        end = int((i + 1) * bin_size)
        max_value = max(signal[start:end])
        interpolated_signal.append(max_value)
    return np.array(interpolated_signal)


def exponential(t, tau=3.5):
    return np.exp(-1 * (t / tau))
    
    
class TailAnalysis:

    def __init__(self, tail_angles, fps, sigma_median=3, sigma_gaussian=1):
        self.raw_angles = tail_angles
        self.angles = self.filter_angles(tail_angles, sigma_median=sigma_median, sigma_gaussian=sigma_gaussian)
        for i in range(tail_angles.shape[0]):
            self.angles[i, :] -= np.mean(self.angles[i, :])
        self.curvature = np.sum(self.angles, axis=0)
        self.curvature = self.curvature - np.mean(self.curvature)
        self.raw_curvature = np.sum(self.raw_angles, axis=0)

        self.velocity = np.abs(np.diff(self.curvature))
        self.raw_velocity = np.abs(np.diff(self.raw_curvature))
        self.fps = fps
        self.t = np.linspace(0, self.angles.shape[1]/self.fps, self.angles.shape[1], endpoint=False)
        self.baseline = np.mean(np.sum(self.angles, axis=0))
        self.clusters = []

    def detect_swim_bouts(self, threshold=0.5, window_min=600, window_max=30, min_duration=45):

        # Converting to seconds
        w_min = int(self.fps * window_min / 1000)
        w_max = int(self.fps * window_max / 1000)
        min_duration = int(self.fps * min_duration / 1000)

        maxcurve = maximum_filter(subtract_local_minima(np.abs(self.curvature), w_min), w_max)
        plateaus = find_plateaus(maxcurve > threshold)
        plateaus = plateaus[np.sum(plateaus, axis=1) >= min_duration, :]

        events = np.sum(plateaus, axis=0)
        onsets = find_onsets(events)
        offsets = find_offsets(events)

        self.onsets, self.offsets, self.events = onsets, offsets, events

    def remove_low_amplitude_events(self, threshold=1):
        onsets, offsets = [], []
        for i, onset in enumerate(self.onsets):
            if np.sum(np.abs(self.curvature[onset:self.offsets[i]]) > threshold) == 0:
                self.events[onset:self.offsets[i]] = 0
            else:
                onsets.append(onset)
                offsets.append(self.offsets[i])
        self.onsets = onsets
        self.offsets = offsets

    def exclude_frames(self, frames):
        onsets, offsets = [], []
        for i in range(len(self.offsets)):
            if frames[0] <= self.onsets[i] <= frames[1]:
                self.events[self.onsets[i]:self.offsets[i]] = 0
            elif frames[0] <= self.offsets[i] <= frames[1]:
                self.events[self.onsets[i]:self.offsets[i]] = 0
            else:
                onsets.append(self.onsets[i])
                offsets.append(self.offsets[i])
        self.onsets, self.offsets = onsets, offsets

    def compile_swim_bouts(self):
        bouts = []
        maxLength = 0
        for i in range(len(self.onsets)):
            bouts.append(self.angles[:, self.onsets[i]:self.offsets[i]])
            if bouts[-1].shape[1] > maxLength:
                maxLength = bouts[-1].shape[1]
        self.swimBouts = bouts

        boutMatrix = np.zeros((len(bouts), maxLength))
        for i in range(len(bouts)):
            totalCurvature = np.sum(bouts[i], axis=0) - self.baseline
            L = bouts[i].shape[1]
            boutMatrix[i, :L] = np.sign(np.mean(totalCurvature[0:5])) * totalCurvature
        self.boutMatrix = boutMatrix

    def cluster_swim_bouts(self, nClusters):
        kmeans = KMeans(n_clusters=nClusters, random_state=0).fit(self.boutMatrix)
        self.clusters = kmeans.labels_
        clusterCentroids = []
        for cluster in np.unique(self.clusters):
            IDs = np.where(self.clusters == cluster)[0]
            clusterBouts = np.zeros((len(IDs), self.boutMatrix.shape[1]))
            for i, ID in enumerate(IDs):
                totalCurvature = np.sum(self.swimBouts[ID], axis=0) - self.baseline
                L = self.swimBouts[ID].shape[1]
                clusterBouts[i, :L] = np.sign(np.mean(totalCurvature[0:5])) * totalCurvature
            clusterCentroids.append(np.mean(clusterBouts, axis=0))
        self.clusterCentroids = clusterCentroids
        self.colors = self.generateDistinctColors(nClusters, saturation=100, value=100, randomness=0)
        clusterVectors = []
        for cluster in np.unique(self.clusters):
            vector = np.array([0] * len(self.events))
            IDs = np.where(self.clusters == cluster)[0]
            for ID in IDs:
                vector[self.onsets[ID]:self.offsets[ID]] = 1
            clusterVectors.append(vector)
        self.clusterVectors = clusterVectors

    def add_calcium_data(self, data, calciumFps):
        self.calciumData = data
        self.calciumFps = calciumFps
        T = self.calciumData['timeseries'].shape[1]
        self.t_calcium = np.linspace(0, (T - 1) / self.calciumFps, T)

    def compile_motion_during_calcium(self):
        delta_t = (self.t_calcium[1] - self.t_calcium[0]) / 2
        motionLeft, motionRight = [], []
        motionSpikes = np.copy(self.raw_curvature)[:-1]
        motionSpikes[self.events == 0] = 0
        for t in self.t_calcium:
            IDs = (self.t[:-1] >= (t - delta_t)) & (self.t[:-1] < (t + delta_t))
            motionLeft.append(np.sum(motionSpikes[IDs][motionSpikes[IDs] > 0]))
            motionRight.append(np.abs(np.sum(motionSpikes[IDs][motionSpikes[IDs] < 0])))
        self.motionLeft, self.motionRight = np.array(motionLeft), np.array(motionRight)
        self.totalMotion = self.motionLeft + self.motionRight

        if any(self.clusters):
            clusterMotion = []
            for cluster in np.unique(self.clusters):
                clusterSpeed = np.abs(np.copy(self.raw_velocity))
                clusterSpeed[(self.clusterVectors[cluster] == 1) == False] = 0
                motion = []
                for t in self.t_calcium:
                    IDs = (self.t[:-1] >= (t - delta_t)) & (self.t[:-1] < (t + delta_t))
                    motion.append(np.sum(clusterSpeed[IDs]))
                clusterMotion.append(motion)
            self.clusterMotion = clusterMotion

    def create_regressors(self, tau=3.5):
        self.regressorLeft = convolve(self.motionLeft, self.exponential_decay(self.t_calcium,
                                                                              halfDecay=tau))[:len(self.t_calcium)]
        self.regressorRight = convolve(self.motionRight, self.exponential_decay(self.t_calcium,
                                                                                halfDecay=tau))[:len(self.t_calcium)]
        self.regressorTotal = convolve(self.totalMotion, self.exponential_decay(self.t_calcium,
                                                                                halfDecay=tau))[:len(self.t_calcium)]
        if any(self.clusters):
            regressors = []
            for motion in self.clusterMotion:
                regressor = convolve(motion, self.exponential_decay(self.t_calcium, halfDecay=tau))[:len(self.t_calcium)]
                regressors.append(regressor)
            self.regressors = regressors

    def display_cluster(self, cluster, figsize=(10, 5), xlim=[0, 2]):
        plt.figure(figsize=figsize)
        IDs = np.where(self.clusters == cluster)
        plt.plot([0, 100], [0, 0], '--', color='black', linewidth=3)
        for ID in IDs[0]:
            #totalCurvature = np.sum(self.swimBouts[ID], axis=0) - self.baseline
            #direction = np.mean(totalCurvature[0:5])
            totalCurvature = np.sum(self.swimBouts[ID], axis=0) - np.sum(self.swimBouts[ID], axis=0)[0]
            direction = np.mean(totalCurvature[0:10])
            plt.plot(self.t[0:len(totalCurvature)], np.sign(direction) * totalCurvature, color='black', alpha=0.2,
                     linewidth=3)
        plt.plot(self.t[0:len(self.clusterCentroids[cluster])], self.clusterCentroids[cluster], color=self.colors[cluster], linewidth=5)
        plt.xlim(xlim)
        plt.xlabel('Time (s)')
        plt.ylabel('Total curvature (rad)')
        plt.tight_layout(pad=0)

    def display_cluster_centroids(self, figsize=(10, 10)):
        plt.figure(figsize=figsize)
        for i, centroid in enumerate(self.clusterCentroids):
            plt.plot(self.t[0:len(centroid)], gaussian_filter1d(centroid, 1), linewidth=5, label='Cluster {}'.format(i + 1),
                     color=self.colors[i])
        plt.xlim([0, 0.3])
        plt.legend()
        plt.xlabel('Time (s)')
        plt.ylabel('Total curvature (rad)')
        plt.tight_layout(pad=0)

    def display_cluster_sequence(self, figsize=(10, 10), xlim=None, alpha=0.2, color='black'):
        if xlim is None:
            xlim = [0, self.t[-1]]
        plt.figure(figsize=figsize)
        plt.plot(self.t, self.curvature, linewidth=4, color='black')
        for i, vector in enumerate(self.clusterVectors):
            plt.fill_between(self.t[:-1], -20, 40 * vector - 20, linewidth=0, edgecolor=None, alpha=alpha, color=self.colors[i])
        plt.xlabel('Time (s)')
        plt.ylabel('Tail curvature (rad)')
        plt.ylim([-np.max(self.curvature), np.max(self.curvature)])
        plt.xlim(xlim)

    def display_sequence(self, figsize=(10, 10), xlim=None):
        if xlim is None:
            xlim = [0, self.t[-1]]
        plt.figure(figsize=figsize)
        plt.plot(self.t, self.curvature, linewidth=4, color='black')
        plt.fill_between(self.t[:-1], -20, 40 * self.events - 20, linewidth=0, edgecolor=None, alpha=1, color='red')
        plt.xlabel('Time (s)')
        plt.ylabel('Tail curvature (rad)')
        plt.ylim([-np.max(self.curvature), np.max(self.curvature)])
        plt.xlim(xlim)

    def display_event(self, event_number):
        onset = self.onsets[event_number]
        offset = self.offsets[event_number]
        plt.figure(figsize=(15, 5))
        plt.plot(self.curvature[onset - 50:offset + 50])
        plt.plot(self.events[onset - 50:offset + 50])
        plt.title('Onset: frame {}'.format(onset))

    def display_velocity(self, event_number):
        onset = self.onsets[event_number]
        offset = self.offsets[event_number]
        plt.figure(figsize=(15, 5))
        plt.plot(self.velocity[onset - 50:offset + 50])
        plt.plot(self.smoothVelocity[onset - 50:offset + 50])
        plt.plot(self.events[onset - 50:offset + 50])
        plt.title('Onset: frame {}'.format(onset))

    @staticmethod
    def filter_angles(angles, sigma_median=3, sigma_gaussian=1):
        filtered = np.copy(angles)
        for i in range(filtered.shape[0]):
            filtered[i, :] = gaussian_filter1d(
                median_filter(median_filter(filtered[i, :], sigma_median),
                              sigma_median),
                sigma_gaussian)
        return filtered

    @staticmethod
    def exponential_decay(t, tau=3.5):
        return np.exp(-1 * (t / tau))
