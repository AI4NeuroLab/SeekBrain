"""
Utility functions for neural decoding analysis.
"""
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.model_selection import KFold
from sklearn.metrics import mean_squared_error

def smooth_data(data, window_size_samples):
    """Applies a sliding window average."""
    return np.convolve(data, np.ones(window_size_samples) / window_size_samples, mode='same')

def run_ridge_regression(X, y, n_splits=5):
    """
    Fits Ridge regression using K-Fold cross-validation.
    Returns the average MSE for the actual model and a scrambled control.
    """
    kf = KFold(n_splits=n_splits)
    mse_actual = []
    mse_control = []

    for train_idx, test_idx in kf.split(X):
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        # Actual Model
        model = Ridge(alpha=1.0)
        model.fit(X_train, y_train)
        pred = model.predict(X_test)
        mse_actual.append(mean_squared_error(y_test, pred))

        # Scrambled Control
        y_scrambled = np.random.permutation(y_train)
        model_ctrl = Ridge(alpha=1.0)
        model_ctrl.fit(X_train, y_scrambled)
        pred_ctrl = model_ctrl.predict(X_test)
        mse_control.append(mean_squared_error(y_test, pred_ctrl))

    return np.mean(mse_actual), np.mean(mse_control)

def get_shifted_data(neural_data, velocity, tau, fs):
    """Shifts data for temporal decoding analysis."""
    shift = int(tau * fs)
    if shift > 0:
        return neural_data[:, :-shift].T, velocity[shift:]
    elif shift < 0:
        return neural_data[:, -shift:].T, velocity[:shift]
    return neural_data.T, velocity