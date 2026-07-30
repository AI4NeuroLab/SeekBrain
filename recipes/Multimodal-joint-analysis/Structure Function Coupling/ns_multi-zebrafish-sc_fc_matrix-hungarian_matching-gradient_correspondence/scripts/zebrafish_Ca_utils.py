"""
Zebrafish Neurobehavior Toolkit
================================

This module provides a comprehensive toolkit for analyzing larval zebrafish whole-brain imaging
and behavioral data. It includes functions and classes for data loading, preprocessing,
brain atlas mapping (MapZebrain), centroid/density visualization, tail-motion detection,
regression modeling, and figure generation for publication-quality results.

Main Components
---------------
- MapzebrainAtlas
  Loads and manages MapZebrain brain atlas data (masks, names, acronyms, centroids, etc.).
  Provides methods to map cell centroids into brain-region masks, compute distances,
  create density maps, and visualize brain projections.
  Expected folder structure (path must end with '/'):
    regions.npz        Sparse atlas region masks (CSR)
    volumes.npy        Relative region volumes
    names.txt          Full region names
    acronyms.txt       Region acronyms
    centroids.pkl      Dictionary {'left','right'} → (N,3) centroids
    XY_H2BGCaMP6s.tif  Top projection
    XZ_H2BGCaMP6s.tif  Side projection

- TailAnalysis
  Handles tail-angle sequences for larval swimming behavior. Includes filtering,
  swim-bout detection (threshold + plateau detection), cleaning, clustering,
  and alignment with calcium imaging data for motion-based regressors.

- Regressors
  Creates exponentially convolved regressors from stimulus or behavior sequences,
  supports correlation and linear fitting (via pseudoinverse),
  and includes cyclic-shuffled controls for null testing.

- PaperFigure
  Helper class to create multi-panel, “Nature-style” publication figures.
  Allows precise subplot placement, unified font/tick styles, letter labeling,
  and high-resolution export.

- Common Utility Functions
  • Data: load_hdf5, load_data, identify_folders/files, get_datasets  
  • Signal: baseline_minfilter, compute_dff_using_minfilter, interpolate_signal,
            max_interpolate_signal, correlate_timeseries (numba accelerated)  
  • Spatial: plot_centroids_on_atlas, compute_density_atlas, trim_centroids_atlas,
             plot_regional_values, spatial_p_value_test (cross-larva reproducibility using NN distances)  
  • I/O: save_stack (16-bit TIFF / NRRD export)

Quick Usage
------------
1) Load atlas and map centroids:
    atlas = MapzebrainAtlas("/path/to/atlas/")
    labels = atlas.mapCentroids(centroids_array, orientation="vertical")

2) Detect swim events:
    ta = TailAnalysis(tail_angles, fps=500)
    ta.detect_swim_bouts(threshold=0.5, window_min=600, window_max=30, min_duration=45)
    ta.compile_swim_bouts()

3) Align calcium data and build motion regressors:
    ta.add_calcium_data(data_dict, calciumFps=2.0)
    ta.compile_motion_during_calcium()
    ta.create_regressors(tau=3.5)

4) Stimulus regressors and fitting:
    regs = Regressors(sequence=stim_seq, fps=stim_fps)
    regs.set_reference_timestamps(ta.t_calcium)
    regs.create_regressor("light_on", keywords=["light","on"])
    corr = regs.correlate(timeseries=data_dict["timeseries"], name="light_on")

Dependencies
------------
numpy, scipy (ndimage/signal/stats), numba, scikit-image, tifffile, h5py,
matplotlib, tqdm, scikit-learn (for KMeans), scipy.sparse, pickle, and optionally nrrd.

Notes
-----
- Coordinate convention: voxel dimensions are (974, 597, 359).
  Ensure centroid arrays are in (x, y, z) format and clipped using trim functions if needed.
- I/O: The MapZebrain atlas loader expects specific filenames.
  The `save_stack` function transposes arrays to match NRRD conventions.
- Performance: Large datasets benefit from numba acceleration.
- Debugging: The `MapzebrainAtlas.__init__` currently includes a `pdb.set_trace()` breakpoint—remove for production use.

"""

import numpy as np
from scipy.ndimage import gaussian_filter1d, minimum_filter1d
from scipy.ndimage import median_filter, maximum_filter
import os
import h5py
from scipy.interpolate import interp1d
from scipy.signal import convolve
from numba import njit
from scipy.ndimage import gaussian_filter
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from scipy.spatial import cKDTree
from tqdm import tqdm
import sys
from scipy.stats import norm, f_oneway, percentileofscore, shapiro, levene, ttest_ind, mannwhitneyu
from tifffile import imwrite
from scipy.sparse import load_npz
import pickle
from skimage.io import imread
from sklearn.neighbors import NearestNeighbors
from scipy.optimize import linear_sum_assignment
import contextlib
from scipy.stats import pearsonr, zscore
from IPython.display import display
import bct
from scipy.cluster.hierarchy import dendrogram, linkage, fcluster, ward, leaves_list, set_link_color_palette
from sklearn.metrics import normalized_mutual_info_score, adjusted_rand_score, jaccard_score, fowlkes_mallows_score



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
        self.volume = np.prod(self.dimensions) # Volume (in voxels)
        self.masks = load_npz(os.path.join(path,'regions.npz'))
        self.relativeVolumes = np.load(path + '/volumes.npy')
        self.regionNames = self.loadRegionNames(path)
        self.region_acronyms = self.load_acronyms(path)
        self.regionCentroids = self.loadRegionCentroids(path)
        self.regionCentroids['right'][57, 0] = self.dimensions[1] - self.regionCentroids['left'][57, 0] # Correcting coordinate
        self.excludedRegions = []
        self.rostroCaudalOrder = self.establishRostroCaudalOrder()
        self.XYprojection = imread(os.path.join(path, 'XY_H2BGCaMP6s.tif'))
        self.XZprojection = imread(os.path.join(path, 'XZ_H2BGCaMP6s.tif'))

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
        file = open(os.path.join(path,'names.txt'), 'r')
        lines = file.readlines()
        file.close()
        regions = []
        for line in lines:
            regions.append(line.split('\n')[0])
        return regions

    def load_acronyms(self, path):
        file = open(os.path.join(path, 'acronyms.txt'), 'r')
        lines = file.readlines()
        file.close()
        regions = []
        for line in lines:
            regions.append(line.split('\n')[0])
        return regions

    def loadRegionCentroids(self, path):
        file = open(os.path.join(path, 'centroids.pkl'), 'rb')
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


def get_datasets(top_directory, keywords=[], exclude=[]):
    folders = identify_folders(top_directory, ['Subjects'])
    datasets = []
    for folder in folders:
        datasets += identify_folders(folder, keywords=keywords, exclude=exclude)
    return datasets


def load_hdf5(path):
    data = {}
    file = h5py.File(path, 'r')
    for dataset in file.keys():
        data[dataset] = np.array(file[dataset])
    file.close()
    return data

def normalize(matrix):
    norm = np.linalg.norm(matrix)
    return matrix / norm

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

def exponential(t, tau=3.5):
    return np.exp(-1 * (t / tau))

def load_stack(path):
    if '.tif' in path:
        return imread(path)
    elif '.nrrd' in path:
        array, metadata = nrrd.read(path)
        array = np.swapaxes(array, 0, 2)
        return array, metadata

def sigmoid_contrast(image, gain=10, cutoff=0.5):
    return 1 / (1 + np.exp(gain * (cutoff - image)))

def merge(images, colors, gain=10, cutoff=0.5, contrast=False):
    if len(images) != len(colors):
        raise ValueError("Each image must have a corresponding color.")

    height, width = images[0].shape
    rgb_image = np.zeros((height, width, 3), dtype=np.float32)

    for img, color in zip(images, colors):
        for c in range(3):  # Iterate over RGB channels
            normalized_img = img / np.max(img) if np.max(img) > 0 else img
            rgb_image[:, :, c] += normalized_img * color[c]

    rgb_image /= np.max(rgb_image)

    for c in range(3):
        if contrast:
            rgb_image[:, :, c] = sigmoid_contrast(rgb_image[:, :, c], gain=gain, cutoff=cutoff)
        else:
            rgb_image[:, :, c] = rgb_image[:, :, c]
    return rgb_image

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

def interpolate_signal(signal, new_size):
    signal = signal.flatten()
    x = np.arange(0, len(signal))
    y = signal
    f = interp1d(x, y)
    x_new = np.linspace(0, len(signal) - 1, new_size, endpoint=False)
    interpolated = f(x_new)
    return interpolated

def load_data(directory):

    files = identify_files(directory, ['data', '.hdf5'])
    if any(files):
        if len(files) > 1:
            raise Warning('Multiple data files in directory. Loading the first one.')
        return load_hdf5(directory + files[0])
    else:
        raise FileNotFoundError('No .hdf5 data file identified in directory.')


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


def plot_matrix_communities(ax, matrix, communities, cmap='gray', colors=None, edgecolor='black', linewidth=1, output=False, vmin=None, vmax=None):

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

@njit
def correlate_timeseries(timeseries, regressor):
    correlations = []
    for i in range(timeseries.shape[0]):
        correlations.append(np.corrcoef(timeseries[i], regressor)[0, 1])
    return np.array(correlations)

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


def plot_centroids_on_atlas(centroids, atlas, figsize=(2, 2), color='red', alpha=0.05, dpi=300, cmap_bg='gray', ratio=0.6, s=3, density=False, cmap='turbo', sigma=10):

    if density:
        rho = compute_density_atlas(centroids, sigma=sigma)
        order = np.argsort(rho)
    w1, w2 = ratio * figsize[0], (1 - ratio) * figsize[0]
    fig = PaperFigure(figsize=figsize, dpi=dpi)
    fig.add_axes('projection_top', (0, 0), w1 * 0.99, figsize[1])
    fig.add_axes('projection_side', (w1, 0), w2, figsize[1])

    ax = fig.axes['projection_top']
    ax.imshow(atlas.XYprojection, cmap=cmap_bg, aspect='auto')
    if density:
        ax.scatter(centroids[order, 0], centroids[order, 1], c=rho[order], cmap=cmap, alpha=alpha, edgecolor='None', s=s)
    else:
        ax.scatter(centroids[:, 0], centroids[:, 1], color=color, alpha=alpha, edgecolor='None', s=s)
    ax.set_xlim([65, 505])
    ax.set_ylim([850, 50])
    ax.axis('off')

    ax = fig.axes['projection_side']
    ax.imshow(np.rot90(atlas.XZprojection, k=3), cmap=cmap_bg, aspect='auto')
    if density:
        ax.scatter(359 - centroids[order, 2], centroids[order, 1], c=rho[order], cmap=cmap, alpha=alpha, edgecolor='None', s=s)
    else:
        ax.scatter(359 - centroids[:, 2], centroids[:, 1], color=color, alpha=alpha, edgecolor='None', s=s)
    ax.set_xlim([50, 359])
    ax.set_ylim([850, 50])
    ax.axis('off')

    return fig


def compute_density_atlas(centroids, sigma=2):
    centroids_trimmed = np.round(trim_centroids_atlas(centroids)).astype('int')
    density = np.zeros((974, 597, 359))
    for c in np.round(centroids_trimmed).astype('int'):
        density[c[1], c[0], c[2]] += 1
    density = gaussian_filter(density, sigma)
    density_values = density[centroids_trimmed[:, 1], centroids_trimmed[:, 0], centroids_trimmed[:, 2]]
    return density_values

def trim_centroids_atlas(centroids):
    centroids[:, 0] = np.clip(centroids[:, 0], 0, 596)
    centroids[:, 1] = np.clip(centroids[:, 1], 0, 973)
    centroids[:, 2] = np.clip(centroids[:, 2], 0, 358)
    return centroids


class PaperFigure:

    def __init__(self, figsize=(7, 7), dpi=600):
        """
        Class to make multi-panel figures in Nature style. Notebooks which use this class should run this import
        statement before:
        from IPython.display import display

        Parameters
        ----------
        figsize: Size of the figure (width followed by height, in inches). Recommended width: 7.
        dpi: Resolution of the figure.
        """
        plt.ioff()
        plt.close('all')
        plt.ioff()
        self.set_tick_length()
        self.set_tick_pad()
        self.fig = plt.figure(figsize=figsize, dpi=dpi)
        self.ratio = figsize[1] / figsize[0]  # Height / Width
        self.dims = figsize
        self.grid_dims = (1000, int(1000 * self.ratio))
        self.xscale = self.grid_dims[0] / figsize[0]
        self.yscale = self.grid_dims[1] / figsize[1]
        self.gridspec = gridspec.GridSpec(self.grid_dims[1], self.grid_dims[0], figure=self.fig)
        self.axes = {}

    @property
    def keys(self):
        keys = list(self.axes.keys())
        if 'background' in keys:
            keys.remove('background')
        return keys

    def set_font_size(self, fontsize):
        plt.rcParams['font.size'] = fontsize

    def add_axes(self, label, position, width, height):
        """label: 1 character string (a, b, c, ...) to label the panel
           position: top left corner coordinates (fractional, between 0 and 1)
           width: width of the panel (fractional, between 0 and 1)
           height: height of the panel (fractional, between 0 and 1)"""
        x0, y0 = int(position[0] * self.xscale), int(position[1] * self.yscale)
        x1, y1 = x0 + int(width * self.xscale), y0 + int(height * self.yscale)
        self.axes[label] = self.fig.add_subplot(self.gridspec[y0:y1, x0:x1])

    def add_background(self):
        """Positions empty array as a white background. Useful when first figuring out the layout to get full figure output,
        but should be removed when saving the figure."""
        self.add_axes('background', (0, 0), self.dims[0], self.dims[1])
        self.axes['background'].axis('off')

    def remove_all_ticks(self):
        for key in self.keys:
            ax = self.axes[key]
            ax.set_xticks([])
            ax.set_yticks([])

    def set_tick_length(self, length=1.5):
        plt.rcParams['xtick.major.size'] = length
        plt.rcParams['xtick.minor.size'] = length
        plt.rcParams['ytick.major.size'] = length
        plt.rcParams['ytick.minor.size'] = length

    def set_tick_pad(self, pad=3):
        plt.rcParams['xtick.major.pad'] = pad
        plt.rcParams['ytick.major.pad'] = pad

    def add_labels(self, ha='right', va='top', fontsize=14, weight='bold', padx=0.03, pady=0.01, labels=None):

        if labels is None:
            keys = self.keys
        else:
            keys = labels

        for key in keys:
            ax = self.axes[key]
            bbox = ax.get_position()
            x, y = bbox.x0, bbox.y1
            if len(key) == 1:
                self.fig.text(x - padx, y + pady, key, fontsize=fontsize, weight=weight, ha=ha, va=va)

    def show(self):
        display(self.fig)

    def save(self, path, pad=0):
        self.fig.savefig(path, bbox_inches='tight', pad_inches=pad)

    def close(self):
        self.fig.close()

    @staticmethod
    def get_cmap_color(cmap, value):
        """cmap: colormap string, value: number in range [0, 1]"""
        cmap = plt.cm.get_cmap(cmap)
        middle_color = cmap(value)
        color = mpl.colors.to_rgb(middle_color)
        return color


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

def get_centroids_from_labels(centroids_list, labels_list):
    centroids = []
    for i in range(len(centroids_list)):
        centroids.append(centroids_list[i][labels_list[i]])
    return centroids

def compute_pvalue(values, distribution):
    "One-sided, value smaller than distribution."
    mean, std = np.mean(distribution), np.std(distribution)
    zscores = (values - mean) / std
    pvalues = norm.cdf(zscores)
    return pvalues

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

def shuffle_labels(labels_list):
    shuffled_labels_list = []
    for i in range(len(labels_list)):
        shuffled_labels = np.copy(labels_list[i])
        np.random.shuffle(shuffled_labels)
        shuffled_labels_list.append(shuffled_labels)
    return shuffled_labels_list

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



def plot_regional_values(values, atlas, excluded=None, figsize=(2, 2), double_vector=False, dpi=300, cmap_bg='gray', ratio=0.6, s=5, cmap='viridis', vmin=None, vmax=None, linewidth=0.5):

    if excluded is None:
        excluded = []
    centroids = np.concatenate([atlas.regionCentroids['left'], atlas.regionCentroids['right']], axis=0)
    centroids[:, 1] = 974 - centroids[:, 1]
    if double_vector:
        values = double(values)
        excluded = np.concatenate([excluded, excluded + 70])
    centroids = np.delete(centroids, excluded, axis=0)
    if vmin is None:
        vmin = np.min(values)
    if vmax is None:
        vmax = np.max(values)

    w1, w2 = ratio * figsize[0], (1 - ratio) * figsize[0]
    fig = PaperFigure(figsize=figsize, dpi=dpi)
    fig.add_axes('projection_top', (0, 0), w1 * 0.99, figsize[1])
    fig.add_axes('projection_side', (w1, 0), w2, figsize[1])

    ax = fig.axes['projection_top']
    ax.imshow(atlas.XYprojection, cmap=cmap_bg, aspect='auto')
    ax.scatter(centroids[:, 0], centroids[:, 1], c=values, edgecolor='black', s=s, vmin=vmin, vmax=vmax, cmap=cmap, linewidth=linewidth)
    ax.set_xlim([65, 505])
    ax.set_ylim([850, 50])
    ax.axis('off')

    ax = fig.axes['projection_side']
    ax.imshow(np.rot90(atlas.XZprojection, k=3), cmap=cmap_bg, aspect='auto')
    ax.scatter(359 - centroids[:, 2], centroids[:, 1], c=values, cmap=cmap, edgecolor='black', s=s, vmin=vmin, vmax=vmax, linewidth=linewidth)
    ax.set_xlim([50, 359])
    ax.set_ylim([850, 50])
    ax.axis('off')

    return fig


def double(vector):
    """Duplicates values in a 1D vector to make it twice as long."""
    return np.concatenate([vector, vector])




def find_nearest_neighbors(centroids1, centroids2):
    nn_model = NearestNeighbors(n_neighbors=1, algorithm='auto').fit(centroids2)
    _, indices = nn_model.kneighbors(centroids1)
    return indices.flatten()





def compute_mode_similarity_matrix(modes1, modes2, return_mapping=False, method='pearson'):
    N_modes = modes1.shape[0]
    corrs = np.zeros((N_modes, N_modes))
    for i in range(N_modes):
        for j in range(N_modes):
            if method == 'pearson':
                corrs[i, j] = pearsonr(modes1[i], modes2[j])[0]
            elif method == 'spearman':
                corrs[i, j] = spearmanr(modes1[i], modes2[j])[0]
    
    cost_matrix = 1 - np.abs(corrs)
    _, mapping = linear_sum_assignment(cost_matrix)
    
    corrs = np.zeros((N_modes, N_modes))
    for i in range(N_modes):
        for j in range(N_modes):
            if method == 'pearson':
                corrs[i, j] = pearsonr(modes1[i], modes2[mapping[j]])[0]
            elif method == 'spearman':
                corrs[i, j] = spearmanr(modes1[i], modes2[mapping[j]])[0]
    if return_mapping:
        return corrs, mapping
    else:
        return corrs


def compute_correlation_matrix(timeseries, arctanh=False):
    import numpy as np

    # 🧹 确保 timeseries 是标准二维 float64 数组
    timeseries = np.asarray(timeseries, dtype=np.float64, order="C")

    # 处理任何 NaN、Inf
    timeseries = np.where(np.isfinite(timeseries), timeseries, np.nan)

    N = timeseries.shape[0]
    matrix = np.full((N, N), np.nan, dtype=np.float64)

    for i in range(N):
        xi = timeseries[i]
        if xi.size == 0 or np.all(np.isnan(xi)) or np.std(xi) < 1e-10:
            continue
        for j in range(i + 1, N):
            xj = timeseries[j]
            if xj.size == 0 or np.all(np.isnan(xj)) or np.std(xj) < 1e-10:
                continue
            try:
                r = np.corrcoef(xi, xj)[0, 1]
                if arctanh:
                    r = np.arctanh(r)
                matrix[i, j] = matrix[j, i] = r
            except Exception as e:
                matrix[i, j] = matrix[j, i] = np.nan
                print(f"⚠️ correlation failed for ({i},{j}): {e}")

    return matrix




@contextlib.contextmanager
def temp_random_state(seed=None):
    state = np.random.get_state()  # Save the current state
    np.random.seed(seed)  # Set the temporary seed
    try:
        yield  # Perform your operations within this block
    finally:
        np.random.set_state(state)  # Restore the original state
