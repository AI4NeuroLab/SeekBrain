# Source: src/Waven/suite2p/utils/utils.py
# Summary: See repo_context.md


import numpy as n
from scipy.ndimage import convolve1d
from scipy.ndimage import gaussian_filter1d
from scipy.interpolate import interp1d

from . import timelinepy as tlu
from . import cortex_lab_utils as clu
from . import twophopy as tpu
from matplotlib import pyplot as plt
import itertools

def load_data(matfile, exclude_planes=(0,), zscore=True, verbose=True):
    """load and prepare data from matlab file

    Args:
        matfile (File): use h5py.File to load in matlab file

        exclude_planes (tuple, optional): Planes to exclude.
        Scanning info is kept but cells are ignored. Use python indices,
        so MATLAB plane 1 (flyback plane) is referred to as plane 0. Defaults to (0,).

        verbose (bool, optional): Verbosity. Defaults to True.
    """

    expt = matfile['expt']

    planes = []
    deconvs = []
    indices = []
    for i in range(expt['cells']['plane'].shape[0]):
        deconv_cell = n.array(expt[expt['cells']['deconv'][i][0]])
        plane_cell = (expt[expt['cells']['plane'][i][0]][0][0])-1
        # ignore cells in plane 1 (flyback plane)
        if plane_cell not in exclude_planes:
            if n.isnan(deconv_cell).sum()==0:
                planes.append(plane_cell)
                deconvs.append(deconv_cell)
                indices.append(i)
            else: 
                if verbose: print("Skipping cell ", i, " due to nans.")
    n_cells = len(planes)
    # The first few planes have 1 extra sample at the end, trim those extras
    n_samples = min([p.shape[0] for p in deconvs])
    for i in range(len(planes)):
        deconvs[i] = deconvs[i][:n_samples]

    # Load the sample times for each plane
    plane_times = []
    for i in range(expt['planeTimes'].shape[0]):
        plane_times.append(n.array(expt[expt[expt['planeTimes'][i][0]][0][0]])[:n_samples])
    n_planes = len(plane_times)


    # Get stimulus information
    blank_ind = (n.array(expt['stimFrames']['blankInd'])).reshape(-1)
    stim_seq = n.array(expt['stimFrames']['imgSeq']).T
    stim_rate = expt['imgRate'][0][0]
    stim_offset = n.array(expt['stimTimes']['offset']).reshape(-1)
    stim_onset = n.array(expt['stimTimes']['onset']).reshape(-1)
    n_trials = stim_onset.shape[0]

    # Send everything to numpy arrays
    cell_traces = n.array(deconvs).reshape(n_cells,n_samples)
    planes = n.array(planes).reshape(n_cells)
    plane_times = n.array(plane_times).reshape(n_planes,n_samples)
    mean_scan_period = n.mean((plane_times[:,1:]  - plane_times[:,:-1]))

    cell_means = cell_traces.mean(axis=1)
    cell_stds = cell_traces.std(axis=1)

    cell_traces_raw = cell_traces.copy()
    if zscore:
        cell_traces = (cell_traces_raw - cell_means.reshape(n_cells,1))/cell_stds.reshape(n_cells,1)

    if verbose: 
        print("Loaded %d cells from %d planes (excluding %d) with %d samples each." \
              % (n_cells, n_planes, len(exclude_planes),n_samples))

    data = {
        'stim_seq': stim_seq,
        'blank_ind': blank_ind,
        'stim_rate': stim_rate,
        'stim_onset': stim_onset,
        'stim_offset': stim_offset,
        'n_trials': n_trials,
        'n_planes': n_planes,
        'planes' : planes,
        'plane_times': plane_times,
        'n_cells': n_cells,
        'cell_traces': cell_traces,
        'cell_traces_raw': cell_traces_raw,
        'cell_means': cell_means,
        'cell_stds': cell_stds,
        'mean_scan_period' : mean_scan_period,
        'n_samples': n_samples,
    }
    return data

def get_stim_response_matrix(data, post_stim_wait_ms=0.085, window_ms = 0.41, verbose=True):
    """Take in the loaded data and return 
    stimulus-aligned activity matrices for each stimulus

    Args:
        data (dict): data loaded from load_data function
        post_stim_wait_ms (float, optional): Number of ms after stimulus
            onset to take the activity of each neuron. Defaults to 0.085.
        window_ms (float, optional): Length of the window after 
            stim_onset + post_stim_wait_ms to take the activity. Defaults to 0.5.
        verbose (bool, optional): Defaults to True.

    Returns:
        stimulus: (n_trials, 2) ndarray identifying the image and contrast. Note the 
            image indices have been changed to 0-indexing, so stim 0 is the matlab file 1.
        response: (n_trials, n_cells, n_samples_in_window) activity of each cell
        earliest_plane_count: (n_planes) number of times each plane is the first sampled
    """
    n_trials = data['n_trials']
    n_cells = data['n_cells']
    n_planes = data['n_planes']
    planes = data['planes']
    plane_times = data['plane_times']
    cell_traces = data['cell_traces']
    stim_seq = data['stim_seq']
    stim_onset = data['stim_onset']
    stim_offset = data['stim_offset']
    # the maximum period between two scans of the same cell
    max_scan_period = n.max((plane_times[:,1:]  - plane_times[:,:-1]))
    mean_scan_period = n.mean((plane_times[:,1:]  - plane_times[:,:-1]))
    # see how many scans we can fit in the time window
    # we want to make sure we take an equal number of samples from each scan
    n_samples_in_window = int(n.floor(window_ms/max_scan_period))

    if verbose: 
        print("Window truncated to %.3fms" % (n_samples_in_window*mean_scan_period))

    stimulus = n.zeros((n_trials, 2),int)
    response = n.zeros((n_trials, n_cells, n_samples_in_window))

    # number of times a given plane is the first plane that is imaged
    earliest_plane_count = n.zeros(n_planes)

    for trial_idx in range(n_trials):
        onset = stim_onset[trial_idx]
        offset = stim_offset[trial_idx]
        stim_idx, contrast = stim_seq[trial_idx]
        stimulus[trial_idx] = (stim_idx-1, contrast-1)

        time_from_stim_onset = (plane_times-onset)
        time_from_stim_onset[time_from_stim_onset<=post_stim_wait_ms] = n.inf
        plane_time_idxs = n.argmin(time_from_stim_onset,axis=1)

        # total_num_cells = 0
        earliest_plane = -1
        earliest_plane_time = n.inf
        for plane_idx in range(len(plane_time_idxs)):
            plane_time_idx = plane_time_idxs[plane_idx]
            cells_in_plane_idxs = planes==plane_idx
            response[trial_idx, cells_in_plane_idxs] = \
                cell_traces[cells_in_plane_idxs,plane_time_idx:plane_time_idx+n_samples_in_window]

            num_cells = response[trial_idx, cells_in_plane_idxs].size
            
            if plane_times[plane_idx,plane_time_idx] < earliest_plane_time:
                earliest_plane = plane_idx
                earliest_plane_time = plane_times[plane_idx,plane_time_idx]
    #         print("For plane ", plane_idx, " we use plane_time ", plane_time_idx)
    #         print("This corresponds to ", plane_times[plane_idx, plane_time_idx], "s. That is "
    #               , time_from_stim_onset[plane_idx, plane_time_idx],"after onset")
    #         print("There are ", num_cells, " cells.")
    #             total_num_cells += num_cells
    #         print("Assgined a total of ", total_num_cells, " cells")
        
        earliest_plane_count[earliest_plane] += 1


    return stimulus, response, earliest_plane_count

from scipy.interpolate import interp1d
def interp_event_responses(ts, spks, events, window = n.arange(-1,2,0.1), interp_kind = 'linear', interp_axis=-1, resp_shape = None, 
                           mean_over_window=False, print_interval=None):
    f_spks = interp1d(ts, spks, bounds_error=False, kind=interp_kind, axis=interp_axis)
    n_cells = spks.shape[0]
    n_events = len(events)
    n_window = len(window)
    if mean_over_window: n_window = 1
    if resp_shape is None: responses = n.zeros((n_events, n_cells, n_window)) * n.nan
    else: responses = n.zeros((n_events,) + resp_shape + (n_window,)) * n.nan
    for idx, event in enumerate(events):
        if print_interval is not None:
            if idx % print_interval == 0: print("%d of %d events " % (idx, len(events)))
        event_window = window + event
        if not mean_over_window:
            responses[idx] = f_spks(event_window)
        else:
            responses[idx] = f_spks(event_window).mean(axis=-1, keepdims=True)
    return responses        


def extract_event_responses(ts, spks, events, window = (-1, 2), remove_nans=False):

    vol_period = n.diff(ts).mean()
    window_len = window[1] - window[0]
    n_responses = int(n.floor(window_len / vol_period))
    ts_resp = n.arange(n_responses) * vol_period + window[0]
    n_events = len(events)

    responses = n.zeros((n_events, spks.shape[0], n_responses)) * n.nan
    # print(n_responses)
    for i,event in enumerate(events): 
        start_idx = n.where(ts > event + window[0])[0]
        if len(start_idx) == 0:
            continue
        start_idx = start_idx[0]
        end_idx = start_idx + n_responses
        if end_idx >= spks.shape[1]: 
            # print("No neural data at time %.04f" % (event + window[1]))
            continue
    
        # print('event: %04.04f, start: %04.04f, end: %04.04f' % (event+window[0], ts[start_idx], ts[end_idx]))
        if ts[start_idx] - (event + window[0]) > vol_period*1.1:
            # print("No neural data at time %.04f" % (event + window[0]))
            continue
        else:
            responses[i] = spks[:, start_idx:end_idx]
        
    return ts_resp, responses

def stimresp_matrix(stimuli, responses, n_responses_per_stim = 2):
    unique_stim = n.unique(stimuli)
    n_unique_stim = len(unique_stim)
    print(n_unique_stim)
    n_cells = responses.shape[1]
    stim_ids = []
    respmat = []
    for idx, stim_id in enumerate(unique_stim):
        idxs = n.where(stimuli == stim_id)[0][:n_responses_per_stim]
        if len(idxs) < n_responses_per_stim:
            print("Stim %d only has %d repeats" % (stim_id, len(idxs)))
            continue
        respmat.append(responses[idxs].T)
        stim_ids.append(stim_id)
    # respmat = respmat[~n.isnan(respmat).mean(axis=(1,2)).astype(bool)]
    return n.array(respmat), stim_id
    


def get_response_per_stim(stimuli, responses, n_responses_per_stim=31,exclude_stimuli=(32,)):
#     for exclude_idx in exclude:
#         responses = responses[stimulus_all[:,0] != exclude_idx]
#         stimulus = stimuli[stimulus_all[:,0] != exclude_idx]

    n_stimulus = (n.unique(stimuli[:,0])).shape[0] - len(exclude_stimuli)
    n_contrast = (n.unique(stimuli[:,1])).shape[0]
    n_cells = responses.shape[1]
    print(n_stimulus, n_contrast)
    mean_responses = n.zeros((n_stimulus,n_contrast, n_cells))
    all_responses = n.zeros((n_stimulus, n_contrast, n_cells, n_responses_per_stim))
    for stim_idx in range(n_stimulus):
        if stim_idx in exclude_stimuli: continue
        for contrast_idx in range(n_contrast):
            idxs = n.where(n.logical_and(stimuli[:,0] == stim_idx, stimuli[:,1]==contrast_idx))
            # print(stim_idx, contrast_idx, idxs)
            all_responses[stim_idx, contrast_idx] = \
                responses[idxs[0][:n_responses_per_stim]].reshape(n_responses_per_stim, n_cells).T

    mean_responses = all_responses.mean(axis=-1)
    #         print("%d reps for stim %d and contrast %d" % (idxs[0].shape[0], stim_idx, contrast_idx))

    return mean_responses, all_responses
def split_test_train(Xs, Ys, train_frac=0.65, seed=23581321):
    n_samples = Xs.shape[0]
    n.random.seed(seed)
    rnd_idx = n.random.choice(n.arange(n_samples), n_samples, False)
    n_train = int(n_samples*train_frac)
    Xs_train = Xs[rnd_idx[:n_train]]
    Ys_train = Ys[rnd_idx[:n_train]]
    Xs_test = Xs[rnd_idx[n_train:]]
    Ys_test = Ys[rnd_idx[n_train:]]
    
    return Xs_train, Ys_train, Xs_test, Ys_test





def unit_vector(vector):
    """ Returns the unit vector of the vector.  """
    return vector / n.linalg.norm(vector)

def angle_unsigned(v1, v2):
    """ Returns the angle in degrees between vectors 'v1' and 'v2'::

            >>> angle_between((1, 0, 0), (0, 1, 0))
            1.5707963267948966
            >>> angle_between((1, 0, 0), (1, 0, 0))
            0.0
            >>> angle_between((1, 0, 0), (-1, 0, 0))
            3.141592653589793
    """
    v1_u = unit_vector(v1)
    v2_u = unit_vector(v2)
    return n.rad2deg(n.arccos(n.clip(n.dot(v1_u, v2_u), -1.0, 1.0)))

def angle(vector1, vector2):
    """ Returns the angle in deg between given vectors"""
    v1_u = unit_vector(vector1)
    v2_u = unit_vector(vector2)
    minor = n.linalg.det(
        n.stack((v1_u[-2:], v2_u[-2:]))
    )
    if minor == 0:
        raise NotImplementedError('Too odd vectors =(')
    return n.rad2deg(n.sign(minor) * n.arccos(n.clip(n.dot(v1_u, v2_u), -1.0, 1.0)))

def zscore(x, ax=0, shift=True, epsilon=0, keepdims=True):
    m = x.mean(axis=int(ax), keepdims=keepdims)
    std = x.std(axis=int(ax), keepdims=keepdims) + epsilon
    if shift: return (x-m)/std
    else: return (x)/std 


def scale_std(data, time_window=None, eps=1e-6):
    '''
    similar to zscore(), creates a variant where each cell is scaled by its stdev

    Args:
        time_window (tuple, optional): time limits where std is computed. Defaults to None.
        eps (flfoat, optional): small number for stability. Defaults to 1e-6.

    Returns:
        TimeSeries: std-scaled variant
    '''

    std = data.std(axis=1, keepdims=True) + eps
    data_std_scaled = data / std

    std_scaled = data_std_scaled
    return std_scaled


def moving_zscore(xs, window=1000):
    nx = len(xs)
    xf = n.copy(xs)
    for i in range(0, nx, window):
        xf[i : i+window] -= xs[i:i+window].mean(axis=0)
        xf[i : i+window] /= xs[i:i+window].std(axis=0)
    return xf

def standardize(x, ax=0, epsilon=0, keepdims=True):
    mn = x.min(axis=int(ax), keepdims=keepdims)
    mx = x.max(axis=int(ax), keepdims=keepdims)
    return (x - mn) / (mx-mn)


def mean_around_diag(mat):
    return mat[mat.shape[0]//2]
    mat = mat.copy()
    for i in range(mat.shape[0]):
        mat[i] = n.roll(mat[i],-i)
    return n.roll(mat.mean(axis=0), mat.shape[0]//2)

def zscore_ndim(x, nax=0, m = None, std=None, return_params=False, auto_reshape=True, undo=False):
    """zscore a given axis of an n-dimensional array based on given or computed parameters.
       If you have an array of shape x,y,z and nax=1, the activity will be average over all 
       x and z, so the mean and std will have shape 1,y,1.

    Args:
        x (ndarray): ndim array
        nax (int, optional): Axis to *not* average over, typically the neuron axis. Defaults to 0.
        m (ndarray, optional): mean. Defaults to computing from x.
        std (ndarray, optional): std. Defaults to computing from x.
        return_params (bool, optional): Return m and std in a tuple. Defaults to False.
        auto_reshape (bool, optional): Automatically fix the shapes of m and std. Defaults to True.
    """
    ndim = len(x.shape)
    # sorry
    nax = n.array(nax).astype(int)
    axes_to_reduce = n.array([i if i not in nax else n.nan for i in range(ndim)])
    axes_to_reduce = tuple(n.array(axes_to_reduce)[~n.isnan(axes_to_reduce)].astype(int))

    if m is None: 
        m = x.mean(axis=axes_to_reduce, keepdims=True)
    if std is None:
        std = x.std(axis=axes_to_reduce, keepdims=True) + 1e-6

    if auto_reshape:
        param_shape = n.ones(ndim).astype(int)
        param_shape[nax] = n.array(x.shape)[nax]

        # if they are a scalar don't reshape
        if n.array(m).size > 1: m = m.reshape(*param_shape)
        if n.array(std).size > 1: std = std.reshape(*param_shape)

    if not undo: xz = (x-m)/std 
    else: xz = (x * std) + m
    if return_params:
        return xz, (m, std)
    else:
        return xz 

def bin_trials(resps, n_trials_per_bin = 5):
    """Average every n trials in an array of trials. Discards leftover (modulo) trials

    Args:
        resps (ndarray): n_trials x (whatever shape)
        n_trials_per_bin (int, optional): Number of trials to average. Defaults to 5.

    Returns:
        binned_resps: floor(n_trials/5) x (whatever shape)
    """
    n_trials = resps.shape[0]
    n_bins = int(n.floor(n_trials/n_trials_per_bin))
    binned_resps = n.zeros((n_bins,) + resps.shape[1:])
    for i in range(n_bins):
        binned_resps[i] = resps[i*n_trials_per_bin:(i+1)*n_trials_per_bin].mean(axis=0)
    return binned_resps

def old_moving_average(x, n_window, axis=0):
    conv_window = n.ones(n_window)/n_window
    conv_window = n.ones(n_window)/n_window
    cv = convolve1d(x, conv_window,mode='reflect', axis=axis)
    return cv

def moving_average(x, width=3, causal=True, axis=0, mode='nearest'):
    if width==1: 
        return x
    kernel = n.ones(width*2-1)
    if causal:
        kernel[:int(n.ceil(width/2))] = 0
    kernel /= kernel.sum()
    return convolve1d(x, kernel, axis=axis, mode=mode)


def bin_by_filter(filtvals, vals, bins=None):
    n_bins = len(bins) - 1
    pass
    # for i in range(n_bins):

ragged_avg = n.vectorize(n.mean)
ragged_std = n.vectorize(n.std)

def bin_by_coord_2d(cs_y, cs_x, vals, bins):
    bins_y, bins_x = bins
    n_bins_y = len(bins_y) - 1; n_bins_x = len(bins_x) -1



def bin_by_coord(coords, vals, n_bins = 10, bins=None):
    if bins is None:
        if n_bins is None:
            n_bins = len(n.unique(coords))
        bmin, bmax = coords.min(), coords.max()
        bins = n.linspace(bmin, bmax, n_bins)
    else:
        n_bins = len(bins)
    coords_argsort = n.argsort(coords)
    coords_sorted = coords[coords_argsort]

    binned = [[] for i in range(n_bins)]
    bin_idx = 0
    for i in range(len(coords_argsort)):
        if bin_idx < n_bins-1 and coords_sorted[i] > bins[bin_idx + 1]:
            bin_idx += 1
        binned[bin_idx].append(vals[coords_argsort[i]])
    for i in range(n_bins):
        binned[i] = n.array(binned[i])
    return bins, binned



def to_rgb(frame, bw = None, bits = 8):
    if bw is None:
        bw = (frame.min(), frame.max())
    rng = bw[1] - bw[0]
    frame_new = (frame - bw[0]) / rng
    frame_new[frame_new < 0] = 0
    frame_new[frame_new > 1] = 1
    
    frame_new *= (2**bits - 1)
    
    frame_rgb = n.stack([frame_new]*3, axis=-1).astype(n.uint8)
    
    return frame_rgb

def filt(signal, width = 3, axis=0, mode='gaussian'):
    if width == 0:
        return signal

    if mode == 'gaussian':
        out = gaussian_filter1d(signal, sigma=width, axis=axis)
    else:
        assert False, "mode not implemented"
    return out


def split_sets(xs, ys, ratios = (0.7,0.2,0.1), seed = None, more_ys = []):
    '''
    Split samples from xs and ys into randomly shuffled sets

    Args:
        xs (ndarray): first dimension is number of samples
        ys (ndarray): first dimension is number of samples
        ratios (tuple, optional): Must sum to 1, size of each random set. Defaults to (0.7,0.2,0.1).
        seed (int, optional): Random seed. Defaults to None.

    Returns:
        x_sets, y_sets : lists, each item corresponds to a set specified in ratios
    '''
    n_samples = xs.shape[0]
    n_sets = len(ratios)
    assert ys.shape[0] == n_samples
    if seed is not None: n.random.seed(seed)
    assert n.isclose(n.sum(ratios), 1)
    order = n.random.permutation(n.arange(n_samples))
    set_lens = []
    
    for set_idx in range(n_sets - 1):
        ratio = ratios[set_idx]
        set_lens.append(int(ratio * n_samples))
    set_lens.append(n_samples - n.sum(set_lens))
    
    n_more_ys = len(more_ys) 
    more_y_sets = []
    for i in range(n_more_ys): more_y_sets.append([])
    x_sets = []; y_sets = [];
    idx = 0
    for i in range(n_sets):
        end_idx = idx + set_lens[i]
        x_sets.append(xs[idx:end_idx])
        y_sets.append(ys[idx:end_idx])
        for j in range(n_more_ys):
            more_y_sets[j].append(more_ys[j][idx:end_idx])
        idx = end_idx
    if n_more_ys > 0:
        return x_sets, y_sets, more_y_sets
    return x_sets, y_sets

def load_timeline_info(subject, date, exp_idx, dirs=None, load_vs=True, 
                       v_filt_sec=1, interp_vs=True, frame_counts=None):
    exp_info = (subject, date, exp_idx)
    tlfile = clu.find_expt_file(exp_info, 'timeline', dirs)
    tl = tlu.load_timeline(tlfile)
    sample_times = tlu.sample_times(tl)
    sample_hz = 1/n.mean(n.diff(sample_times))
    neural_frames = tlu.get_samples(tl, ['neuralFrames']).flatten()
    frame_times = tpu.get_frame_times(tl, frames=neural_frames)
    dframe_times = n.diff(frame_times)
    bad_idxs = n.where(dframe_times < (0.75 * n.median(dframe_times)))
    issue=False
    if len(bad_idxs[0]) > 0: 
        issue=True
        print("You have a problem!")
    bad_idxs = n.where(dframe_times > (1.25 * n.median(dframe_times)))
    if len(bad_idxs[0]) > 0: 
        issue=True
        print("You have a problem!")

    if issue:
        print("Attempting to fix mid-acq crash - double check if not of AH009-0404-1")
        frame_times = fix_mid_acquisition_crash(frame_counts, exp_idx, frame_times)
    end_idx = len(frame_times)

    sync_led_raw = tlu.get_samples(tl, ['cameraSyncLED'])[:,0]
    if load_vs:
        rotary = tlu.get_samples(tl, ['rotaryEncoder']).flatten()
        drotary = n.diff(rotary)
        if drotary.max() > 1e6:
            print("Setting %d rotary timepoints to zero" % (n.abs(drotary) > 1e6).sum())
            drotary[n.abs(drotary) > 1e6] = 0
        drotary = n.concatenate([drotary, [0]])
        filt_width = v_filt_sec * sample_hz
        vs = filt(drotary, filt_width)
        if interp_vs:
            vs = interp1d(sample_times, vs)(frame_times)
        
        return sample_times, frame_times, vs, sync_led_raw

    return sample_times, frame_times, sync_led_raw


# use for AH009 - 2022-04-04 - 01
# this is when there was a crash in the acq computer during an experiment
# frame counter continued incrementing while no frames were actually acquired
def fix_mid_acquisition_crash(frame_counts, job_idx, frame_ts, diag_plot=False):
    
    jobids = frame_counts['jobids']
    nframes = frame_counts['nframes'][jobids==job_idx]
    crash_file_idx = n.where(nframes != 100)[0][0]
    crash_frame_idx = n.sum(nframes[:crash_file_idx+1])
    print("File %d has %d frames, this is where the crash happened. %d frames acquired before crash" \
                % (crash_file_idx, nframes[crash_file_idx], crash_frame_idx))
    post_crash_resume_frame_idx = n.argmax(n.diff(frame_ts)) + 1
    print("Timeline frame %d at %.2f, frame %d at %.2f" % \
        (post_crash_resume_frame_idx-1, frame_ts[post_crash_resume_frame_idx-1],post_crash_resume_frame_idx, frame_ts[post_crash_resume_frame_idx]))
    print("%d frames from timeline lost. Matching post-crash timeline frame %d with tif frame %d" \
          % (post_crash_resume_frame_idx - crash_frame_idx, post_crash_resume_frame_idx, crash_frame_idx))

    new_frame_ts = n.concatenate([frame_ts[:crash_frame_idx], frame_ts[post_crash_resume_frame_idx:]])


    if diag_plot:
        tot_frames = nframes.sum()
        frame_idxs = n.concatenate([n.arange(x) for x in nframes])
        plt.plot(frame_idxs, label='frame idx in tif file')
        plt.plot(n.diff(new_frame_ts), label='time until next frame (s)')
        plt.xlim(crash_frame_idx-50, crash_frame_idx + 50)
        plt.legend()

    return new_frame_ts

def get_cells(outputs, iscell_tag='iscell_curated_slider', filter_spks = True):
    coords = [stat['coords'] for i,stat in enumerate(outputs['stats']) if outputs[iscell_tag][i,0] ]
    lams = [stat['lam'] for i,stat in enumerate(outputs['stats']) if outputs[iscell_tag][i,0] ]
    nz,ny,nx = outputs['vmap'].shape; shape = nz,ny,nx
    if filter_spks: full_spks = outputs['spks'][outputs[iscell_tag][:,0].astype(bool)]
    else: full_spks = outputs['spks']
    meds = n.array([n.median(stat['coords'],axis=1) for stat in outputs['stats']])
    meds = meds[outputs[iscell_tag][:,0].astype(bool)]
    return full_spks, meds, coords, lams

def get_exp_data(job, full_spks,exp_idx, v_filt_sec = 0.25, v_abs=True):
    exp_tidxs = job.get_exp_frame_idxs(exp_idx)
    spks = full_spks[:,exp_tidxs[0]:exp_tidxs[1]]
    exp_info = (job.params['subject'], job.params['date'], exp_idx)
    tl_ts, frame_ts, vs, sync_led_raw = load_timeline_info(*exp_info, dirs=['D:\\ExpData\\Subjects'], v_filt_sec=v_filt_sec, frame_counts=job.load_frame_counts())
    if v_abs: vs = n.abs(vs)
    n_frames = min(len(frame_ts), spks.shape[1])
    print(n_frames)
    spks = spks[:,:n_frames]; 
    frame_ts = frame_ts[:n_frames]; nc, nt = spks.shape
    exp_tidxs = (exp_tidxs[0], min(exp_tidxs[1], exp_tidxs[0] + n_frames))
    return frame_ts, spks, vs[:n_frames], tl_ts, sync_led_raw, exp_tidxs

def sweep_params(func, sweep_def, other_args = {}, verbose=False, run=False):
    param_per_run = {}
    n_per_param = []
    param_names = []
    param_vals_list = []
    for k in sweep_def.keys():
        param_names.append(k)
        n_per_param.append(len(sweep_def[k]))
        param_vals_list.append(sweep_def[k])
        param_per_run[k] = []
    n_combs = n.product(n_per_param)
    combinations = n.array(list(itertools.product(*param_vals_list)))
    kv_combinations = [ {param_names[i] : combination[i] for i in range(len(combination))} \
                       for combination in combinations]
    
    sweep_info = {
        'param_dict' : sweep_def,
        'param_names' : param_names,
        'combinations' : combinations,
        'kv_combinations' : kv_combinations,
    }
    outputs = []
    for kv_comb in kv_combinations:
        if verbose: print(kv_comb)
        if run: outputs.append(func(**kv_comb, **other_args))
    return sweep_info, outputs

def collate_sweep_results(outputs, sweep_info):
    n_outputs = len(outputs[-1])
    param_dict = sweep_info['param_dict']
    param_names = sweep_info['param_names']
    kv_combinations = sweep_info['kv_combinations']
    n_val_per_param = [len(param_dict[k]) for k in param_names]
    output_arrays = [n.zeros(tuple(n_val_per_param) + n.array(output).shape) for output in outputs[0]]
    for cidx, kv_comb in enumerate(kv_combinations):
        param_idxs = [n.where(param_dict[pname] == kv_comb[pname])[0][0] for pname in param_names]
        for output_idx in range(n_outputs):
            output_arrays[output_idx][tuple(param_idxs)] = outputs[cidx][output_idx]
    return output_arrays

