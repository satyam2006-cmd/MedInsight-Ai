"""
JADE (Joint Approximate Diagonalization of Eigenmatrices)
Blind Source Separation (BSS) / Independent Component Analysis (ICA) engine for MedInsight Ai vitals processing.

Optimized for real-valued signals.
Based on the original MATLAB implementation by Jean-Francois Cardoso (1999)
and the NumPy translation by Gabriel J.L. Beckers (2007).
"""

import numpy as np
from numpy.linalg import eig, pinv

def jadeR(X: np.ndarray) -> np.ndarray:
    """
    Blind separation of real signals with JADE.
    
    Parameters:
        X: an n x T data matrix (n sensors, T samples).
        
    Returns:
        B: m*n separating matrix such that Y = B * X are the independent components.
    """
    # Use double precision and matrix format for stability
    X = np.matrix(X.astype(np.float64))
    
    n, T = X.shape
    n, T = int(n), int(T)
    m = n

    # Remove mean
    X -= X.mean(1)

    # Whitening & projection onto signal subspace
    # -------------------------------------------
    [D, U] = eig((X * X.T) / float(T))
    k = D.argsort()
    Ds = D[k]
    PCs = np.arange(n-1, n-m-1, -1)

    # PCA
    B = U[:, k[PCs]].T

    # Scaling / Sphering
    scales = np.sqrt(Ds[PCs])
    B = np.diag(1./scales) * B
    X = B * X

    # Estimation of Cumulant Matrices
    # -------------------------------
    X = X.T
    dimsymm = int((m * (m + 1)) // 2)
    nbcm = int(dimsymm)
    
    CM = np.matrix(np.zeros((int(m), int(m*nbcm)), dtype=np.float64))
    R = np.matrix(np.eye(m, dtype=np.float64))
    
    Range = np.arange(m)
    for im in range(m):
        Xim = X[:, im]
        Xijm = np.multiply(Xim, Xim)
        Qij = np.multiply(Xijm, X).T * X / float(T) - R - 2 * np.dot(R[:, im], R[:, im].T)
        CM[:, Range] = Qij
        Range = Range + m
        for jm in range(im):
            Xijm = np.multiply(Xim, X[:, jm])
            Qij = np.sqrt(2) * np.multiply(Xijm, X).T * X / float(T) - R[:, im] * R[:, jm].T - R[:, jm] * R[:, im].T
            CM[:, Range] = Qij
            Range = Range + m

    # Joint diagonalization of the cumulant matrices
    # ==============================================
    V = np.matrix(np.eye(m, dtype=np.float64))
    On = 0.0
    Range = np.arange(m)
    for im in range(nbcm):
        Diag = np.diag(CM[:, Range])
        On = On + (Diag * Diag).sum(axis=0)
        Range = Range + m
    
    Off = (np.multiply(CM, CM).sum(axis=0)).sum(axis=0) - On
    seuil = 1.0e-6 / np.sqrt(T)
    
    encore = True
    while encore:
        encore = False
        upds = 0
        for p in range(m-1):
            for q in range(p+1, m):
                Ip = np.arange(p, m*nbcm, m)
                Iq = np.arange(q, m*nbcm, m)
                
                # Computation of Givens angle
                g = np.concatenate([CM[p, Ip] - CM[q, Iq], CM[p, Iq] + CM[q, Ip]])
                gg = np.dot(g, g.T)
                ton = gg[0, 0] - gg[1, 1]
                toff = gg[0, 1] + gg[1, 0]
                theta = 0.5 * np.arctan2(toff, ton + np.sqrt(ton * ton + toff * toff))
                Gain = (np.sqrt(ton * ton + toff * toff) - ton) / 4.0
                
                if np.abs(theta) > seuil:
                    encore = True
                    upds = upds + 1
                    c = np.cos(theta)
                    s = np.sin(theta)
                    G = np.matrix([[c, -s], [s, c]])
                    pair = np.array([p, q])
                    V[:, pair] = V[:, pair] * G
                    CM[pair, :] = G.T * CM[pair, :]
                    CM[:, np.concatenate([Ip, Iq])] = np.append(c*CM[:, Ip]+s*CM[:, Iq], -s*CM[:, Ip]+c*CM[:, Iq], axis=1)
                    On = On + Gain
                    Off = Off - Gain

    # Final Separating matrix
    # -------------------
    B = V.T * B

    # Sort rows by energy / canonical ordering
    A = pinv(B)
    keys = np.array(np.argsort(np.multiply(A, A).sum(axis=0)[0]))[0]
    B = B[keys, :]
    B = B[::-1, :]
    
    # Fix sign indeterminacy
    b = B[:, 0]
    signs = np.array(np.sign(np.sign(b) + 0.1).T)[0]
    B = np.diag(signs) * B
    
    return np.asarray(B)