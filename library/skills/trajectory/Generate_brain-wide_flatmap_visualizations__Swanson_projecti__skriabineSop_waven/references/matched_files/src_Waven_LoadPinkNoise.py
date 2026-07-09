# Source: src/Waven/LoadPinkNoise.py
# Summary: See repo_context.md

"""
Created on Wed Mar 25 19:31:32 2025

@author: Sophie Skriabine
"""
import os

import matplotlib
if os.environ.get("WAVEN_NO_PLOTS") == "1":
    matplotlib.use("Agg", force=True)
else:
    matplotlib.use("TkAgg", force=True)

import numpy as np
from .suite2p.utils import cortex_lab_utils as clu
from .suite2p.utils import timelinepy as tlu

from .suite2p.utils import utils as utils

from skimage import transform

import gc

from torch.utils.data import DataLoader
from torch.utils.data import TensorDataset
from .Analysis_Utils import *


def load_wavelets(pathdir, nx, ny, wavelets_r, wavelets_i, direction=False):
    w_r = wavelets_r.reshape((-1, ny, nx, 3, 9))
    w_i = wavelets_i.reshape((-1, ny, nx, 3, 9))
    cos = np.clip(w_r, a_min=0, a_max=None)
    cos_m = np.clip(-w_r, a_min=0, a_max=None)
    sin = np.clip(w_i, a_min=0, a_max=None)
    sin_m = np.clip(-w_i, a_min=0, a_max=None)
    sigma = 1
    pn_wavelets = cos + cos_m + sin + sin_m
    pn_wavelets = pn_wavelets.reshape((-1, ny, nx, 27))
    pn_wavelets = np.array(
        [pn_wavelets[i] / (sigma + np.sum(pn_wavelets[i], axis=0)) for i in range(pn_wavelets.shape[0])])
    pn_wavelets = np.reshape(pn_wavelets, (-1,  ny, nx, 3, 9))
    print(pn_wavelets.shape)
    del cos, cos_m, sin, sin_m, w_r, w_i
    gc.collect()

    if direction:
        sh=np.array(wavelets_i.shape)
        sh[0]=sh[0]+1
        phase = np.insert(np.arctan(wavelets_i / wavelets_r), [0],  np.zeros((ny, nx, 3, 9)), 0).reshape(sh)
        phase_diff = np.diff(phase, axis=0)
        # print(phase_diff.shape)
        # pn_wavelets_fwd=pn_wavelets * np.clip(phase_diff, 0, None)
        # pn_wavelets_bckwd = pn_wavelets * np.clip(-phase_diff, 0, None)
        # print(pn_wavelets_fwd.shape)
        # return pn_wavelets, pn_wavelets_fwd, pn_wavelets_bckwd
        return pn_wavelets, phase_diff
    # pn_wavelets = skimage.transform.resize(pn_wavelets, (pn_wavelets.shape[0], 8, 30, 3, 9))
    else:
        return pn_wavelets


def load_stimulus(pathdir, wavelets_r, wavelets_i, nx=161, ny=60):
    wavelets_r = np.load(pathdir + '/cwt_pn_real_1_9000.npy')
    wavelets_i = np.load(pathdir + '/cwt_pn_imag_1_9000.npy')
    ## load wavelets
    scale = 2
    direct = True
    if not direct:
        wavelets = load_wavelets(pathdir, nx, ny, direction=direct)
        wavelets = wavelets[:, :, :, scale, :]  # only select the higheest scale
        wavelets = skimage.transform.resize(wavelets, (wavelets.shape[0], 8, 20, 9))
        wavelets = wavelets.reshape((wavelets.shape[0], wavelets.shape[1] * wavelets.shape[2] * wavelets.shape[3]))
    elif direct:
        w_r = skimage.transform.resize(wavelets_r.reshape((-1, ny, nx, 3, 9)), (wavelets_r.shape[0], 8, 20, 3, 9))
        w_i = skimage.transform.resize(wavelets_i.reshape((-1, ny, nx, 3, 9)), (wavelets_i.shape[0], 8, 20, 3, 9))
        phase = np.arctan(w_i / w_r)
        phase_diff = np.diff(phase, axis=0)
        cos = np.clip(w_r, a_min=0, a_max=None)
        cos_m = np.clip(-w_r, a_min=0, a_max=None)
        del w_r

        sin = np.clip(w_i, a_min=0, a_max=None)
        sin_m = np.clip(-w_i, a_min=0, a_max=None)
        del w_i

        sigma = 1
        # pn_wavelets = (np.cos(phi)*cos) + (np.cos(phi)* cos_m) + (np.sin(phi)*sin) + (np.sin(phi)*sin_m)
        pn_wavelets = cos + cos_m + sin + sin_m
        pn_wavelets_fwd = pn_wavelets * np.insert(np.clip(phase_diff, 0, None), [0], np.zeros((8, 20, 3, 9)),
                                                  0).reshape(9000, 8, 20, 3, 9)
        pn_wavelets_bkwd = pn_wavelets * np.insert(np.clip(-phase_diff, 0, None), [0], np.zeros((8, 20, 3, 9)),
                                                   0).reshape(9000, 8, 20, 3, 9)
        wavelets = np.stack([pn_wavelets, pn_wavelets_fwd, pn_wavelets_bkwd], axis=5)
        del pn_wavelets_bkwd, pn_wavelets_fwd, wavelets_r, wavelets_i
        gc.collect()

    wavelets = wavelets[:, :, :, scale, :, :]
    w = wavelets.reshape((9000, 8, 20, 9, 3))
    plt.figure()
    plt.plot(w[:, 5, 14, 4, 0])
    plt.plot(w[:, 5, 14, 4, 1])
    plt.plot(w[:, 5, 14, 4, 2])

    wavelets = wavelets.reshape(
        (wavelets.shape[0], wavelets.shape[1] * wavelets.shape[2] * wavelets.shape[3] * wavelets.shape[4]))
    return wavelets

def load_stimulus_simple_cell(path='/media/sophie/Expansion1/UCL/datatest/',nx=27, ny=11, no=8,ns=6, nf=1, downsampling=False):
    #wavelets_r=np.load(path+'dwt_videodata_r.npy')
    #wavelets_i = np.load(path+'dwt_videodata_i.npy')
    wavelets_r=np.load(os.path.join(path, 'dwt_videodata_0.npy')) 
    wavelets_i = np.load(os.path.join(path, 'dwt_videodata_1.npy')) 
    print(wavelets_r.shape)
    if downsampling:
        wavelets_r = skimage.transform.resize(wavelets_r, (wavelets_r.shape[0], nx, ny, no, ns, nf), anti_aliasing=True)
        wavelets_r=np.swapaxes(wavelets_r, 2,1)

        wavelets_i = skimage.transform.resize(wavelets_i, (wavelets_i.shape[0], nx, ny, no, ns, nf), anti_aliasing=True)
        wavelets_i=np.swapaxes(wavelets_i, 2,1)

    return wavelets_r,wavelets_i




def load_stimulus_simple_cell2_i(path='/media/sophie/Expansion1/UCL/datatest/', tt=[0,9000], downsampling=False):


    wavelets_i = np.load(path+'dwt_videodata2_i.npy')[tt[0]:tt[1]]#,  mmap_mode='c')
    if downsampling:
        # wavelets_i = skimage.transform.resize(abs(wavelets_i), (9000, 20, 8, 8, 3), anti_aliasing=True)
        # wavelets_i=np.swapaxes(wavelets_i, 2,1)
        wavelets_i = skimage.transform.resize(wavelets_i[:, :, :, :, 2, :], (9000, 27, 11, 8, 4), anti_aliasing=True)
        # w_i = np.swapaxes(w_i, 2, 1)

    return wavelets_i


def load_stimulus_simple_cell2_r(path='/media/sophie/Expansion1/UCL/datatest/',tt=[0,9000], downsampling=False):
    wavelets_r=np.load(path+'dwt_videodata2_r.npy')[tt[0]:tt[1]]#, mmap_mode='c')
    W_R=[]
    if downsampling:
        # for i in range(wavelets_r.shape[-1]):
        #     print(i)
        wavelets_r = skimage.transform.resize(wavelets_r[:, :, :, :, 2, :], (tt, 27, 11, 8, 4), anti_aliasing=True)
        # w_r = np.swapaxes(w_r, 2, 1)
    # wavelets_r=wavelets_r


    return wavelets_r

def load_stimulus_simple_cell2(path='/media/sophie/Expansion1/UCL/datatest/', tt=[0, 9000], downsampling=False):
    w_i=load_stimulus_simple_cell2_i(path, tt, downsampling)
    w_r = load_stimulus_simple_cell2_r(path, tt, downsampling)
    return w_r, w_i

def loadExperiment(dirs, exp_info, pathdir,block_end, n_planes, n_repeat=6,n_frames=9000):
    exp_path = clu.find_expt_file(exp_info, 'root', dirs=dirs)
    exp_path=exp_info[0]+'/'+exp_info[1]
    tlfile = clu.find_expt_file(exp_info, 'timeline', dirs)
    tl = tlu.load_timeline(tlfile)

    # frame_times = tpu.get_frame_times(tl)
    input_ind = 'neuralFrames' == tlu.get_input_names(tl)
    tp = tl['rawDAQData'][:, input_ind].flatten()
    ind = np.diff(tp, prepend=tp[0]) > 0
    frame_times = tl['rawDAQTimestamps'][ind]
    frame_times=frame_times[:frame_times.shape[0]-(frame_times.shape[0]%n_planes)]#make it dividable by n_plane
    frame_times=frame_times.reshape((-1, n_planes))
    # frame_times=np.mean(frame_times, axis=1)

    neuron_pos = np.concatenate([np.asarray([sta['med'] for sta in np.load(
        dirs[0] + exp_path + '/suite2p/plane%d/stat.npy' % plane,
        allow_pickle=True)[np.load(
        dirs[0] + exp_path + '/suite2p/plane%d/iscell.npy' % plane)[:,
                           0].astype(bool)]]) for plane in range(n_planes)])

    n_cell = neuron_pos.shape[0]

    Nb_frames = n_frames * n_repeat
    verbose = False

    input_ind = 'photoDiode' == tlu.get_input_names(tl)
    syncEcho_thresh = 1.8
    esynv = tl['rawDAQData'][:, input_ind].flatten() > syncEcho_thresh
    syncEcho_flip = np.asarray(np.logical_or(
        np.logical_and(np.logical_not(esynv[:-1]), esynv[1:]),
        np.logical_and(np.logical_not(esynv[1:]), esynv[:-1])
    )).nonzero()[0]
    syncEcho_flip_times = tl['rawDAQTimestamps'][syncEcho_flip]
    print('syncEcho_flip_times: ', syncEcho_flip_times.shape)


    plt.figure()
    input_ind = 'photoDiode' == tlu.get_input_names(tl)
    plt.plot(tl['rawDAQData'][:, input_ind].flatten())
    # input_ind = 'syncEcho' == tlu.get_input_names(tl)
    # plt.plot(tl['rawDAQData'][:, input_ind].flatten())
    plt.twiny()
    plt.scatter(frame_times[:, 0], np.ones((frame_times.shape[0])), c='r')
    # plt.scatter(time_trial1[:, 1], np.ones((time_trial1.shape[0])), c='k')

    R=[]
    for plane in range(n_planes):
        print('plane :', plane)
        F = np.load(dirs[0]+exp_path+'/suite2p/plane%d/F.npy' % plane)[:, block_end:][np.load(dirs[0] + exp_path + '/suite2p/plane%d/iscell.npy' % plane)[:,0].astype(bool)]
        Fneu = np.load(dirs[0] + exp_path + '/suite2p/plane%d/Fneu.npy' % plane)[:, block_end:][
                                   np.load(
                                       dirs[0]+exp_path+'/suite2p/plane%d/iscell.npy' % plane)[
                                   :, 0].astype(bool)]

        spks = F - (0.7 * Fneu)




        # f=frame_times[:, plane]
        # starttrial = f[f >= syncEcho_flip_times[0]]
        #
        # trial1 = np.logical_and(f >= syncEcho_flip_times[0], f < syncEcho_flip_times[Nb_frames])
        # time_trial1 = f[trial1]
        #
        # trial2 = np.logical_and(f >= syncEcho_flip_times[Nb_frames],
        #                         f < syncEcho_flip_times[Nb_frames * 2])
        # time_trial2 = f[trial2]
        #
        # trial3 = np.logical_and(f >= syncEcho_flip_times[Nb_frames * 2],
        #                         f < syncEcho_flip_times[Nb_frames * 3])
        # time_trial3 = f[trial3]
        #
        # trial4 = np.logical_and(f >= syncEcho_flip_times[Nb_frames * 3],
        #                         f < syncEcho_flip_times[Nb_frames * 4])
        # time_trial4 = f[trial4]
        #
        # trial5 = np.logical_and(f >= syncEcho_flip_times[Nb_frames * 4],
        #                         f < syncEcho_flip_times[Nb_frames * 5])
        # time_trial5 = f[trial5]


        # trials = [trial1, trial2, trial3, trial4, trial5]
        # time_trials = [time_trial1, time_trial2, time_trial3, time_trial4, time_trial5]
        window = [1.15]
        # avg_spks=np.mean(np.array([spks[:,np.asarray(trial!=0).nonzero()[0]].tolist()[0] for trial in trials]), axis=0)
        resps_all = []
        # for i, trial in enumerate(trials):
        spks_rt_noz = spks[:, :frame_times.shape[0]]
        spks_rt = utils.zscore(spks_rt_noz, ax=1, epsilon=1e-5)
        spks_rt = np.array([spks_rt[:, i] - np.min(spks_rt, axis=1) for i in range(spks_rt.shape[1])]).T
        # print(i)
        # print(np.sum(trial), len(time_trials[i]), spks_rt.shape)
        # resps_all.append([utils.interp_event_responses(frame_times, spks_rt,
        #                                                events=syncEcho_flip_times[Nb_frames * i:Nb_frames * (i + 1)],
        #                                                window=window, mean_over_window=False, print_interval=None)])
        try:
            resps_all = utils.interp_event_responses(frame_times[:, plane], spks_rt, events=syncEcho_flip_times,
                                                 window=window,
                                                 mean_over_window=False, print_interval=None)
        except:
            resps_all = utils.interp_event_responses(frame_times[:spks_rt.shape[1], plane], spks_rt, events=syncEcho_flip_times,
                                                     window=window,
                                                     mean_over_window=False, print_interval=None)
        print(np.array(resps_all).shape)
        if plane==0:
            R= np.array(resps_all)
        else:
            R=np.concatenate((R, np.array(resps_all)), axis=1)

    plt.figure()
    plt.scatter(syncEcho_flip_times, np.ones(syncEcho_flip_times.shape[0]))
    plt.scatter(syncEcho_flip_times, resps_all[:, 0], c='g')

    resps_all = np.nan_to_num(R)
    # resps_all = resps_all[:, 0, :, :, 0]

    return resps_all, neuron_pos, syncEcho_flip_times


def align_rotary_encoder(exp_info, dirs,spks, Nb_frames, nb_plane=1, plane=-1, w=0.0, threshold=1.25, methods='frame2ttl'):
    tlfile = clu.find_expt_file(exp_info, 'timeline', dirs)
    tl = tlu.load_timeline(tlfile)

    # frame_times = tpu.get_frame_times(tl)
    rotary_encoder_ind='rotary_encoder'==tlu.get_input_names(tl)

    try:
        input_ind = 'neuralFrames' == tlu.get_input_names(tl)
        # print(input_ind)
        tp = tl['rawDAQData'][:, input_ind].flatten()
        ind = np.diff(tp, prepend=tp[0]) > 0
        frame_times = tl['rawDAQTimestamps'][ind]

        input_ind = 'photoDiode' == tlu.get_input_names(tl)
        syncEcho_thresh = 1.5
    except:
        if methods == 'photosensor':
            syncEcho_thresh = threshold  # 1.25

        elif methods == 'frame2ttl':
            syncEcho_thresh = threshold
        else:
            print('unknown timeline variable')

        print(methods, syncEcho_thresh)
        input_ind = 'neural_frames' == tlu.get_input_names(tl)
        # print(input_ind)
        tp = tl['rawDAQData'][:, input_ind].flatten()
        ind = np.diff(tp, prepend=tp[0]) > 0
        frame_times = tl['rawDAQTimestamps'][ind]

        input_ind = methods == tlu.get_input_names(tl)

    esynv = tl['rawDAQData'][:, input_ind].flatten() > syncEcho_thresh
    syncEcho_flip = np.asarray(np.logical_or(
        np.logical_and(np.logical_not(esynv[:-1]), esynv[1:]),
        np.logical_and(np.logical_not(esynv[1:]), esynv[:-1])
    )).nonzero()[0]
    syncEcho_flip_times = tl['rawDAQTimestamps'][syncEcho_flip]
    print('syncEcho_flip_times: ', syncEcho_flip_times.shape)
    rotary_encoder_vals = np.clip(np.diff(tl['rawDAQData'][:, rotary_encoder_ind].flatten()), -10, 10)[syncEcho_flip]
    return rotary_encoder_vals

def align_datas(exp_info, dirs,spks, Nb_frames, nb_plane=1, plane=-1, w=0.0, threshold=1.25, methods='frame2ttl', exptype='zebra', plotting=False):
    tlfile = clu.find_expt_file(exp_info, 'timeline', dirs)
    tl = tlu.load_timeline(tlfile)

    # frame_times = tpu.get_frame_times(tl)
    try:
        input_ind = 'neuralFrames' == tlu.get_input_names(tl)
        # print(input_ind)
        tp = tl['rawDAQData'][:, input_ind].flatten()
        ind = np.diff(tp, prepend=tp[0]) > 0
        frame_times = tl['rawDAQTimestamps'][ind]

        input_ind = 'photoDiode' == tlu.get_input_names(tl)
        syncEcho_thresh = 1.5
    except:
        if methods=='photosensor':
            syncEcho_thresh = threshold#1.25

        elif methods=='frame2ttl':
            syncEcho_thresh = threshold
        else:
            print('unknown timeline variable')

        print(methods, syncEcho_thresh)
        input_ind = 'neural_frames' == tlu.get_input_names(tl)
        # print(input_ind)
        tp = tl['rawDAQData'][:, input_ind].flatten()
        ind = np.diff(tp, prepend=tp[0]) > 0
        frame_times = tl['rawDAQTimestamps'][ind]

        input_ind = methods == tlu.get_input_names(tl)

    # syncEcho_thresh=threshold
    print(methods, syncEcho_thresh)
    esynv = tl['rawDAQData'][:, input_ind].flatten() > syncEcho_thresh

    syncEcho_flip = np.asarray(np.logical_or(
        np.logical_and(np.logical_not(esynv[:-1]), esynv[1:]),
        np.logical_and(np.logical_not(esynv[1:]), esynv[:-1])
    )).nonzero()[0]
    if exptype != 'zebra':#'gratings':
        print('only up flips are considered')
        syncEcho_flip = np.asarray(
            np.logical_and(np.logical_not(esynv[1:]), esynv[:-1])
        ).nonzero()[0]
    syncEcho_flip_times = tl['rawDAQTimestamps'][syncEcho_flip]
    print('syncEcho_flip_times: ', syncEcho_flip_times.shape)

    if plotting:
        plt.figure()
        plt.plot(tl['rawDAQData'][:, input_ind].flatten())
        plt.scatter(syncEcho_flip,np.ones(syncEcho_flip_times.shape[0]), c='k')

    if nb_plane!=1:
        print('multiple planes')
        frame_times=frame_times[(frame_times.shape[0]%nb_plane):].reshape(-1, nb_plane)
        print(frame_times.shape)
        # frame_times=frame_times[:, :-1]
        if plane==-1:
            frame_times=np.mean(frame_times, axis=1)
        else:
            frame_times = frame_times[:, plane]
        print(frame_times.shape)

    starttrial = frame_times[frame_times >= syncEcho_flip_times[0]]
    # Nb_frames = 9000
    trials=[]
    time_trials=[]
    tt=True
    t=1
    while tt:
        try:
            if t==1:
                print('trial', t)
                trial1 = np.logical_and(frame_times >= syncEcho_flip_times[0], frame_times < syncEcho_flip_times[Nb_frames*t])
                time_trial1 = frame_times[trial1]
                t=t+1
                print(trial1.shape)
            else:
                print('trial', t)
                trial1 = np.logical_and(frame_times >= syncEcho_flip_times[Nb_frames*(t-1)],
                                        frame_times < syncEcho_flip_times[Nb_frames * t])
                time_trial1 = frame_times[trial1]
                t = t + 1
            trials.append(trial1)
            time_trials.append(time_trial1)

        except:
            print('incomplete trial')
            tt=False
            trial1=np.zeros(trials[0].shape)
            temp=np.logical_and(frame_times >= syncEcho_flip_times[Nb_frames*(t-1)],
                                        frame_times < syncEcho_flip_times[np.minimum(Nb_frames * t, syncEcho_flip_times.shape[0]-1)])
            trial1[:temp.shape[0]] = temp
            trial1=trial1.astype(bool)
            time_trial1 = frame_times[trial1]

            if time_trial1.shape!=(0,):
                trials.append(trial1)
                time_trials.append(time_trial1)



    # print('trial1')
    # trial1 = np.logical_and(frame_times >= syncEcho_flip_times[0], frame_times < syncEcho_flip_times[Nb_frames])
    # time_trial1 = frame_times[trial1]
    #
    # print('trial2')
    # trial2 = np.logical_and(frame_times >= syncEcho_flip_times[Nb_frames],
    #                         frame_times < syncEcho_flip_times[Nb_frames * 2])
    # time_trial2 = frame_times[trial2]
    # print('trial3')
    # trial3 = np.logical_and(frame_times >= syncEcho_flip_times[Nb_frames * 2],
    #                         frame_times < syncEcho_flip_times[Nb_frames * 3])
    # time_trial3 = frame_times[trial3]
    # print('trial4')
    # trial4 = np.logical_and(frame_times >= syncEcho_flip_times[Nb_frames * 3],
    #                         frame_times < syncEcho_flip_times[Nb_frames * 4])
    # time_trial4 = frame_times[trial4]
    #
    # trial5 = np.logical_and(frame_times >= syncEcho_flip_times[Nb_frames * 4],
    #                         frame_times < syncEcho_flip_times[Nb_frames * 5])
    # time_trial5 = frame_times[trial5]

    # trial6 = np.logical_and(frame_times >= syncEcho_flip_times[Nb_frames * 5],
    #                         frame_times < syncEcho_flip_times[Nb_frames * 7])
    # time_trial6 = frame_times[trial6]

    # trials = [trial1, trial2, trial3, trial4, trial5]
    # time_trials = [time_trial1, time_trial2, time_trial3, time_trial4, time_trial5]
    window = [w]
    # avg_spks=np.mean(np.array([spks[:,np.asarray(trial!=0).nonzero()[0]].tolist()[0] for trial in trials]), axis=0)
    resps_all = []
    resps_all_raw=[]
    if plotting:
        plt.figure()
    for i, trial in enumerate(trials):
        print(i, trial.shape, spks.shape, np.max(np.asarray(trial != 0).nonzero()[0]))

        if exptype=='zebra' or exptype=='sparse':
            try:
                spks_rt = utils.zscore(spks[:, np.asarray(trial != 0).nonzero()[0]], ax=1, epsilon=1e-5)
                spks_rt = np.array([spks_rt[:, i] - np.min(spks_rt, axis=1) for i in range(spks_rt.shape[1])]).T
                if plotting:
                    plt.plot(spks_rt[200, :])
                print(np.sum(trial), len(time_trials[i]), spks_rt.shape)
                temp = np.zeros((Nb_frames, spks.shape[0], 1))
                print('exptype : ', exptype)
                temp1 = utils.interp_event_responses(time_trials[i], spks_rt,
                                                     events=syncEcho_flip_times[Nb_frames * i:Nb_frames * (i + 1)],
                                                     window=window, mean_over_window=False, print_interval=None)
            except:
                print('warning: spks too short ?')
                print(spks.shape, np.max(np.asarray(trial != 0).nonzero()[0]))
                spks_t=np.zeros((spks.shape[0], 1+np.max(np.asarray(trial != 0).nonzero()[0])))
                spks_t[:, :spks.shape[1]]=spks
                spks_rt = utils.zscore(spks_t[:, np.asarray(trial != 0).nonzero()[0]], ax=1, epsilon=1e-5)

                spks_rt = np.array([spks_rt[:, i] - np.min(spks_rt, axis=1) for i in range(spks_rt.shape[1])]).T
                if plotting:
                    plt.plot(spks_rt[200, :])
                print(np.sum(trial), len(time_trials[i]), spks_rt.shape)
                temp = np.zeros((Nb_frames, spks.shape[0], 1))
                print('exptype : ', exptype)
                temp1=utils.interp_event_responses(time_trials[i], spks_rt,
                                                               events=syncEcho_flip_times[Nb_frames * i:Nb_frames * (i + 1)],
                                                               window=window, mean_over_window=False, print_interval=None)
        elif exptype=='gratings':
            window = (0, 2)
            window_ts = np.arange(window[0], window[1], 0.033)

            # spks_rt = utils.zscore(spks[:, np.asarray(trial != 0).nonzero()[0]], ax=1, epsilon=1e-5)
            spks_rt = utils.scale_std(spks[:, np.asarray(trial != 0).nonzero()[0]])

            resps = utils.interp_event_responses(time_trials[i], spks_rt, events=syncEcho_flip_times[Nb_frames * i:Nb_frames * (i + 1)],
                                                     window=window_ts,
                                                     mean_over_window=False, print_interval=None)
            print(resps.shape)
            temp1=np.moveaxis(resps, 2, 1).reshape(-1, resps.shape[1], 1)
            windowed_responses = resps.max(axis=-1)
            temp = np.zeros((int(temp1.shape[0]), spks.shape[0], 1))

            # spks_rt = np.array([spks_rt[:, i] - np.min(spks_rt, axis=1) for i in range(spks_rt.shape[1])]).T
            # print(np.sum(trial), len(time_trials[i]), spks_rt.shape)
            # temp = np.zeros((Nb_frames, spks.shape[0], 1))
            # print('exptype : ', exptype)
            # seft=syncEcho_flip_times[Nb_frames * i:Nb_frames * (i + 1)]
            # temp1=np.array([np.mean(spks_rt[:, np.logical_and(time_trials[i]>=seft[j], time_trials[i]<seft[j+1])][:, :4], axis=1) for j in range(Nb_frames-1)])
            # temp1=temp1.reshape((temp1.shape[0], temp.shape[1], 1))
        temp[:temp1.shape[0]]=temp1
        resps_all.append([temp])
        resps_all_raw.append(spks_rt)

    return resps_all,resps_all_raw


def loadFluoMesoscope(exp_info, dirs, path, block_end, Nb_plane=3, Nb_frames=9000, first=False, last=True,
                     threshold=1.25, plane=-1, method='frame2ttl', exptype='zebra'):
    if first:
        print('first session')
        if Nb_plane != 1:
            print('multiple planes')
            if plane != -1:
                print('loading planes nb ', plane)

                F = np.load(
                    path + '/plane%d/F.npy' % plane)[
                        np.load(
                            path + '/plane%d/iscell.npy' % plane)[
                        :, 0].astype(bool)][:, :block_end]

                Fneu = np.load(
                    path + '/plane%d/Fneu.npy' % plane)[
                           np.load(
                               path + '/plane%d/iscell.npy' % plane)[
                           :, 0].astype(bool)][:, :block_end]

                spks=F-(0.7*Fneu)

            else:
                print('loading all planes')
                M = [np.load(
                    path + '/plane%d/F.npy' % p)[
                         np.load(
                             path + '/plane%d/iscell.npy' % p)[
                         :, 0].astype(bool)] -
                     (0.7*np.load(
                    path + '/plane%d/Fneu.npy' % p)[
                         np.load(
                             path + '/plane%d/iscell.npy' % p)[
                         :, 0].astype(bool)])
                     for p in range(Nb_plane)]
                spks = np.concatenate([M[i][:, :M[-1].shape[1]] for i in range(len(M))])[:, :block_end]

        else:
            print('single plane')
            F = np.concatenate([np.load(
                path + '/plane%d/F.npy' % p)[
                                       np.load(
                                           path + '/plane%d/iscell.npy' % p)[
                                       :, 0].astype(bool)] for p in range(Nb_plane)])[:, :block_end]

            Fneu = np.concatenate([np.load(
                path + '/plane%d/Fneu.npy' % p)[
                                    np.load(
                                        path + '/plane%d/iscell.npy' % p)[
                                    :, 0].astype(bool)] for p in range(Nb_plane)])[:, :block_end]
            spks = F - (0.7 * Fneu)

    elif last:
        print('last session')
        if Nb_plane != 1:
            print('multiple planes')
            if plane != -1:
                print('loading planes nb ', plane)
                F = np.load(
                    path + '/plane%d/F.npy' % plane)[np.load(path + '/plane%d/iscell.npy' % plane)[
                                                        :, 0].astype(bool)][:, block_end:]
                Fneu = np.load(
                    path + '/plane%d/Fneu.npy' % plane)[np.load(path + '/plane%d/iscell.npy' % plane)[
                                                     :, 0].astype(bool)][:, block_end:]
                spks = F - (0.7 * Fneu)
            else:
                print('loading all planes')
                M = [np.load(
                    path + '/plane%d/F.npy' % p)[
                         np.load(
                             path + '/plane%d/iscell.npy' % p)[:, 0].astype(bool)]
                     - (0.7*np.load(path + '/plane%d/Fneu.npy' % p)[np.load(
                             path + '/plane%d/iscell.npy' % p)[:, 0].astype(bool)] ) for p in range(Nb_plane)]
                spks = np.concatenate([M[i][:, :M[-1].shape[1]] for i in range(len(M))])[:, block_end:]

        else:
            print('single plane')
            F = np.concatenate([np.load(
                path + '/plane%d/F.npy' % p)[
                                       np.load(
                                           path + '/plane%d/iscell.npy' % p)[
                                       :, 0].astype(bool)] for p in range(Nb_plane)])[:, block_end:]
            Fneu = np.concatenate([np.load(
                path + '/plane%d/Fneu.npy' % p)[
                                    np.load(
                                        path + '/plane%d/iscell.npy' % p)[
                                    :, 0].astype(bool)] for p in range(Nb_plane)])[:, block_end:]
            spks = F - (0.7 * Fneu)
    else:
        print('mid')
        if plane != -1:
            F = np.load(
                path + '/plane%d/F.npy' % plane)[np.load(path + '/plane%d/iscell.npy' % plane)[
                                                    :, 0].astype(bool)][:, block_end[0]:block_end[1]]
            Fneu = np.load(
                path + '/plane%d/Fneu.npy' % plane)[np.load(path + '/plane%d/iscell.npy' % plane)[
                                                 :, 0].astype(bool)][:, block_end[0]:block_end[1]]
            spks = F - (0.7 * Fneu)
        else:
            spks = np.concatenate([np.load(
                path + '/plane%d/F.npy' % p)[
                    np.load(path + '/plane%d/iscell.npy' % p)[:, 0].astype(bool)]
                     -(0.7*np.load(
                path + '/plane%d/Fneu.npy' % p)[
                    np.load(path + '/plane%d/iscell.npy' % p)[:, 0].astype(bool)])
                                   for p in range(Nb_plane)])[:, block_end[0]:block_end[1]]

    if Nb_plane != 1:
        print('multiple planes')
        if plane != -1:
            print('loading planes nb ', plane)
            neuron_pos = np.array([(1, plane * 512) + np.asarray([sta['med'] for sta in np.load(
                path + '/plane%d/stat.npy' % plane,
                allow_pickle=True)[np.load(
                path + '/plane%d/iscell.npy' % plane)[:,
                                   0].astype(bool)]])])[0]

        else:
            print('loading all planes')
            neuron_pos = np.concatenate([(1, p * 512) + np.asarray([sta['med'] for sta in np.load(
                path + '/plane%d/stat.npy' % p,
                allow_pickle=True)[np.load(
                path + '/plane%d/iscell.npy' % p)[:,
                                   0].astype(bool)]]) for p in range(1, Nb_plane)])

    else:
        print('single plane')
        neuron_pos = np.concatenate([(1, p * 512) + np.asarray([sta['med'] for sta in np.load(
            path + '/plane%d/stat.npy' % p,
            allow_pickle=True)[np.load(
            path + '/plane%d/iscell.npy' % p)[:,
                               0].astype(bool)]]) for p in range(Nb_plane)])

    print('shape spks : ', spks.shape)
    print('neuron_pos spks : ', neuron_pos.shape)

    resps_all, resps_all2 = align_datas(exp_info, dirs, spks, Nb_frames, nb_plane=Nb_plane, threshold=threshold,
                                        plane=plane, methods=method, exptype=exptype)
    print('data aligned')
    resps_all = np.array(resps_all)
    resps_all = np.nan_to_num(resps_all)
    resps_all = resps_all[:, 0, :, :, 0]
    return resps_all, resps_all2, neuron_pos


def loadSPKMesoscope(exp_info, dirs, path, block_end, Nb_plane=3, Nb_frames=9000, first=False, last=True,  threshold=1.25,plane=-1,  method='frame2ttl', exptype='zebra', w=0, plotting=False):
    if first:
        print('first session')
        if Nb_plane != 1:
            print('multiple planes')
            if plane!=-1:
                print('loading planes nb ', plane)
                spks = np.load(
                    path + '/plane%d/spks.npy' % plane)[
                                           np.load(
                                               path + '/plane%d/iscell.npy' % plane)[
                                           :, 0].astype(bool)][:, :block_end]



            else:
                print('loading all planes')
                M = [np.load(
                    path + '/plane%d/spks.npy' % p)[
                         np.load(
                             path + '/plane%d/iscell.npy' % p)[
                         :, 0].astype(bool)] for p in range(Nb_plane)]
                spks = np.concatenate([M[i][:, :M[-1].shape[1]] for i in range( len(M))])[:, :block_end]

        else:
            print('single plane')
            spks = np.concatenate([np.load(
                path + '/plane%d/spks.npy' % p)[
                                       np.load(
                                           path + '/plane%d/iscell.npy' % p)[
                                       :, 0].astype(bool)] for p in range(Nb_plane)])[:, :block_end]

    elif last:
        print('last session')
        if Nb_plane != 1:
            print('multiple planes')
            if plane != -1:
                print('loading planes nb ', plane)
                spks = np.load(
                    path + '/plane%d/spks.npy' % plane)[np.load(path + '/plane%d/iscell.npy' % plane)[
                                           :, 0].astype(bool)][:, block_end:]
            else:
                print('loading all planes')
                M = [np.load(
                    path + '/plane%d/spks.npy' % p)[
                         np.load(
                             path + '/plane%d/iscell.npy' % p)[
                         :, 0].astype(bool)] for p in range(Nb_plane)]
                spks = np.concatenate([M[i][:, :M[-1].shape[1]] for i in range( len(M))])[:, block_end:]

        else:
            print('single plane')
            spks = np.concatenate([np.load(
                path + '/plane%d/spks.npy' % p)[
                                       np.load(
                                           path + '/plane%d/iscell.npy' % p)[
                                       :, 0].astype(bool)] for p in range(Nb_plane)])[:, block_end:]
    else:
        print('mid')
        if plane != -1:
            spks = np.load(
                path + '/plane%d/spks.npy' % plane)[np.load(path + '/plane%d/iscell.npy' % plane)[
                                       :, 0].astype(bool)][:, block_end[0]:block_end[1]]
        else:
            spks = np.concatenate([np.load(
                path + '/plane%d/spks.npy' % p)[
                                       np.load(
                                           path + '/plane%d/iscell.npy' % p)[
                                       :, 0].astype(bool)] for p in range(Nb_plane)])[:, block_end[0]:block_end[1]]

    if Nb_plane != 1:
        print('multiple planes')
        if plane != -1:
            print('loading planes nb ', plane)
            neuron_pos = np.array([(1, plane * 512) + np.asarray([sta['med'] for sta in np.load(
                path + '/plane%d/stat.npy' % plane,
                allow_pickle=True)[np.load(
                path + '/plane%d/iscell.npy' % plane)[:,
                                   0].astype(bool)]])])[0]

        else:
            print('loading all planes')
            neuron_pos = np.concatenate([(1, p * 512) + np.asarray([sta['med'] for sta in np.load(
                path + '/plane%d/stat.npy' % p,
                allow_pickle=True)[np.load(
                path + '/plane%d/iscell.npy' % p)[:,
                                   0].astype(bool)]]) for p in range(1, Nb_plane)])

    else:
        print('single plane')
        neuron_pos = np.concatenate([(1, p * 512) + np.asarray([sta['med'] for sta in np.load(
            path + '/plane%d/stat.npy' % p,
            allow_pickle=True)[np.load(
            path + '/plane%d/iscell.npy' % p)[:,
                               0].astype(bool)]]) for p in range(Nb_plane)])

    print('shape spks : ', spks.shape)
    print('neuron_pos spks : ', neuron_pos.shape)


    resps_all, resps_all2 = align_datas(exp_info, dirs, spks, Nb_frames,nb_plane=Nb_plane, threshold=threshold, plane=plane, w=w, methods=method, exptype=exptype, plotting=plotting)
    print('data aligned')
    resps_all = np.array(resps_all)
    resps_all = np.nan_to_num(resps_all)
    resps_all = resps_all[:, 0, :, :, 0]
    return resps_all, resps_all2, neuron_pos




def loadRespMesoscope(exp_info, dirs, path, block_end):
    tlfile = clu.find_expt_file(exp_info, 'timeline', dirs)
    tl = tlu.load_timeline(tlfile)

    # frame_times = tpu.get_frame_times(tl)
    input_ind = 'neuralFrames' == tlu.get_input_names(tl)
    tp = tl['rawDAQData'][:, input_ind].flatten()
    ind = np.diff(tp, prepend=tp[0]) > 0
    frame_times = tl['rawDAQTimestamps'][ind]

    spks_deconvolved = np.concatenate([np.load(
       path + '/plane%d/spks.npy' % plane)[
                                           np.load(
                                               path+'/plane%d/iscell.npy' % plane)[
                                           :, 0].astype(bool)] for plane in range(3)])[:, block_end:]

    F = np.concatenate([np.load(
        path+'/plane%d/F.npy' % plane)[np.load(
        path+'/plane%d/iscell.npy' % plane)[:,
                                                                                                               0].astype(
        bool)] for plane in range(3)])[:, block_end:]
    Fneu = np.concatenate([np.load(
        path+'/plane%d/Fneu.npy' % plane)[
                               np.load(
                                   path+'/plane%d/iscell.npy' % plane)[
                               :, 0].astype(bool)] for plane in range(3)])[:, block_end:]

    spks = F - (0.7 * Fneu)

    neuron_pos = np.concatenate([(1, plane * 512) + np.asarray([sta['med'] for sta in np.load(
        path+'/plane%d/stat.npy' % plane,
        allow_pickle=True)[np.load(
        path+'/plane%d/iscell.npy' % plane)[:,
                           0].astype(bool)]]) for plane in range(3)])

    n_cell = neuron_pos.shape[0]

    Nb_frames = 9000
    verbose = False

    input_ind = 'photoDiode' == tlu.get_input_names(tl)
    syncEcho_thresh = 1.5
    esynv = tl['rawDAQData'][:, input_ind].flatten() > syncEcho_thresh
    syncEcho_flip = np.asarray(np.logical_or(
        np.logical_and(np.logical_not(esynv[:-1]), esynv[1:]),
        np.logical_and(np.logical_not(esynv[1:]), esynv[:-1])
    )).nonzero()[0]
    syncEcho_flip_times = tl['rawDAQTimestamps'][syncEcho_flip]
    print('syncEcho_flip_times: ', syncEcho_flip_times.shape)

    starttrial = frame_times[frame_times >= syncEcho_flip_times[0]]

    trial1 = np.logical_and(frame_times >= syncEcho_flip_times[0], frame_times < syncEcho_flip_times[Nb_frames])
    time_trial1 = frame_times[trial1]

    trial2 = np.logical_and(frame_times >= syncEcho_flip_times[Nb_frames],
                            frame_times < syncEcho_flip_times[Nb_frames * 2])
    time_trial2 = frame_times[trial2]

    trial3 = np.logical_and(frame_times >= syncEcho_flip_times[Nb_frames * 2],
                            frame_times < syncEcho_flip_times[Nb_frames * 3])
    time_trial3 = frame_times[trial3]

    trial4 = np.logical_and(frame_times >= syncEcho_flip_times[Nb_frames * 3],
                            frame_times < syncEcho_flip_times[Nb_frames * 4])
    time_trial4 = frame_times[trial4]

    trial5 = np.logical_and(frame_times >= syncEcho_flip_times[Nb_frames * 4],
                            frame_times < syncEcho_flip_times[Nb_frames * 5])
    time_trial5 = frame_times[trial5]

    trial6 = np.logical_and(frame_times >= syncEcho_flip_times[Nb_frames * 5],
                            frame_times < syncEcho_flip_times[Nb_frames * 7])
    time_trial6 = frame_times[trial6]

    trials = [trial1, trial2, trial3, trial4, trial5]
    time_trials = [time_trial1, time_trial2, time_trial3, time_trial4, time_trial5]
    window = [0.15]
    # avg_spks=np.mean(np.array([spks[:,np.asarray(trial!=0).nonzero()[0]].tolist()[0] for trial in trials]), axis=0)
    resps_all = []
    for i, trial in enumerate(trials):
        spks_rt = utils.zscore(spks[:, np.asarray(trial != 0).nonzero()[0]], ax=1, epsilon=1e-5)
        spks_rt = np.array([spks_rt[:, i] - np.min(spks_rt, axis=1) for i in range(spks_rt.shape[1])]).T
        print(i)
        print(np.sum(trial), len(time_trials[i]), spks_rt.shape)
        resps_all.append([utils.interp_event_responses(time_trials[i], spks_rt,
                                                       events=syncEcho_flip_times[Nb_frames * i:Nb_frames * (i + 1)],
                                                       window=window, mean_over_window=False, print_interval=None)])
    resps_all = np.array(resps_all)
    resps_all = np.nan_to_num(resps_all)
    resps_all = resps_all[:, 0, :, :, 0]

    U, S, Vh = np.linalg.svd(resps_all.reshape(-1, n_cell), full_matrices=False)
    A = U[:, 2:] @ np.diag(S[2:]) @ Vh[2:, :]

    resps_all = A.reshape((5, 9000, n_cell))

    return resps_all, neuron_pos, time_trial1




def get_rfs(i, r2, r1, i2, i1,y2, y1, neuron_pos):
    RFS = []
    print('r2')
    for o in range(8):
        # print(o)
        # convolved_wavelets=convolved_wavelets_r.reshape(9000, 54, 135, 8, 4)[4500:, :, :, o, :]
        rfs = PearsonCorrelationPinkNoise(r2[:, :, :, o].reshape(4500, -1), y2[0].reshape(-1, 1), neuron_pos[i],
                                          135, 54)
        rfs = rfs[0]
        RFS.append(rfs)
        torch.cuda.empty_cache()
    torch.cuda.empty_cache()
    RFS = np.array(RFS)
    RFS = np.moveaxis(RFS, 0, 3)
    RFS_r_2 = RFS[0]
    del RFS, rfs
    gc.collect()

    RFS = []
    print('r1')
    for o in range(8):
        # print(o)
        # convolved_wavelets = convolved_wavelets_r.reshape(9000, 54, 135, 8, 4)[:4500, :, :, o, :]
        # rfs = PearsonCorrelationPinkNoise(convolved_wavelets.reshape(4500, -1),
        #                                   resps_all_mean[:4500, idx].reshape(-1, 1), neuron_pos[idx], 135, 54)
        rfs = PearsonCorrelationPinkNoise(r1[:, :, :, o].reshape(4500, -1), y1[0].reshape(-1, 1),
                                          neuron_pos[i], 135, 54)
        rfs = rfs[0]
        RFS.append(rfs)
        torch.cuda.empty_cache()
    torch.cuda.empty_cache()
    RFS = np.array(RFS)
    RFS = np.moveaxis(RFS, 0, 3)
    RFS_r_1 = RFS[0]
    del RFS, rfs
    gc.collect()

    RFS = []
    print('i2')
    for o in range(8):
        # print(o)
        # convolved_wavelets = convolved_wavelets_i.reshape(9000, 54, 135, 8, 4)[4500:, :, :, o, :]
        # rfs = PearsonCorrelationPinkNoise(convolved_wavelets.reshape(4500, -1),
        #                                   resps_all_mean[4500:, idx].reshape(-1, 1), neuron_pos[idx], 135, 54)
        rfs = PearsonCorrelationPinkNoise(i2[:, :, :, o].reshape(4500, -1), y2[0].reshape(-1, 1),
                                          neuron_pos[i], 135, 54)
        rfs = rfs[0]
        RFS.append(rfs)
        torch.cuda.empty_cache()
    torch.cuda.empty_cache()
    RFS = np.array(RFS)
    RFS = np.moveaxis(RFS, 0, 3)
    RFS_i_2 = RFS[0]
    del RFS, rfs
    gc.collect()

    RFS = []
    print('i1')
    for o in range(8):
        # print(o)
        # convolved_wavelets = convolved_wavelets_i.reshape(9000, 54, 135, 8, 4)[:4500, :, :, o, :]
        # rfs = PearsonCorrelationPinkNoise(convolved_wavelets.reshape(4500, -1),
        #                                   resps_all_mean[:4500, idx].reshape(-1, 1), neuron_pos[idx], 135, 54)
        rfs = PearsonCorrelationPinkNoise(i1[:, :, :, o].reshape(4500, -1), y1[0].reshape(-1, 1),
                                          neuron_pos[i], 135, 54)
        rfs = rfs[0]
        RFS.append(rfs)
        torch.cuda.empty_cache()
    torch.cuda.empty_cache()
    RFS = np.array(RFS)
    RFS = np.moveaxis(RFS, 0, 3)
    RFS_i_1 = RFS[0]
    del RFS, rfs
    gc.collect()
    # RFS = RFS_i_1
    # fig, ax = plt.subplots(8, 4)
    # for i in range(8):
    #     vmax=np.max(RFS)
    #     vmin = np.min(RFS)
    #     ax[i, 0].imshow(RFS[:, :, i, 0].T,vmin=vmin, vmax=vmax, cmap='coolwarm')
    #     ax[i, 1].imshow(RFS[:, :, i, 1].T,vmin=vmin, vmax=vmax, cmap='coolwarm')
    #     ax[i, 2].imshow(RFS[:, :, i, 2].T, vmin=vmin, vmax=vmax,cmap='coolwarm')
    #     ax[i, 3].imshow(RFS[:, :, i, 3].T, vmin=vmin, vmax=vmax,cmap='coolwarm')

    RFS = np.array([RFS_r_1, RFS_r_2, RFS_i_1, RFS_i_2])
    np.save('/media/sophie/Expansion1/UCL/datatest/SP045/2023-10-04/3/rfs/rfs_%d_HR.npy' % i, RFS)


def plotRFS(RFSs):
    vmax = np.max(RFSs)
    vmin = -np.max(RFSs)
    print(vmin, vmax)
    for RFS in RFSs:
        fig, ax = plt.subplots(8, 4)
        for i in range(8):

            ax[i, 0].imshow(RFS[:, :, i, 0].T,vmin=vmin, vmax=vmax, cmap='coolwarm')
            ax[i, 1].imshow(RFS[:, :, i, 1].T,vmin=vmin, vmax=vmax, cmap='coolwarm')
            ax[i, 2].imshow(RFS[:, :, i, 2].T, vmin=vmin, vmax=vmax,cmap='coolwarm')
            ax[i, 3].imshow(RFS[:, :, i, 3].T, vmin=vmin, vmax=vmax,cmap='coolwarm')



    (a, x, y, o, s)=np.where(RFSs==np.max(RFSs))
    print(a)
    print('xmax =',  x)
    print('ymax =', y)
    print('orientation =', o*180/8)
    print('scale =', s)
    print('phase =', np.arctan(RFSs[1, x, y, o, s]/RFSs[3, x, y, o, s])*180/np.pi)
    return (a, x, y, o, s)



def splitDataset(x_i, x_r, y):
    BATCH_SIZE = 1
    Dataset = TensorDataset(torch.Tensor(y[4500:]).T, torch.Tensor(y[:4500]).T)
    r2 = torch.Tensor(x_r.reshape(9000, 135, 54, 8, 4)[4500:])
    r1 = torch.Tensor(x_r.reshape(9000, 135, 54, 8, 4)[:4500])
    i2 = torch.Tensor(x_i.reshape(9000, 135, 54, 8, 4)[4500:])
    i1 = torch.Tensor(x_i.reshape(9000, 135, 54, 8, 4)[:4500])

    DL = DataLoader(Dataset, shuffle=False, batch_size=BATCH_SIZE)
    return r2, r1, i2, i1, DL



def getRFS_idx(idx, x_i, x_r, y, neuron_pos):
    r2, r1, i2, i1, DL = splitDataset(x_i, x_r, y)
    get_rfs(idx, r2, r1, i2, i1, torch.Tensor(y[4500:]).T, torch.Tensor(y[:4500]).T, neuron_pos)


def GetRFS_allneurons(x_i, x_r, y, startid , neuron_pos):
    # R2=TensorDataset(torch.Tensor(convolved_wavelets_r.reshape(9000, 54, 135, 8, 4)[4500:]), torch.Tensor(resps_all_mean[4500:]) )
    # R1=TensorDataset(torch.Tensor(convolved_wavelets_r.reshape(9000, 54, 135, 8, 4)[:4500]), torch.Tensor(resps_all_mean[:4500]) )
    # I2=TensorDataset(torch.Tensor(convolved_wavelets_i.reshape(9000, 54, 135, 8, 4)[4500:]), torch.Tensor(resps_all_mean[4500:]) )
    # I1=TensorDataset(torch.Tensor(convolved_wavelets_i.reshape(9000, 54, 135, 8, 4)[:4500]),torch.Tensor(resps_all_mean[:4500]) )
    # R1_DL = DataLoader(R1, shuffle=False, batch_size=BATCH_SIZE)
    # R2_DL = DataLoader(R2, shuffle=False, batch_size=BATCH_SIZE)
    # I1_DL = DataLoader(I1, shuffle=False, batch_size=BATCH_SIZE)
    # I2_DL = DataLoader(I2, shuffle=False, batch_size=BATCH_SIZE)

    r2, r1, i2, i1, DL=splitDataset(x_i, x_r, y)


    for i, (y2, y1) in enumerate(DL):

        if i >= startid:
            print(i)
            get_rfs(i, r2, r1, i2, i1, y2, y1, neuron_pos)


def correctNeuronPos(neuron_pos, resolution=1.3671):
    """
    converts neuron position in microns

    Parameters:
        neuron_pos (array-like): shape (n_neurons * n_dim)
        resolution (float): resolution.

    Returns:
        neuron_pos_corrected[int]: new positions
    """
    ly = np.ceil(np.max(neuron_pos[:, 0]) / 3)
    lx = np.ceil(np.max(neuron_pos[:, 1]))
    n1 = neuron_pos[neuron_pos[:, 0] <= ly]
    neuron_pos[np.logical_and(neuron_pos[:, 0] > ly, neuron_pos[:, 0] <= 2 * ly)] = neuron_pos[np.logical_and(
        neuron_pos[:, 0] > ly, neuron_pos[:, 0] <= 2 * ly)] + np.array([-ly, lx])
    neuron_pos[neuron_pos[:, 0] > 2 * ly] = neuron_pos[neuron_pos[:, 0] > 2 * ly] + np.array([-2 * ly, 2 * lx])
    neuron_pos=resolution*neuron_pos
    return neuron_pos

def coarseWavelet(path, downsampling, nx0=135, ny0=54, nx=27, ny=11,no=8,ns=6, nf=1, chunk_size=1000):

    """
    Loads a coarse version of the wavelet transform for a quick neuron feature estimation. 
    If cannot find the wavelets decomposition and downsampling, it will run it

    Parameters:
        Path: patn to the wavelet decomposition diretory.
        downsampling (bool): default False
        NX0 (int): number of azimuth positions (pix) (x shape of the downsampled stimuli).
    	NY0 (int): number of elevation positions (pix) (y shape of the downsampled stimuli).
    	NX (int): new (coarse) number of azimuth positions (pix) (default 27).
    	NY (int): new (coarse) number of elevation positions (pix) (default 11).
    	NO: nb of orienatations (default 8).
    	NS: number of sizes
    	NF: number of spatial frequencies
    	chunk_size: for computational effisciency. 1000 is in geenral a good value

    Returns:
        the coarse wavvelet decomposition (cosin, sine, cos^2 +sin^2)
    """
    print('loading wavelets...')
    if os.path.exists(os.path.join(path, 'dwt_downsampled_videodata.npy')):
        print('already downsampled')
        wavelets_downsampled=np.load(os.path.join(path, 'dwt_downsampled_videodata.npy'))
        w_r_downsampled=wavelets_downsampled[0]
        w_i_downsampled=wavelets_downsampled[1]
        w_c_downsampled=wavelets_downsampled[2]
        del wavelets_downsampled
        gc.collect()
    else:
        print('downsampling')
        wavelets=load_stimulus_simple_cell(path, nx, ny, no,ns, nf,downsampling)
        wavelets_r = wavelets[0]
        wavelets_i = wavelets[1]
        del wavelets
        gc.collect()
        nb_chunks = int(wavelets_r.shape[0] / chunk_size)
        I=[]
        R=[]
        C=[]

        for i in range(nb_chunks):
            print(i)
            w_r=wavelets_r[i * chunk_size:(i + 1) * chunk_size]
            w_i=wavelets_i[i * chunk_size:(i + 1) * chunk_size]
            wavelets_complex = (np.power(w_r, 2)
                                + np.power(w_i, 2))
            print(w_r.shape)
            print(w_i.shape)
            print(wavelets_complex.shape)
            w_r_downsampled = skimage.transform.resize(w_r.reshape((-1, nx0, ny0,no, ns)),
                                                       (w_r.shape[0], nx, ny, no, ns, nf), anti_aliasing=True)
            w_i_downsampled = skimage.transform.resize(w_i.reshape((-1, nx0, ny0, no, ns)),
                                                       (w_i.shape[0], nx, ny, no, ns, nf), anti_aliasing=True)
            del w_i, w_r
            gc.collect()
            I.append(w_i_downsampled)
            R.append(w_r_downsampled)
            w_c_downsampled = skimage.transform.resize(wavelets_complex.reshape((-1, nx0, ny0, no, ns, nf)),
                                                       (wavelets_complex.shape[0], nx, ny, no, ns, nf), anti_aliasing=True)
            C.append(w_c_downsampled)

        del wavelets_r, wavelets_i
        del wavelets_complex
        w_r_downsampled=np.concatenate(R, axis=0)
        w_i_downsampled = np.concatenate(I, axis=0)
        w_c_downsampled = np.concatenate(C, axis=0)
        np.save(os.path.join(path, 'dwt_downsampled_videodata.npy'),[w_r_downsampled, w_i_downsampled, w_c_downsampled])
    return w_r_downsampled, w_i_downsampled, w_c_downsampled
