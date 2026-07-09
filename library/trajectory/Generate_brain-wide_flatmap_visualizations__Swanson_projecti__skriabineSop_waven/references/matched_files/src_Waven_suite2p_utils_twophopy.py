# Source: src/Waven/suite2p/utils/twophopy.py
# Summary: See repo_context.md

# -*- coding: utf-8 -*-
"""
Created on Thu Mar 26 17:12:40 2020

Collection of functions for dealing with two-photon recordings and suite2p
outputs. 

@author: Samuel Failor
"""

from os.path import join
import numpy as np
from . import timelinepy as tl
from . import cortex_lab_utils as clu
import scipy.io as sio


def suite2p_plane_path(root_dir, plane = 'combined'):
    '''
    Converts tuple with experiment info to suite2p directory path on data 
    storage

    Parameters
    ----------
    root_dir : str 
        Path to root suite2p directory
    plane : int or str
        Two-photon recording plane (starts at 0) or 'combined'. If plane it not
        specified it defaults to 'combined'. If plane is -1 then path points
        to suite2p root directory.

    Returns
    -------
    filepath : str
        String of path to suite2p directory.

    '''
    
    # Build filepath string
    if type(plane) == int:
        subdir = 'plane' + str(plane)
    elif type(plane) == str:
        subdir = plane
   
    dirpath = join(root_dir, subdir)
    
    return dirpath 


def load_suite2p(expt_info_or_filepath, plane = 'combined',
                 filetype = 'spks.npy', memmap_on = False, return_path = False):  
    '''
    Loads suite2p output file. Arguments can be experiment info, plane
    number, and file type, or a string with the entire file path.

    Parameters
    ----------
    expt_info_or_filepath : tuple or str
        If tuple: (subject name, experiment date, experiment number)
        If str: filepath
    plane : int or 'combined' to load combined files
    filetype : str
        Default is 'spks.npy'
    memmap_on : bool
        If true, file is loaded with memory mapping
    return_path : bool
        If true, function returns complete filepath of loaded file as string

    Returns
    -------
    numpy.ndarray
        Numpy array of suite2p output

    '''
    
    # Adds numpy file extension if it isn't provided 
    if ('.npy' not in filetype) and ('.mat' not in filetype):
        filetype = filetype + '.npy'
    
    # Check if argument is tuple or filepath string
    if ((type(expt_info_or_filepath) is tuple) | 
        (type(expt_info_or_filepath) is list)):
        filepath = suite2p_plane_path(
            clu.find_expt_file(expt_info_or_filepath,'suite2p'), plane)
        filepath = join(filepath, filetype)
    elif type(expt_info_or_filepath) is str:
        filepath = join(expt_info_or_filepath, filetype)
    
    # Set memmap to 'r', aka read-only, if True
    if memmap_on:
        memmap_on = 'r'
    else:
        memmap_on = None
        
    # breakpoint()
    # Load suite2p file
    if '.npy' in filetype:
        s2pdata = np.load(filepath, memmap_on, allow_pickle = True)[()]
    else:
        s2pdata = sio.loadmat(filepath)
    
    if return_path:
        return s2pdata,filepath
    else:
        return s2pdata
    

def get_frame_times(timeline, frames = None):
    '''
    Returns frame times from timeline

    Parameters
    ----------
    timeline : numpy.ndarray
        output of load_timeline()

    Returns
    -------
    numpy.ndarray
        Array of frame times

    '''
    if frames is None: frames = tl.get_samples(timeline,['neuralFrames']).flatten()
    frame_times = tl.sample_times(timeline)
    # Find index where frame changes
    ind = np.diff(frames, prepend = frames[0]) > 0
    
    return frame_times[ind]
    

def get_plane_times(timeline, total_planes):
    '''
    Returns a list of numpy arrays each containing the plane times for all
    planes in the recording. 

    Parameters
    ----------
    timeline : numpy.ndarray
        output of load_timeline()
    total_planes : int
        Total number of planes in the recording

    Returns
    -------
    plane_times : list
        List of arrays containing plane times for each plane

    ''' 
    frame_times = get_frame_times(timeline)
            
    plane_times = [frame_times[p::total_planes] for p in range(total_planes)]
        
    return plane_times

def find_expt_frames(suite2p_pos, sum_frames):
    '''
    Finds frames corresponding to the experiment of interest in the suite2p
    output, based on the position of the experiment's data in the tiff stack
    '''
    
    if suite2p_pos == 0:
        expt_frames = np.arange(0,sum_frames[0])
    else:
        expt_frames = np.arange(sum_frames[suite2p_pos-1], 
                                   sum_frames[suite2p_pos])    

    return expt_frames

def load_experiment(expt_info, iscell_only = True,
                    cell_outputs = ['spks']):
    '''
    Loads outputs of suite2p data for a given experiment. 

    Parameters
    ----------
    expt_info : tuple 
        (subject name, experimenet date, and experiment number)
    iscell_only : bool, optional
        Set true to only include ROIs considered cells. The default is True.
    cell_outputs : list of strings, optional
        List the outputs you want to load (i.e. spks, F, Fneu). 
        The default is ['spks'].

    Returns
    -------
    expt_dict : dict
        Dictionary containing suite2p data and sampling times of experiment.

    '''   
    # Add basic information about the recording from ops of first plane
    print('Loading suite2p options for each plane...')
    expt_dict = {'ops': [load_suite2p(expt_info, 0, 'ops')]}
    
    # s = expt_dict['ops'][0]['filelist'][0]
    # print(s)
    # print(s.split('\\')[1])
    # print(expt_dict['ops'][0]['filelist'])

    # print([int(s.split('\\')[1]) for s 
    #                  in expt_dict['ops'][0]['filelist']])

    # Total number of planes
    nplanes = expt_dict['ops'][0]['nplanes']
     
    '''
    Load all ops - unfortunately memmap doesn't work with dtype object so
    this is slow
    '''
    for p in range(1,nplanes):
        expt_dict['ops'].append(load_suite2p(expt_info, p, 'ops'))
    
    # print(expt_dict['ops'][0]['filelist'])
    # Get experiment numbers
    try:
        exprs, idx = np.unique([int(s.split('\\')[-2]) for s 
                     in expt_dict['ops'][0]['filelist']], return_index=True)
        exprs = exprs[np.argsort(idx)]        
    except:
        exprs, idx = np.unique([int(s.split('/')[-1][0]) for s 
                     in expt_dict['ops'][0]['filelist']], return_index=True)
        print([int(s.split('/')[-1][0]) for s 
                     in expt_dict['ops'][0]['filelist']])
        exprs = exprs[np.argsort(idx)]
    # print(exprs)
    # Find the position of the experiment when it was processed by suite2p
    suite2p_pos = list(exprs).index(expt_info[2])
    print('suite2p position ' + str(suite2p_pos))
    
    # Load iscell 
    print('Loading cell flags for ROIs...')
    iscell = [load_suite2p(expt_info, p, 'iscell')[:,0].astype(bool)
               for p in range(nplanes)]
    # Make single index array for later
    iscellall = np.concatenate([iscell[p] for p in range(nplanes)])
        
    # Load stats
    print('Loading cell stats...')
    expt_dict['stat'] = np.concatenate([load_suite2p(expt_info, p ,'stat')
                                       for p in range(nplanes)])
      
    # Remove stats for ROIs not considered cells, if wanted
    if iscell_only:
        expt_dict['stat'] = expt_dict['stat'][iscellall]
        
    # Determine which frames should be loaded from output files
    expt_frames = np.array([find_expt_frames(suite2p_pos, 
                  np.cumsum(expt_dict['ops'][p]['frames_per_folder']))
                  for p in range(nplanes)], dtype = object)
        
    # Make number of frames equal across planes
    min_frames = min(list(map(len,expt_frames)))
    for p in range(nplanes):
        if len(expt_frames[p]) > min_frames:
            expt_frames[p] = expt_frames[p][0:min_frames]
                   
    # Load suite2p outputs using memmap, only copy over frames of interest
    for f in cell_outputs:
        print('Loading cell ' + f + '...')
        if iscell_only:
            expt_dict[f] = np.concatenate(
            [np.copy(load_suite2p(expt_info, p, f, True)
            [iscell[p], expt_frames[p][0]:expt_frames[p][-1]+1]) 
             for p in range(nplanes)])
        else:
            expt_dict[f] = np.concatenate(
            [np.copy(load_suite2p(expt_info, p, f, True)[:, expt_frames[p]])
            for p in range(nplanes)])
    
    # Add index of plane each cell is in
    if iscell_only:
        expt_dict['cell_plane'] = np.concatenate([np.ones(sum(iscell[p]))*p
                for p in range(nplanes)])
    else:
        expt_dict['cell_plane'] = np.concatenate([np.ones(len(iscell[p]))*p
                for p in range(nplanes)])
        # Add key for iscell if non-cell rois aren't excluded
        expt_dict['iscell'] = iscell
        
    # Add plane times
    print('Loading plane sample times...')
    timeline = tl.load_timeline(expt_info)
    expt_dict['plane_times'] = get_plane_times(timeline, nplanes)
    
    # Make sample times same length as outputs
    for p,t in enumerate(expt_dict['plane_times']):
        expt_dict['plane_times'][p] = expt_dict['plane_times'][p][0:min_frames] 
        
    print('Loading of experiment complete.')
    
    return expt_dict

def update_iscell_mat(expt_info):
    '''
    Updates Fall.mat iscell field to that saved in iscell.npy. This is 
    necessary if the suite2p GUI wasn't told to save results in .mat as well
    after manual curation. 

    Parameters
    ----------
    expt_info : tuple
        (Subject, expt date, expt number).

    Returns
    -------
    None.

    '''
    
    # Add basic information about the recording from ops of first plane
    print('Loading suite2p options for each plane...')
    expt_dict = {'ops': [load_suite2p(expt_info, 0, 'ops')]}
    
    # Total number of planes
    nplanes = expt_dict['ops'][0]['nplanes']
    
    for p in range(nplanes):
        print('Loading iscell.npy')
        iscell = load_suite2p(expt_info, plane = p, filetype = 'iscell.npy')
        print('Loading Fall.mat')
        iscell_mat, mat_path = load_suite2p(expt_info,plane=p,
                                    filetype = 'Fall.mat', return_path = True)
        
        iscell_mat['iscell'] = iscell
        
        mat_path = mat_path.replace('Fall.mat','Fall_updated.mat')
        
        print('Saving ' + mat_path)
        sio.savemat(mat_path, iscell_mat)
        