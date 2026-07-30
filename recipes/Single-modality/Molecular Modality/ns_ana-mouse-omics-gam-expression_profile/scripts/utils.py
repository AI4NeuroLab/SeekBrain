"""
utils.py
--------
Helper functions for Generalized Additive Modeling (GAM) of gene expression 
trajectories and classification of temporal trends.
"""

import numpy as np
from statsmodels.gam.api import GLMGam, BSplines

def fit_gam_trend(y, t, k=4, n_grid=50):
    """
    Fits a GAM using B-splines to model expression trajectory.
    
    Args:
        y (np.array): Expression values.
        t (np.array): Time points.
        k (int): Number of spline basis functions.
        n_grid (int): Resolution of the predicted grid.
        
    Returns:
        tuple: (t_grid, pred) Arrays of time points and smoothed expression values.
    """
    bs = BSplines(t, df=[k], degree=3)
    gam = GLMGam.from_formula('y ~ 1', data={'y': y}, smoother=bs)
    res = gam.fit()
    
    # Predict over a fine grid for consistent visualization and analysis
    t_grid = np.linspace(t.min(), t.max(), n_grid)
    pred = gam.predict(data={'y': np.zeros(len(t_grid))}, exog=np.ones((len(t_grid), 1)))
    return t_grid, pred

def classify_trend(t_grid, pred, threshold=0.1):
    """
    Classifies trajectories based on numerical derivative of the trend.
    
    Args:
        t_grid (np.array): Time points on the grid.
        pred (np.array): Smoothed expression values.
        threshold (float): Sensitivity threshold for detecting slope change.
        
    Returns:
        str: Classification label ('Up', 'Down', 'Transient', or 'Constant').
    """
    deriv = np.gradient(pred, t_grid)
    if np.all(deriv > threshold): 
        return "Up"
    if np.all(deriv < -threshold): 
        return "Down"
    if np.sign(deriv[0]) != np.sign(deriv[-1]) and np.any(np.abs(deriv) > threshold):
        return "Transient"
    return "Constant"