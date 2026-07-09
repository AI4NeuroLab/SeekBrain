# Source: src/Waven/WaveletGenerator.py
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
import matplotlib.pyplot as plt
from scipy import ndimage
import scipy.io as sio
import skimage
from skimage import transform
from skimage.measure import block_reduce
import cv2
import gc
import torch

from skimage.filters import gabor_kernel




def makeGaborFilter(i, j, angle, sigma, phase, f=0.4, lx=54, ly=135, plot=False, freq=True):
    backgrd=np.zeros((lx, ly))
    if freq:
        gk = gabor_kernel(frequency=f, theta=angle, sigma_x=sigma, sigma_y=sigma, offset=phase)
    else:
        gk = gabor_kernel(frequency=(-0.016*sigma)+0.148, theta=angle, sigma_x=sigma, sigma_y=sigma,offset=phase)
    # plt.figure()
    # plt.imshow(gk.real)
    #
    # plt.figure()
    # plt.imshow(canvas, vmin=0, vmax=0.006)

    canvas=np.ones((lx+(2*gk.shape[0]), ly+(2*gk.shape[1])))
    canvas[gk.shape[0]:gk.shape[0]+lx, gk.shape[1]:gk.shape[1]+ly]=backgrd

    dp=(gk.shape[0]-1)/2

    x=i+gk.shape[0]
    y=j+gk.shape[1]

    canvas[int(x-dp):int(x+dp+1), int(y-dp):int(y+dp+1)]=gk.real
    backgrd=canvas[gk.shape[0]:gk.shape[0]+lx, gk.shape[1]:gk.shape[1]+ly]
    if plot:
        plt.figure()
        plt.rcParams['axes.facecolor'] = 'none'
        plt.imshow(backgrd.T, cmap='Greys')
    return backgrd.T.astype('float16')



def makeGaborFilter3D(i, j, angle, sigma, tp_w, f=0.4, lx=54, ly=135, alpha1=0, alpha2=np.pi/4):

    phases=np.linspace(alpha1, alpha2, tp_w)
    # print(phases)
    f3d=np.array([ makeGaborFilter(i, j, angle, sigma, phase, f=f, lx=lx, ly=ly) for phase in phases])
    return f3d.astype('float16')


def makeFilterLibrary2(xs, ys, thetas, sigmas, offsets, frequencies):
    library=[]
    lx=xs.shape[0]
    ly=ys.shape[0]
    for x in xs:
        print(x)
        for y in ys:
            for t in thetas:
                for s in sigmas:
                    for f in frequencies:
                        for o in offsets:
                            library.append( makeGaborFilter(x, y, t, s, o, f, lx=lx, ly=ly, freq=True))

    library=np.array(library)
    return library.reshape((lx, ly, thetas.shape[0], sigmas.shape[0], frequencies.shape[0], offsets.shape[0], -1))

def makeFilterLibrary(xs, ys, thetas, sigmas, offsets, f, freq=True):
    """
    builds the Gabor library

    Parameters:
        thetas (int): number of orientatuion equally spaced between 0 and 180 degree.
    	Sigmas (list): standart deviation of theb gabor filters expressed in pixels (radius of the gaussian half peak wigth).
    	f (list): spatial frequencies expressed in pixels per cycles.
    	offsets (list): 0 and pi/2.
    	xs (int): number of azimuth positions (pix) (x shape of the downsampled stimuli).
    	ys (int): number of elevation positions (pix) (y shape of the downsampled stimuli).
    	freq (boolean): if True the, takes into account the frequencies list to generate the gabors filters, if False, there is a linear relationship between the size and the spatial frequencies as found in ref paper

    Returns:
        npy file containing all the generated gabor filters of shape (nx, ny, n_orientation, n_sizes, n_freq (if defined independantly from sizes, n_phases, nx*ny))
    """
    library=[]
    lx=xs.shape[0]
    ly=ys.shape[0]
    for x in xs:
        print(x)
        for y in ys:
            for t in thetas:
                for s in sigmas:
                    for o in offsets:
                        library.append( makeGaborFilter(x, y, t, s, o, f, lx=lx, ly=ly, freq=freq))

    library=np.array(library)
    return library.reshape((lx, ly, thetas.shape[0], sigmas.shape[0], offsets.shape[0], -1))



import itertools
def makeFilterLibrary3D(xs, ys, thetas, sigmas, offsets, f, tp_w,  alpha1, alpha2, filename):
    # library=[]
    lx = xs.shape[0]
    ly = ys.shape[0]
    fp = np.zeros( shape=(lx, ly, thetas.shape[0], sigmas.shape[0], tp_w,ly, lx), dtype='float16')
    print(fp.shape)
    i=0
    # with open(filename, mode="wb") as fp:
    for x in xs:
        print(x)
        for y in ys:
            for i, t in enumerate(thetas):
                for j, s in enumerate(sigmas):
                        l = makeGaborFilter3D(x, y, t, s, tp_w, f, lx=lx, ly=ly,  alpha1=alpha1, alpha2=alpha2)
                        # print(l.shape)
                        fp[x, y, i, j]=l

    print('saving...')
    np.save(filename,  fp)
    return fp



def waveletTransform(frame,phase, L):
    output=L[:, :, :,phase]@torch.Tensor(frame.flatten()).cuda()
    # output=torch.sum(output, axis=(0, 1))
    return output.detach().cpu().numpy()


def waveletTransform3D(frame, L):
    output=L@torch.Tensor(frame.flatten()).cuda()
    # output=torch.sum(output, axis=(0, 1))
    return output.detach().cpu().numpy()


def getTrueRF(idx, rfs, L):
    rf=rfs[idx, :, :, :]#.swapaxes(0, 1)
    # rf = skimage.transform.resize(rf, (135, 54, 8),order=5, anti_aliasing=True)
    rfv=rf.reshape(1, -1)@L[:, :, :, 2, 0, :].reshape(-1,7290)

    plt.figure()
    plt.imshow(rfv.reshape(54, 135)[5:-5, 5:-5],  vmin=-np.max(rfv), vmax=np.max(rfv) ,cmap='coolwarm')#vmin=-0.0014, vmax=0.0014,



def getWTfromNPY(videodata, waveletLibrary, phase):
    WT = []
    l = torch.Tensor(waveletLibrary).cuda()
    for i, frame in enumerate(videodata):
        print(i)
        wt = waveletTransform(frame, phase, l)
        torch.cuda.empty_cache()
        WT.append(wt)
    WT = np.array(WT)
    # l = l.detach().cpu().numpy()
    # torch.cuda.empty_cache()
    # del l
    # gc.collect()
    return WT




def getWTfromNPY3D(videodata, waveletLibrary, tp_w):
    WT = []
    l = torch.Tensor(waveletLibrary).cuda()
    for i in range(tp_w, videodata.shape[0]):
        print(i)
        wt = waveletTransform3D(videodata[i-tp_w:i], l)
        torch.cuda.empty_cache()
        WT.append(wt)
    WT = np.array(WT)
    # l = l.detach().cpu().numpy()
    # torch.cuda.empty_cache()
    # del l
    # gc.collect()
    return WT






def downsample_video_binary(path, visual_coverage, analysis_coverage, shape=(54, 135), chunk_size=1000,ratios=(1, 1)):
    """
    Downsample the video stimulus.

    Parameters:
        Path: path to the stimulus (.mp4)
        Visual Coverage (list): [azimuth left, azimuth right, elevation top , elevation bottom] in visual degree.
    	Analysis Coverage (list): [azimuth left, azimuth right, elevation top , elevation bottom] in visual degree.
        Shape (nx, ny): downsampled size
        chunk size: for precessing effisciency, default 1000
        ratio: if part of the screen is ignored

    Returns:
        saves the downsampled file at path
    """
    frames = []
    cap = cv2.VideoCapture(path)
    ret = True
    ret1=True
    F=[]
    r=0
    f = 0
    ratio_x, ratio_y=ratios
    print(ratio_x, ratio_y)
    while ret:
        frames = []
        print(r) 
        ret1=ret
        i = 0
        while ret1:
            # print(f)
            ret, img = cap.read()  # read one frame from the 'capture' object; img is (H, W, C)
            # print('while ret1')
            if ret:
                if f<(r+1)*chunk_size:
                    if f >= r * chunk_size:
                        frames.append(img)
                        i=i+1
                        f = f + 1
                        # print('add framw', f)
                if f>=(r+1)*chunk_size:
                    ret1=False
                    print('false', f, i)
                    print(len(frames))
                
                
            else:
                print(f, i, ret)
                ret1=ret
        try:
            video = np.stack(frames, axis=0)  # dimensions (T, H, W, C)
            print(video.shape)
            video = video[:, :, :, 0]
            video_bin = video > 100
            nb_chunks=int(video.shape[0]/chunk_size)
            del frames, video
            gc.collect()
            # frames = []
            # for i in range(nb_chunks):
            #     print(i)
            print(video_bin.shape)
            xi=int((visual_coverage-analysis_coverage)[2])
            xe=int(ratio_y*video_bin.shape[1])
            yi=int((visual_coverage-analysis_coverage)[0])
            ye=int(ratio_x*video_bin.shape[2])
            print(xi, xe, yi, ye)
            video_bin=video_bin[:,xi:xe,yi:ye]
            video_bin = skimage.transform.resize(video_bin, (chunk_size, shape[0], shape[1]))  # 137
            video_binary = video_bin >= 0.5
            F.append(video_bin)
            del video_bin
            gc.collect()
            video_downsampled = np.concatenate(F, axis=0)
            # F.append(video_downsampled.astype('bool'))
            r=r+1
        except:
            print('end of file')
    F=np.array(F)
    print(F.shape)
    np.save(path[:-4]+'_downsampled.npy', video_downsampled.astype('bool'))


def downsample_video_uint(path, shape=(54, 135), chunk_size=1000):
    ## chunk size should be a divisor of the video total nb of frames
    frames = []
    cap = cv2.VideoCapture(path)
    ret = True
    while ret:
        ret, img = cap.read()  # read one frame from the 'capture' object; img is (H, W, C)
        if ret:
            frames.append(img)
    video = np.stack(frames, axis=0)  # dimensions (T, H, W, C)
    video = video[:, :, :, 0]
    nb_chunks=int(video.shape[0]/chunk_size)
    # video_bin=video
    del frames
    gc.collect()
    # video_bin=video
    frames = []
    for i in range(nb_chunks):
        print(i)
        video_bin = skimage.transform.resize(video[i * chunk_size:(i + 1) * chunk_size], (chunk_size, shape[0], shape[1]))  # 137
        frames.append(video_bin)
        del video_bin
        gc.collect()
    video_downsampled = np.concatenate(frames, axis=0)
    np.save(path[:-4]+'_downsampled.npy', video_downsampled)

def waveletDecomposition(videodata, phase, sigmas, folder_path, library_path='/media/sophie/Expansion1/UCL/datatest/gabors_library.npy'):
    """
    Runs the wavelet decomposition

    Parameters:
        videodata (array like): downsampled stimulus movie (npy).
        Phases (list): 0 and pi/2.
    	Sigmas (list): standart deviation of theb gabor filters expressed in pixels (radius of the gaussian half peak wigth).
    	folder_path: Path where to save the decomposition
        Library Path: path to Gabor library (same as save path if ran)

    Returns:
        saves the wavelet decomposition as 'dwt_videodata_0 / 1.npy' at folder_path
    """
    L = np.load(library_path)
    WT = []
    for s, ss in enumerate(sigmas):
        l = L[:, :, :, s]
        wt = getWTfromNPY(videodata, l, phase)
        WT.append(wt)
    WT = np.array(WT)
    WT = np.moveaxis(WT, 0, 4)
    np.save(folder_path+'/dwt_videodata_'+str(phase)+'.npy', WT)
