# Source: connectivity_matrices.py
# Summary: See repo_context.md

import itertools
import os
from typing import Callable
import numpy as np
import scipy.io

# Note: All connectivity matrices are in [from,to] order, so should be transposed for plotting / other usage if required!

class ConnectivityMatrix():
	def __init__(self, num_pen: int, num_peg: int, num_epg: int, num_d7: int, loader: Callable[[], np.ndarray]) -> None:
		self.NUM_PEN = num_pen
		self.NUM_PEG = num_peg
		self.NUM_EPG = num_epg
		self.NUM_D7 = num_d7
		self.CONNECTIVITY_MATRIX_SIZE = self.NUM_PEN + self.NUM_PEG + self.NUM_EPG + self.NUM_D7

		self.SLICE_PEN = slice(0, self.NUM_PEN)
		self.SLICE_PEG = slice(self.NUM_PEN,self.NUM_PEN+self.NUM_PEG)
		self.SLICE_EPG = slice(self.NUM_PEN+self.NUM_PEG,self.NUM_PEN+self.NUM_PEG+self.NUM_EPG)
		self.SLICE_D7 = slice(self.NUM_PEN+self.NUM_PEG+self.NUM_EPG,self.NUM_PEN+self.NUM_PEG+self.NUM_EPG+self.NUM_D7)

		self.GET_MATRIX = loader

slice_to_range = lambda slice: range(slice.start if slice.start else 0, slice.stop, slice.step if slice.step else 1)

def get_fly_connectivity_matrix_raw():
	return scipy.io.loadmat(os.path.join(os.path.dirname(__file__), 'connectivity_matrices/connectivity_matrix_drosophila_mine_case_5_9cols_labels1.mat'))['con_matrix'].T

def get_locust_connectivity_matrix_raw():
	return scipy.io.loadmat(os.path.join(os.path.dirname(__file__), 'connectivity_matrices/connectivity_matrix_locust_mine_case_6_with3s_labels_1.mat'))['con_matrix'].T

def get_fly_janelia_connectivity_matrix_raw():
	return np.load(os.path.join(os.path.dirname(__file__), 'connectivity_matrices/connectivity_matrix_drosophila_janelia_grouped.npy'))

def get_fly_janelia_one_sided_9_neurons_connectivity_matrix_raw():
	return np.load(os.path.join(os.path.dirname(__file__), 'connectivity_matrices/connectivity_matrix_drosophila_janelia_one_sided.npy'))

def get_fly_janelia_one_sided_8_neurons_connectivity_matrix_raw():
	return np.load(os.path.join(os.path.dirname(__file__), 'connectivity_matrices/connectivity_matrix_drosophila_janelia_one_sided_8_neurons.npy'))

def get_fly_simplified_connectivity_matrix_raw():
	return np.load(os.path.join(os.path.dirname(__file__), 'connectivity_matrices/connectivity_matrix_drosophila_simplified.npy'))

def get_locust_simplified_connectivity_matrix_raw():
	return np.load(os.path.join(os.path.dirname(__file__), 'connectivity_matrices/connectivity_matrix_locust_simplified.npy'))

FLY = ConnectivityMatrix(16, 18, 18, 8, get_fly_connectivity_matrix_raw)
LOCUST = ConnectivityMatrix(16, 16, 16, 8, get_locust_connectivity_matrix_raw)
FLY_JANELIA = ConnectivityMatrix(16, 18, 16, 8, get_fly_janelia_connectivity_matrix_raw)
FLY_JANELIA_ONE_SIDED_9_NEURONS = ConnectivityMatrix(8, 9, 9, 8, get_fly_janelia_one_sided_9_neurons_connectivity_matrix_raw)
FLY_JANELIA_ONE_SIDED_8_NEURONS = ConnectivityMatrix(8, 8, 8, 8, get_fly_janelia_one_sided_8_neurons_connectivity_matrix_raw)
FLY_SIMPLIFIED = ConnectivityMatrix(8, 8, 8, 8, get_fly_simplified_connectivity_matrix_raw)
LOCUST_SIMPLIFIED = ConnectivityMatrix(8, 8, 8, 8, get_locust_simplified_connectivity_matrix_raw)

def get_connectivity_matrix_bool(CM: ConnectivityMatrix):
	return CM.GET_MATRIX() != 0

def get_connectivity_matrix_string(CM: ConnectivityMatrix):
	'''Get the connectivity matrix with each cell either 0 (no connection) or `'connections_{pre_name}_{post_name}'` if the neurons are connected.'''
	connectivity_matrix = CM.GET_MATRIX()
	conn_mat_str = np.zeros_like(connectivity_matrix, dtype=object)

	for (pre_slice, pre_name), (post_slice, post_name) in itertools.product(zip([CM.SLICE_PEN, CM.SLICE_PEG, CM.SLICE_EPG, CM.SLICE_D7], ['PEN', 'PEG', 'EPG', 'D7']), repeat=2):
		conn_mat_str[pre_slice,post_slice][np.nonzero(connectivity_matrix[pre_slice,post_slice])] = f'connections_{pre_name}_{post_name}'

	return conn_mat_str

def neuron_index_to_name(CM: ConnectivityMatrix, neuron_index: int):
	assert neuron_index >= 0 and neuron_index < CM.CONNECTIVITY_MATRIX_SIZE, f'Neuron index {neuron_index} out of range of connectivity matrix'

	for index_range, name in zip([slice_to_range(slice) for slice in [CM.SLICE_PEN, CM.SLICE_PEG, CM.SLICE_EPG, CM.SLICE_D7]], ['PEN', 'PEG', 'EPG', 'D7']):
		if neuron_index in index_range:
			index_in_range = index_range.index(neuron_index)
			return f'{name}_{index_in_range+1}' if name == 'D7' \
				else f'{name}_{"L" if index_in_range < len(index_range)//2 else "R"}{(index_in_range % (len(index_range)//2)) +1}'
	
	raise IndexError(f"Can't find index {neuron_index} in connectivity matrix.")

def neuron_index_to_name_simplified_network(CM: ConnectivityMatrix, neuron_index: int):
	assert neuron_index >= 0 and neuron_index < CM.CONNECTIVITY_MATRIX_SIZE, f'Neuron index {neuron_index} out of range of connectivity matrix'

	for index_range, name in zip([slice_to_range(slice) for slice in [CM.SLICE_PEN, CM.SLICE_PEG, CM.SLICE_EPG, CM.SLICE_D7]], ['PEN', 'PEG', 'EPG', 'D7']):
		if neuron_index in index_range:
			index_in_range = index_range.index(neuron_index)
			return f'{name}_{index_in_range+1}' if name == 'D7' \
				else f'{name}_{index_in_range + 1}'
	
	raise IndexError(f"Can't find index {neuron_index} in connectivity matrix.")

def _get_connectivity_matrix_edge_list(CM: ConnectivityMatrix, neuron_index_to_name: Callable[[ConnectivityMatrix, int], str]):
	connectivity_matrix = CM.GET_MATRIX()
	index_to_name = lambda neuron_index : neuron_index_to_name(CM, neuron_index)

	return [(index_to_name(pre), index_to_name(post), {'weight': -2 if index_to_name(pre).split('_')[0]=='D7' else 1}) \
		for pre in range(CM.CONNECTIVITY_MATRIX_SIZE) \
		for post in range(CM.CONNECTIVITY_MATRIX_SIZE) \
		if connectivity_matrix[pre,post]]
get_connectivity_matrix_edge_list = lambda CM: _get_connectivity_matrix_edge_list(CM, neuron_index_to_name)
get_connectivity_matrix_edge_list_simplified_network = lambda CM: _get_connectivity_matrix_edge_list(CM, neuron_index_to_name_simplified_network)

get_fly_connectivity_matrix_bool = lambda : get_connectivity_matrix_bool(FLY)
get_fly_connectivity_matrix_string = lambda : get_connectivity_matrix_string(FLY)
fly_neuron_index_to_name = lambda neuron_index : neuron_index_to_name(FLY, neuron_index)
get_fly_connectivity_matrix_edge_list = lambda : get_connectivity_matrix_edge_list(FLY)

get_locust_connectivity_matrix_bool = lambda : get_connectivity_matrix_bool(LOCUST)
get_locust_connectivity_matrix_string = lambda : get_connectivity_matrix_string(LOCUST)
locust_neuron_index_to_name = lambda neuron_index : neuron_index_to_name(LOCUST, neuron_index)
get_locust_connectivity_matrix_edge_list = lambda : get_connectivity_matrix_edge_list(LOCUST)

get_fly_janelia_connectivity_matrix_bool = lambda : get_connectivity_matrix_bool(FLY_JANELIA)
get_fly_janelia_connectivity_matrix_string = lambda : get_connectivity_matrix_string(FLY_JANELIA)
fly_janelia_neuron_index_to_name = lambda neuron_index : neuron_index_to_name(FLY_JANELIA, neuron_index)
get_fly_janelia_connectivity_matrix_edge_list = lambda : get_connectivity_matrix_edge_list(FLY_JANELIA)

get_fly_janelia_one_sided_9_neurons_connectivity_matrix_bool = lambda : get_connectivity_matrix_bool(FLY_JANELIA_ONE_SIDED_9_NEURONS)
get_fly_janelia_one_sided_9_neurons_connectivity_matrix_string = lambda : get_connectivity_matrix_string(FLY_JANELIA_ONE_SIDED_9_NEURONS)
fly_janelia_one_sided_9_neurons_neuron_index_to_name = lambda neuron_index : neuron_index_to_name_simplified_network(FLY_JANELIA_ONE_SIDED_9_NEURONS, neuron_index)
get_fly_janelia_one_sided_9_neurons_connectivity_matrix_edge_list = lambda : get_connectivity_matrix_edge_list_simplified_network(FLY_JANELIA_ONE_SIDED_9_NEURONS)

get_fly_janelia_one_sided_8_neurons_connectivity_matrix_bool = lambda : get_connectivity_matrix_bool(FLY_JANELIA_ONE_SIDED_8_NEURONS)
get_fly_janelia_one_sided_8_neurons_connectivity_matrix_string = lambda : get_connectivity_matrix_string(FLY_JANELIA_ONE_SIDED_8_NEURONS)
fly_janelia_one_sided_8_neurons_neuron_index_to_name = lambda neuron_index : neuron_index_to_name_simplified_network(FLY_JANELIA_ONE_SIDED_8_NEURONS, neuron_index)
get_fly_janelia_one_sided_8_neurons_connectivity_matrix_edge_list = lambda : get_connectivity_matrix_edge_list_simplified_network(FLY_JANELIA_ONE_SIDED_8_NEURONS)

get_fly_simplified_connectivity_matrix_bool = lambda : get_connectivity_matrix_bool(FLY_SIMPLIFIED)
get_fly_simplified_connectivity_matrix_string = lambda : get_connectivity_matrix_string(FLY_SIMPLIFIED)
fly_simplified_neuron_index_to_name = lambda neuron_index : neuron_index_to_name_simplified_network(FLY_SIMPLIFIED, neuron_index)
get_fly_simplified_connectivity_matrix_edge_list = lambda : get_connectivity_matrix_edge_list_simplified_network(FLY_SIMPLIFIED)

get_locust_simplified_connectivity_matrix_bool = lambda : get_connectivity_matrix_bool(LOCUST_SIMPLIFIED)
get_locust_simplified_connectivity_matrix_string = lambda : get_connectivity_matrix_string(LOCUST_SIMPLIFIED)
locust_simplified_neuron_index_to_name = lambda neuron_index : neuron_index_to_name_simplified_network(LOCUST_SIMPLIFIED, neuron_index)
get_locust_simplified_connectivity_matrix_edge_list = lambda : get_connectivity_matrix_edge_list_simplified_network(LOCUST_SIMPLIFIED)



# For creating simplified connectivity matrices

def create_fly_simplified_connectivity_matrix():
	edges = \
		[(f'PEG_{i}', f'EPG_{i}') for i in range(1,9)] +\
		[(f'EPG_{i}', f'PEG_{i}') for i in range(1,9)] +\
		[(f'EPG_{i}', f'PEN_{i}') for i in range(1,9)] +\
		[(f'PEN_{i}', f'EPG_{(i-1+1) % 8 + 1}') for i in range(1,9)] +\
		[(f'PEN_{i}', f'EPG_{(i-1-1) % 8 + 1}') for i in range(1,9)] +\
		[(f'EPG_{i}', f'D7_{j}') for i in range(1,9) for j in range(1,9)] +\
		[(f'D7_{i}', f'D7_{j}') for i in range(1,9) for j in range(1,9) if i != j] +\
		[(f'D7_{i}', f'PEN_{i}') for i in range(1,9)] +\
		[(f'D7_{i}', f'PEG_{i}') for i in range(1,9)]

	node_names = [f'{type}_{n}' for type in ['PEN','PEG','EPG','D7'] for n in range(1,9)]

	connectivity_matrix = np.zeros((32,32))
	for pre, post in edges:
		connectivity_matrix[node_names.index(pre), node_names.index(post)] = -1 if pre.startswith('D7') else 1
	
	np.save(os.path.join(os.path.dirname(__file__), 'connectivity_matrices/connectivity_matrix_drosophila_simplified'), connectivity_matrix)

def create_locust_simplified_connectivity_matrix():
	edges = \
		[(f'PEG_{i}', f'EPG_{i}') for i in range(1,9)] +\
		[(f'EPG_{i}', f'PEG_{i}') for i in range(1,9)] +\
		[(f'EPG_{i}', f'PEN_{i}') for i in range(1,9)] +\
		[(f'PEN_{i}', f'EPG_{i}') for i in range(1,9)] +\
		[(f'PEN_{i}', f'EPG_{(i-1+1) % 8 + 1}') for i in range(1,9)] +\
		[(f'PEN_{i}', f'EPG_{(i-1-1) % 8 + 1}') for i in range(1,9)] +\
		[(f'EPG_{i}', f'D7_{j}') for i in range(1,9) for j in range(1,9) if 3 <= abs(i-j) <= 5] +\
		[(f'D7_{i}', f'D7_{j}') for i in range(1,9) for j in range(1,9) if 3 <= abs(i-j) <= 5] +\
		[(f'D7_{i}', f'PEN_{i}') for i in range(1,9)] +\
		[(f'D7_{i}', f'PEG_{i}') for i in range(1,9)]

	node_names = [f'{type}_{n}' for type in ['PEN','PEG','EPG','D7'] for n in range(1,9)]

	connectivity_matrix = np.zeros((32,32))
	for pre, post in edges:
		connectivity_matrix[node_names.index(pre), node_names.index(post)] = -1 if pre.startswith('D7') else 1
	
	np.save(os.path.join(os.path.dirname(__file__), 'connectivity_matrices/connectivity_matrix_locust_simplified'), connectivity_matrix)


if __name__ == "__main__":
	create_fly_simplified_connectivity_matrix()
	create_locust_simplified_connectivity_matrix()