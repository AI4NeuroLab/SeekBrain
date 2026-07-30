import sys
import numpy as np
import cv2
from random import uniform

from scipy import optimize
from scipy.stats import zscore
from scipy.ndimage import gaussian_filter, gaussian_filter1d
from scipy.cluster.hierarchy import dendrogram, linkage, fcluster, ward, leaves_list, set_link_color_palette

import matplotlib as mpl
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib import patches
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.collections import LineCollection
from mpl_toolkits.axes_grid1 import make_axes_locatable
import seaborn as sns

# from calimba.analysis import *
from colorsys import hsv_to_rgb

from zebrafish_Ca_utils_patch_xps import *


def draw_centroid_network_graph(ax, adjacency, centroids, directed=False, percentile=75, s=40, node_color='white', linewidth=1.5, edge_color='white', alpha=0.75, edge_cmap='hot', edge_vmin=0, edge_vmax=1, flip_order=False, node_edgecolor='black', node_edgewidth=1, rasterized=False):
    edge_list = get_edgelist(adjacency, directed=directed)
    edge_array = np.array(edge_list)
    edge_ids = edge_array[:, 2] >= np.percentile(edge_array[:, 2], percentile)
    edge_list = list(edge_array[edge_ids, :])
    edge_position = get_edge_positions(centroids, edge_list)
    weights = np.array(edge_list)[:, 2]
    order = np.argsort(weights)
    if flip_order:
        order = np.flip(order)
    sorted_positions = []
    for i in order:
        sorted_positions.append(edge_position[i])
    edge_collection = LineCollection(
            sorted_positions,
            array=weights[order],
            cmap=edge_cmap,
            linewidths=weights[order] * linewidth,
            antialiaseds=(1,),
            alpha=(np.abs(weights[order]) / np.max(np.abs(weights[order]))) * alpha,
            rasterized=rasterized
        )
    edge_collection.set_clim(edge_vmin, edge_vmax)
    edge_collection.set_zorder(1)
    ax.scatter(centroids[:, 0], centroids[:, 1], color=node_color, zorder=10, s=s, edgecolor=node_edgecolor, linewidths=node_edgewidth, rasterized=rasterized)
    ax.add_collection(edge_collection)

def set_boxplot_color(bp, color, linewidth=2, facecolor='none', markersize=5, marker='o'):
    for whisker in bp['whiskers']:
        whisker.set(color=color, linewidth=linewidth)
    for cap in bp['caps']:
        cap.set(color=color, linewidth=linewidth)
    for flier in bp['fliers']:
        flier.set(marker='.', color=color, alpha=1)
    for median in bp['medians']:
        median.set(color=color, linewidth=linewidth)
    for box in bp['boxes']:
        box.set(color=color, linewidth=linewidth)
        box.set(facecolor=facecolor)
    for flier in bp['fliers']:
        flier.set_marker(marker)
        flier.set_markerfacecolor(color)
        flier.set_markeredgecolor(color)
        flier.set_markersize(markersize)

def hex2rgb(hex_color):
    h = hex_color.lstrip('#')
    return np.array(tuple(int(h[i:i+2], 16) for i in (0, 2, 4))) / 255

def display_half_matrices(ax, matrix1, matrix2, text1='Structural', text2='Functional', names=None, **kwargs):
    R = matrix1.shape[0]
    upperTriangle, lowerTriangle = triangle_indices(matrix1)
    composite = frobenius_normalize(np.copy(matrix1))
    composite[upperTriangle] = frobenius_normalize(matrix2)[upperTriangle]
    ax.imshow(composite, **kwargs)
    if names is not None:
        for i in range(R):
            ax.text(-1, i, names[i], horizontalalignment='right')
    ax.arrow(61.1, 61, -10, 0, width=0.5, head_width=1, color=[0, 0, 0])
    ax.arrow(61, 61.1, 0, -10, width=0.5, head_width=1, color=[0, 0, 0])
    ax.text(48, 61.6, text2, fontsize=20, horizontalalignment='right')
    ax.text(59.7, 48, text1, fontsize=20, rotation=90, verticalalignment='bottom')

def frobenius_normalize(matrix):
    norm = np.linalg.norm(matrix)
    return matrix / norm

def plot_smooth_histogram(ax, data, bins, N_interp=1000, sigma=20, density=False, color='black', edgecolor='black', alpha=1):
    h1 = np.histogram(data, bins=bins, density=density)
    #plt.close()
    y1 = gaussian_filter1d(interpolate_signal(h1[0], N_interp), sigma)
    x1 = interpolate_signal(h1[1], N_interp)
    ax.fill_between(x1, 0, y1, color=color, edgecolor=edgecolor, alpha=alpha)

def interpolate_signal(signal, new_size):
    signal = signal.flatten()
    x = np.arange(0, len(signal))
    y = signal
    f = interp1d(x, y)
    x_new = np.linspace(0, len(signal) - 1, new_size, endpoint=False)
    interpolated = f(x_new)
    return interpolated

def barchart(ax, datasets, colors, delta=0.15, s=75, dotcolor='white', edgecolor='black', dot_alpha=0.5):
    for i, dataset in enumerate(datasets):
        ax.bar(i, np.mean(dataset), color=colors[i])
        ax.plot([i, i], [np.mean(dataset), np.mean(dataset) + np.std(dataset)], color='black')
        ax.plot([i - delta, i + delta], [np.mean(dataset) + np.std(dataset), np.mean(dataset) + np.std(dataset)], color='black')
        ax.scatter(np.random.normal(i, 0.05, len(dataset)), dataset, s=s, color=dotcolor, edgecolor=edgecolor, zorder=10, alpha=dot_alpha)

def plot_barchart_regions(ax, data_mean, data_std, labels, color='black', order=False, delta=0.1):
    if order:
        order = np.flip(np.argsort(data_mean))
    else:
        order = np.arange(0, len(labels))
    data_mean, data_std = np.copy(data_mean)[order], np.copy(data_std)[order]
    ax.bar(np.arange(0, len(labels)), data_mean, color=color)
    ax.spines[['right', 'top']].set_visible(False)
    ax.set_xticks(np.arange(0, len(labels)), np.array(labels)[order], rotation=90, fontsize=12)
    for i in range(len(labels)):
        ax.plot([i, i], [data_mean[i], data_mean[i] + data_std[i]], color='black')
        ax.plot([i - delta, i + delta], [data_mean[i] + data_std[i], data_mean[i] + data_std[i]], color='black')

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

def rgb2hex(rgb_color):
    """Convert RGB color values to HEX code."""
    if rgb_color.dtype == 'float' and np.sum(rgb_color <= 1) == 3:
        rgb_color = (rgb_color * 255).astype('int')
    r, g, b = rgb_color
    return "#{:02x}{:02x}{:02x}".format(r, g, b)

def get_colors_cmap(cmap, n_colors, start=0, end=1, hex=False):
    sampling_points = np.linspace(start, end, n_colors, endpoint=True).astype('float')
    colors = []
    for s in sampling_points:
        rgb_color = plt.get_cmap(cmap)(s)[:3]
        if hex:
            hex_color = rgb2hex((np.array(rgb_color) * 255).astype('int'))
            colors.append(hex_color)
        else:
            colors.append(rgb_color)
    return colors

def truncate_colormap(cmap, minval=0.0, maxval=1.0, n=100):
    cmap = plt.get_cmap(cmap)
    new_cmap = LinearSegmentedColormap.from_list(
        'trunc({n},{a:.2f},{b:.2f})'.format(n=cmap.name, a=minval, b=maxval),
        cmap(np.linspace(minval, maxval, n))
    )
    return new_cmap

def color_gradient(color1, color2, n_colors):
    colors = []
    for i in range(n_colors):
        alpha = i / (n_colors - 1)
        colors.append((1 - alpha) * np.array(color1) + alpha * np.array(color2))
    return colors

def line_plot(ax, datasets, labels, color='black'):
    for i in range(len(datasets[0])):
        ax.plot([0, 1], [datasets[0][i], datasets[1][i]], color=color)
        ax.scatter(0, datasets[0][i], s=50, facecolor=color, zorder=10)
        ax.scatter(1, datasets[1][i], s=50, facecolor=color, zorder=10)
    ax.set_xticks([0, 1])
    ax.set_xticklabels(labels)
    ax.set_xlim([-0.5, 1.5])
    for position in ['top', 'right']:
        ax.spines[position].set_visible(False)

def compute_centroid_density(x, y, sigma=5, array_shape=(1000, 1000)):
    x_norm = x - np.min(x)
    x_norm = x_norm / np.max(x_norm)
    y_norm = y - np.min(y)
    y_norm = y_norm / np.max(y_norm)
    density = np.zeros(array_shape)
    for i, j in zip(x_norm, y_norm):
        density[int(j * array_shape[0] - 1), int(i * array_shape[1] - 1)] += 1
    density = gaussian_filter(density, sigma=sigma)
    density_values = []
    for i, j in zip(x_norm, y_norm):
        density_values.append(density[int(j * array_shape[0] - 1), int(i * array_shape[1] - 1)])
    return np.array(density_values)


def scatterplot_with_histograms(x, y, colors, labels):
    """
    Display a scatter plot with histograms for the x and y distributions along the top and right border of the frame,
    respectively.
    """
    left, width = 0.1, 0.65
    bottom, height = 0.1, 0.65
    spacing = 0

    rect_scatter = [left, bottom, width, height]
    rect_histx = [left, bottom + height + spacing, width, 0.2]
    rect_histy = [left + width + spacing, bottom, 0.2, height]

    ax_scatter = plt.axes(rect_scatter)
    ax_scatter.tick_params(direction='in', top=True, right=True)
    ax_histx = plt.axes(rect_histx)
    ax_histx.tick_params(direction='in', labelbottom=False)
    ax_histy = plt.axes(rect_histy)
    ax_histy.tick_params(direction='in', labelleft=False)

    ax_histx.axis('off')
    ax_histy.axis('off')

    for i in range(len(x)):
        ax_scatter.scatter(x[i], y[i], color=colors[i], label=labels[i])
        ax_histx.hist(x, bins=50, color=colors[i])
        ax_histy.hist(y, bins=50, orientation='horizontal', color=colors[i])
    ax_histx.set_xlim(ax_scatter.get_xlim())
    ax_histy.set_ylim(ax_scatter.get_ylim())

    ax_scatter.legend(fontsize=20)


def show(ax, matrix, **kwargs):
    image = ax.imshow(matrix, **kwargs)
    divider = make_axes_locatable(ax)
    cax = divider.append_axes("right", size="5%", pad=0.1)
    plt.colorbar(image, cax=cax)


def generate_n_colors(nColors, saturation=80, value=90, randomness=0):
    h = np.linspace(0, 320, nColors)
    s = np.array([saturation + uniform(-randomness, randomness)] * nColors)
    v = np.array([value] * nColors)
    palette = []
    for i in range(nColors):
        palette.append(hsv_to_rgb(h[i] / 360, s[i] / 100, v[i] / 100))
    return palette


def make_cmap(colors, position=None, bit=False):
    '''
    make_cmap takes a list of tuples which contain RGB values. The RGB
    values may either be in 8-bit [0 to 255] (in which bit must be set to
    True when called) or arithmetic [0 to 1] (default). make_cmap returns
    a cmap with equally spaced colors.
    Arrange your tuples so that the first color is the lowest value for the
    colorbar and the last is the highest.
    position contains values from 0 to 1 to dictate the location of each color.
    '''
    bit_rgb = np.linspace(0,1,256)
    if position == None:
        position = np.linspace(0,1,len(colors))
    else:
        if len(position) != len(colors):
            sys.exit("position length must be the same as colors")
        elif position[0] != 0 or position[-1] != 1:
            sys.exit("position must start with 0 and end with 1")
    if bit:
        for i in range(len(colors)):
            colors[i] = (bit_rgb[colors[i][0]],
                         bit_rgb[colors[i][1]],
                         bit_rgb[colors[i][2]])
    cdict = {'red':[], 'green':[], 'blue':[]}
    for pos, color in zip(position, colors):
        cdict['red'].append((pos, color[0], color[0]))
        cdict['green'].append((pos, color[1], color[1]))
        cdict['blue'].append((pos, color[2], color[2]))

    cmap = LinearSegmentedColormap('my_colormap', cdict, 256)
    return cmap




def ridgeline(ax, timeseries, scale_factor=1, text=None, fontsize=16):
    L = timeseries.shape[0]
    x = np.linspace(0, timeseries.shape[1] - 1, timeseries.shape[1]).astype('int')
    for i in range(L):
        ax.plot(zscore(timeseries[i, :]) + scale_factor * (L - i), color=[0, 0, 0], zorder=i)
        plt.fill_between(x, zscore(timeseries[i, :]) + scale_factor * (L - i), 0, color=[1, 1, 1], zorder=i)
        if text is not None:
            ax.text(-5, scale_factor * (L - i), text[i], fontsize=fontsize, horizontalalignment='right')


def plot_clusters(ax, array, clusters, colors=None, aspect=2, cmap='hot', vmin=-1, vmax=7, interp='none', line_alpha=1):
    sorted_array = array[clusters == 0, :]
    sorted_clusters = clusters[np.argsort(clusters)]
    for c in np.unique(clusters)[1:]:
        sorted_array = np.append(sorted_array, array[clusters == c, :], axis=0)
    ax.imshow(sorted_array, aspect=aspect, cmap=cmap, vmin=vmin, vmax=vmax, interpolation=interp)
    ax.plot([0, array.shape[1]], [0, 0], color='white')
    y = 0
    for i, c in enumerate(np.unique(sorted_clusters)):
        N = np.sum(clusters == c)
        if colors is not None:
            rect = patches.Rectangle((array.shape[1], y), 0.1 * array.shape[1], N, facecolor=colors[i], edgecolor='white')
            ax.add_patch(rect)
        y += N
        ax.plot([0, array.shape[1]], [y, y], color='white', alpha=line_alpha)
    if colors is not None:
        ax.set_xlim([0, 1.1 * array.shape[1]])
    else:
        ax.set_xlim([0, array.shape[1]])
    ax.set_ylim([array.shape[0], 0])


def plot_temporal_components(ax, components, variance):
    for i in range(components.shape[0]):
        ax.plot(normalize(components[i]) - i, color='black')
        ax.text(1.01 * components.shape[1], np.mean(normalize(components[i]) - i), '{:.3f}'.format(variance[i]))
    ax.axis('off')


def per_region_quantification(ax, values, region_labels, region_names, sort=False, color='black', highlight=-1):
    n_regions = len(region_names)
    mean_values = []
    for i in range(n_regions):
        if any(region_labels[:, i]):
            mean_values.append(np.mean(values[region_labels[:, i]]))
        else:
            mean_values.append(0)
    x = np.arange(n_regions) + 0.5
    if sort:
        order = np.flip(np.argsort(mean_values))
        ax.bar(x, np.array(mean_values)[order], facecolor=color)
        ax.set_xticks(x)
        ax.set_xticklabels(list(np.array(region_names)[order]), rotation=90, fontsize=10)
        if highlight >= 0:
            ax.bar(order[highlight] + 0.5, mean_values[order[highlight]], color='red')
    else:
        ax.bar(x, mean_values, facecolor=color)
        ax.set_xticks(x)
        ax.set_xticklabels(region_names, rotation=90, fontsize=10)
        if highlight >= 0:
            ax.bar(highlight + 0.5, mean_values[highlight], color='red')
    ax.plot([0, n_regions], [0, 0], color='black', linestyle='--')
    ax.spines[['right', 'top']].set_visible(False)
    ax.spines['bottom'].set_bounds(0, n_regions)
    


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

    fig.show()

        
def trim_centroids_atlas(centroids):
    centroids[:, 0] = np.clip(centroids[:, 0], 0, 596)
    centroids[:, 1] = np.clip(centroids[:, 1], 0, 973)
    centroids[:, 2] = np.clip(centroids[:, 2], 0, 358)
    return centroids


def compute_projection_density_atlas(centroids, view='top', sigma=2):
    centroids_trimmed = np.round(trim_centroids_atlas(centroids)).astype('int')
    if view == 'top':
        density = np.zeros(atlas.XYprojection.shape)
        for c in np.round(centroids_trimmed).astype('int'):
            density[c[1], c[0]] += 1
        density = gaussian_filter(density, sigma)
        density_values = density[centroids_trimmed[:, 1], centroids_trimmed[:, 0]]
    elif view == 'side':
        density = np.zeros(atlas.XZprojection.shape)
        for c in np.round(centroids_trimmed).astype('int'):
            density[c[2], c[1]] += 1
        density = gaussian_filter(density, sigma)
        density_values = density[centroids_trimmed[:, 2], centroids_trimmed[:, 1]]
    return density_values


def compute_density_atlas(centroids, sigma=2):
    centroids_trimmed = np.round(trim_centroids_atlas(centroids)).astype('int')
    density = np.zeros((974, 597, 359))
    for c in np.round(centroids_trimmed).astype('int'):
        density[c[1], c[0], c[2]] += 1
    density = gaussian_filter(density, sigma)
    density_values = density[centroids_trimmed[:, 1], centroids_trimmed[:, 0], centroids_trimmed[:, 2]]
    return density_values
    

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

    fig.show()


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


def merge_with_pixelwise_color_contrast(images, colors):
    height, width = images[0].shape
    rgb_image = np.zeros((height, width, 3), dtype=np.float32)

    for img, color in zip(images, colors):
        normalized_img = img / np.max(img) if np.max(img) > 0 else img
        weights = normalized_img / np.sum([img / np.max(img) if np.max(img) > 0 else img for img in images], axis=0)
        for c in range(3):
            rgb_image[:, :, c] += weights * normalized_img * color[c]

    rgb_image /= np.max(rgb_image)

    rgb_image_8bit = np.uint8(rgb_image * 255)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    for c in range(3):
        rgb_image_8bit[:, :, c] = clahe.apply(rgb_image_8bit[:, :, c])

    rgb_image = rgb_image_8bit.astype(np.float32) / 255

    return rgb_image



def get_edgelist(matrix, directed=False):
    if directed:
        i, j = np.where(matrix != 0)
        edges = np.stack([i, j], axis=1).astype('int')
    else:
        triangle = np.triu_indices(matrix.shape[0], 1)
        matrix_with_zeros = np.copy(matrix)
        matrix_with_zeros[triangle] = 0
        matrix__with_zeros = matrix_with_zeros.T
        i, j = np.where(matrix_with_zeros != 0)
        edges = np.stack([i, j], axis=1).astype('int')
    weights = matrix[i, j]
    edgelist = []
    for i, edge in enumerate(edges):
        edgelist.append(tuple([edge[0], edge[1], weights[i]]))
    return edgelist


def get_edge_positions(centroids, edgelist):
    x1, x2, y1, y2 = [], [], [], []
    for edge in edgelist:
        i, j, _ = edge
        x1.append(centroids[int(i), 0])
        y1.append(centroids[int(i), 1])
        x2.append(centroids[int(j), 0])
        y2.append(centroids[int(j), 1])
    edgepos = []
    for i in range(len(x1)):
        edgepos.append([(x1[i], y1[i]), (x2[i], y2[i])])
    return edgepos



