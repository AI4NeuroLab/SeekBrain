# Source: src/Waven/suite2p/utils/mpeppy.py
# Summary: See repo_context.md

# -*- coding: utf-8 -*-
"""
Created on Wed Mar 25 19:31:32 2020

Functions for loading mpep data stored in .mat (matlab) files

@author: Samuel Failor
"""

import scipy.io as sio
import numpy as np
from . import timelinepy as tl
from . import cortex_lab_utils as clu
import matplotlib.pyplot as plt


# def protocol_path(expt_info):
#     '''
#     Converts tuple with experiment info (root directory, subject name,
#     experiment date, experiment number) to protocol file path on data storage

#     Parameters
#     ----------
#     expt_info : tuple
#         (root directory of experiment, subject name, 
#           experimenet date, experiment number)

#     Returns
#     -------
#     filepath : str
#         String of filepath to protocol file.

#     '''
    
#     # Unpack tuple
#     root_dir, subject, expt_date, expt_num = expt_info
#     # Build filepath string
#     filepath = join(root_dir, subject, expt_date, str(expt_num), 
#                     "Protocol.mat")
#     return filepath


def load_protocol(expt_info_or_filepath, dirs=None):  
    '''
    Takes tuple with experimental info or string with filepath and loads the
    protocol .mat file

    Parameters
    ----------
    expt_info_or_filepath : tuple or str
        If tuple: (root directory, subject name, experiment date,
        experiment number)
        If str: filepath 

    Returns
    -------
    numpy.ndarray
        A matlab structure converted to a numpy array where dtypes correspond
        typically to the field names in the original structure. A bit of a 
        mess.

    '''
    
    # Check if argument is tuple or filepath string
    if type(expt_info_or_filepath) is tuple:
        filepath = clu.find_expt_file(expt_info_or_filepath,'protocol', dirs=dirs)
    elif type(expt_info_or_filepath) is str:
        filepath = expt_info_or_filepath
    # Load protocol file
    protocol = sio.loadmat(filepath, squeeze_me = True)
    return protocol["Protocol"][()]


def get_stim_times(expt_info, all_flips = False, verbose=False, dirs = None, medfilt=3, overwrite_udp = None, type='stim'):
    '''
    Loads onset and offset times of stimuli in an mpep experiment. This is
    accomplished by alignment of the photodiode signal and the udp updates, 
    both of which are stored in timeline. If all_flips is True, function also
    returns all flips inbetween onset and offset times. 

    Parameters
    ----------
    expt_info : tuple
        (subject name, exerimenet date, experiment number)

    Returns
    -------
    stim_times : numpy.ndarray
        N x 2 array where first column is onset times and second column is
        offset times. 

    '''
    if verbose: print("Loading timeline")
    timeline = tl.load_timeline(expt_info, dirs=dirs)
    

    if verbose: print("Loading UDP")
    udp, udp_times = tl.get_udp(timeline)
   
    # UDP events where stimulus starts
    if type=='stim':
        on_times = udp_times[[i for i,s in enumerate(udp) if 'StimStart' in s]]
        off_times = udp_times[[i for i,s in enumerate(udp) if 'StimEnd' in s]]
    elif type=='block':
        on_times = udp_times[[i for i, s in enumerate(udp) if 'BlockStart' in s]]
        off_times = udp_times[[i for i, s in enumerate(udp) if 'BlockEnd' in s]]
    
    if overwrite_udp is not None:
        for i in range(len(overwrite_udp)):
            on_times[i] = overwrite_udp[i][0]
            off_times[i] = overwrite_udp[i][1]
    
    if verbose: print("Align UDP to PD flips")
    # Align UDP times for onsets and offset to photodiode flip times
    stim_times = tl.align_to_pd((on_times, off_times), ('after','before'),
                                timeline, medfilt=medfilt)
    
    # plt.plot(timeline['rawDAQTimestamps'],timeline['rawDAQData'][:,1])
    # plt.plot(stim_times[0],np.ones(len(stim_times[0])),'o')
    # plt.pause(60)
    
    # If all_flips is true, find times of all flips between onset and offsets
    if all_flips:
        update_times = np.empty(len(on_times), dtype = np.ndarray)
        for o in range(len(on_times)):
            update_times[o] = tl.align_to_pd(([stim_times[0][o], 
                                stim_times[1][o]],), ('after',), timeline, 
                                                             all_flips = True)
    
        return stim_times, update_times
    else:
        return stim_times

def get_sequence(expt_info, par_names, return_n_repeats=False, dirs=None):
    '''
    Returns sequence of specified stimulus paramters

    Parameters
    ----------
    expt_info : tuple
        (root directory of experiment, subject name, 
         experimenet date, experiment number)
    par_names : list
        Sequence of strings with names of parameters of interest, 
        e.g. ('ori','cr')

    Returns
    -------
    par_sequence : numpy.ndarray
        Sequence of parameters

    '''
       
    protocol = load_protocol(expt_info, dirs=dirs)
    all_par_names = protocol['parnames']
    n_repeats = protocol['nrepeats']
    # Check if par_names are in the protocol file
        
    stimuli_nums = protocol['seqnums'].shape[0]
    # Change index from matlab standard to python
    seq_nums = protocol['seqnums'] - 1
    if len(seq_nums.shape)==1:
        seq_nums = seq_nums[:,np.newaxis]
    '''
    Note from original Matlab code:
    "Important note: seqnum in has an interpretation that is not intuitive.
    e.g. seqnum[2,3] = 7 means that stim_2 was the 7th one to be 
    presented in rep_4.

    In other words: The row indicates the stimulus number, and the content
    indicates the sequence number in which it was shown. So if on repeat 2
    stimulus 12 (of 13) was shown as the 4th in the sequence, then
    seqnums[12,1] = 17."
    '''
    
    ''' 
    Convert seq_nums to a n x len(par_names) array where entries per row are 
    the stimulus parameters on that trial
    '''
        
    if type(par_names) is not list:
            par_names = [par_names]
    
    pars_of_interest = np.zeros((stimuli_nums,len(par_names)))
    
    for i,p in enumerate(par_names):
        if p == 'stim_num':
            pars_of_interest[:,i] = np.arange(stimuli_nums)
        else:
            print('Loading sequence for parameters: ' + p)
            ind = all_par_names == p
            pars_of_interest[:,i] = protocol['pars'][ind]#[ind, :]
    
    par_sequence = np.empty((seq_nums.size,len(par_names)))
    
    for r in range(seq_nums.shape[0]):
        ind = seq_nums[r,:]
        for i,p in enumerate(par_names):
            par_sequence[ind,i] = pars_of_interest[r,i]
    

    if len(par_names) < 1:        
        par_sequence = par_sequence.flatten()
    
    if return_n_repeats:
        return par_sequence, n_repeats
    else:
        return par_sequence
    