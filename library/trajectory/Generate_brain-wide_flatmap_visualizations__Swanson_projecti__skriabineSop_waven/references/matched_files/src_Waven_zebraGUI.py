# Source: src/Waven/zebraGUI.py
# Summary: See repo_context.md

"""
Created on Wed Mar 25 19:31:32 2025

@author: Sophie Skriabine
"""
import tkinter as tk
from tkinter import ttk, messagebox
import os
from .config import parse_literal
from .WaveletGenerator import *
from .LoadPinkNoise import *
from .Analysis_Utils import *
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg, NavigationToolbar2Tk
import sys


def _parse_dirs(value):
    """Parse one or more data directories from a GUI text field."""
    try:
        parsed = parse_literal(value, "Dirs")
    except ValueError:
        parsed = value
    if parsed is None:
        return []
    if isinstance(parsed, (list, tuple)):
        return [str(path) for path in parsed]
    return [str(parsed)]


def run(param_defaults, gabor_param):
    """
    Run GUI

    Parameters Gabor Library:
        N_thetas (int): number of orientatuion equally spaced between 0 and 180 degree.
    	Sigmas (list): standart deviation of theb gabor filters expressed in pixels (radius of the gaussian half peak wigth).
    	Frequencies (list): spatial frequencies expressed in pixels per cycles.
    	Phases (list): 0 and pi/2.
    	NX (int): number of azimuth positions (pix) (x shape of the downsampled stimuli).
    	NY (int): number of elevation positions (pix) (y shape of the downsampled stimuli).
    	Save Path (string): where to save the gabor library

    Parameters alignement:
		Dirs (string): where the raw data are.
		Experiment Info: (mouse name, data, experiment number)
		Number of Planes (int): number of acquisition planes.
		Block End (int): timeframe where the experiment starts.
		Number of Frames (int): number of stimulus frames.
		Number of Trials to Keep(int): Number of Trials to Keep.

    Parameters analysis:
		screen_x: stimulus screen x size inn pixels.
		screen_y: stimulus screen y size inn pixels.
		NX (int): number of azimuth positions (pix) (x shape of the downsampled stimuli).
    	NY (int): number of elevation positions (pix) (y shape of the downsampled stimuli).
		Resolution (float): microscope resolution (um per pixels)
		Sigmas (list): standart deviation of theb gabor filters expressed in pixels (radius of the gaussian half peak wigth).
		Visual Coverage (list): [azimuth left, azimuth right, elevation top , elevation bottom] in visual degree.
		Analysis Coverage": [azimuth left, azimuth right, elevation top , elevation bottom] in visual degree.
		Movie Path: path to the stimulus (.mp4)
		Library Path: path to Gabor library (same as save path if ran)
		Spks Path (opt): path to the spks.npy file to skip the alignement procedure, if set ignores Parameter alignment

    Returns:
        neuron tuning graphs
    """

    class RedirectText:
        def __init__(self, widget):
            self.widget = widget

        def write(self, string):
            self.widget.insert(tk.END, string)
            self.widget.see(tk.END)

        def flush(self):
            pass

    def create_gabor():
        sigmas = parse_literal(gabor_entries["Sigmas"].get(), "Sigmas")
        frequencies = parse_literal(
            gabor_entries["Frequencies"].get(),
            "Frequencies",
        )
        nx = int(gabor_entries["NX"].get())
        ny = int(gabor_entries["NY"].get())
        n_theta = int(gabor_entries["N_thetas"].get())
        offsets = parse_literal(gabor_entries["Phases"].get(), "Phases")
        path_save = gabor_entries["Save Path"].get()
        xs = np.arange(nx)
        ys = np.arange(ny)
        thetas = np.array([(i * np.pi) / n_theta for i in range(n_theta)])
        sigmas = np.array(sigmas)
        offsets = np.array(offsets)
        frequencies = np.array(frequencies)
        if frequencies.size and np.any(frequencies != 0):
            L = makeFilterLibrary2(xs, ys, thetas, sigmas, offsets, frequencies)
        else:
            frequency = frequencies[0] if frequencies.size else 0
            L = makeFilterLibrary(
                xs,
                ys,
                thetas,
                sigmas,
                offsets,
                frequency,
                freq=False,
            )
        np.save(path_save, L)
        messagebox.showinfo("gabor library", "Done!")

    def run_wavelet():
        sigmas = parse_literal(gabor_entries["Sigmas"].get(), "Sigmas")
        visual_coverage = parse_literal(
            param_entries["Visual Coverage"].get(),
            "Visual Coverage",
        )
        analysis_coverage = parse_literal(
            param_entries["Analysis Coverage"].get(),
            "Analysis Coverage",
        )
        movpath = param_entries["Movie Path"].get()
        lib_path = param_entries["Library Path"].get()
        nx = int(param_entries["NX"].get())
        ny = int(param_entries["NY"].get())

        if (visual_coverage != analysis_coverage):
            visual_coverage = np.array(visual_coverage)
            analysis_coverage = np.array(analysis_coverage)
            ratio_x = 1 - (
                    (visual_coverage[0] - visual_coverage[1]) - (analysis_coverage[0] - analysis_coverage[1])) / (
                              visual_coverage[0] - visual_coverage[1])
            ratio_y = 1 - (
                    (visual_coverage[2] - visual_coverage[3]) - (analysis_coverage[2] - analysis_coverage[3])) / (
                              visual_coverage[2] - visual_coverage[3])
        else:
            ratio_x = 1
            ratio_y = 1
        print(ratio_x, ratio_y)
        parent_dir = os.path.dirname(movpath)
        downsample_video_binary(movpath, visual_coverage, analysis_coverage, shape=(ny, nx), chunk_size=1000,
                                ratios=(ratio_x, ratio_y))
        videodata = np.load(movpath[:-4] + '_downsampled.npy')
        videodata=videodata.astype(int)-np.logical_not(videodata).astype(int)
        waveletDecomposition(videodata, 0, sigmas, parent_dir, lib_path)
        waveletDecomposition(videodata, 1, sigmas, parent_dir, lib_path)
        messagebox.showinfo("wavelet transform", "Done!")

    # Fonction pour lancer les graphiques et afficher les résultats dans l'interface graphique
    def plot_data():
        # Fonction principale pour générer les graphiques

        try:
            path_directory = param_entries["Path Directory"].get()
            dirs = _parse_dirs(param_entries["Dirs"].get())
            exp_info = parse_literal(
                param_entries["Experiment Info"].get(),
                "Experiment Info",
            )
            sigmas = parse_literal(param_entries["Sigmas"].get(), "Sigmas")
            sigmas = np.array(sigmas)
            visual_coverage = parse_literal(
                param_entries["Visual Coverage"].get(),
                "Visual Coverage",
            )
            analysis_coverage = parse_literal(
                param_entries["Analysis Coverage"].get(),
                "Analysis Coverage",
            )
            n_planes = int(param_entries["Number of Planes"].get())
            block_end = int(param_entries["Block End"].get())
            screen_x = int(param_entries["screen_x"].get())
            screen_y = int(param_entries["screen_y"].get())
            nx = int(param_entries["NX"].get())
            ny = int(param_entries["NY"].get())
            ns = len(sigmas)
            resolution = float(param_entries["Resolution"].get())
            spks_path = param_entries["Spks Path"].get()
            nb_frames = int(param_entries["Number of Frames"].get())
            n_trial2keep = int(param_entries["Number of Trials to Keep"].get())
            movpath = param_entries["Movie Path"].get()
            lib_path = param_entries["Library Path"].get()
            screen_ratio = abs(visual_coverage[0] - visual_coverage[1]) / nx
            xM, xm, yM, ym = analysis_coverage
            n_theta = int(gabor_entries["N_thetas"].get())
        except Exception as e:
            messagebox.showerror("Error", f"Invalid input: {e}")
            return

        print(visual_coverage, sigmas, ns)
        print(exp_info)
        print(dirs)

        pathdata = os.path.join(
            dirs[0],
            exp_info[0],
            exp_info[1],
            str(exp_info[2]),
        )
        pathsuite2p = os.path.join(pathdata, 'suite2p')

        deg_per_pix = abs(xM - xm) / nx
        sigmas_deg = np.trunc(2 * deg_per_pix * sigmas * 100) / 100

        print(pathdata)
        print(pathsuite2p)
        if spks_path.strip().lower() in ("", "none", "null"):
            print('aligning datas')
            spks, spks_n, neuron_pos = loadSPKMesoscope(exp_info, dirs, pathsuite2p, block_end, n_planes, nb_frames,
                                                        threshold=1.25, last=True, method='frame2ttl')

            # ly = np.ceil(np.max(neuron_pos[:, 0]) / 3)
            # lx = np.ceil(np.max(neuron_pos[:, 1]))
            # n1 = neuron_pos[neuron_pos[:, 0] <= ly]
            # neuron_pos[np.logical_and(neuron_pos[:, 0] > ly, neuron_pos[:, 0] <= 2 * ly)] = neuron_pos[np.logical_and(
            #     neuron_pos[:, 0] > ly, neuron_pos[:, 0] <= 2 * ly)] + np.array([-ly, lx])
            # neuron_pos[neuron_pos[:, 0] > 2 * ly] = neuron_pos[neuron_pos[:, 0] > 2 * ly] + np.array([-2 * ly, 2 * lx])
            #
            # neuron_pos[:, 1]=abs(neuron_pos[:, 1]-1700)
            neuron_pos = correctNeuronPos(neuron_pos, resolution)
            neuron_pos[:, 1] = abs(neuron_pos[:, 1] - np.max(neuron_pos[:, 1]))
        else:
            print('loading spks file')
            try:
                spks = np.load(spks_path)
                parent_dir = os.path.dirname(spks_path)
                neuron_pos = np.load(os.path.join(parent_dir, 'pos.npy'))
            except Exception as e:
                messagebox.showerror("Error", f"File not found: {spks_path} {e}")

        respcorr = repetability_trial3(spks, neuron_pos, plotting=False)
        skewness = compute_skewness_neurons(spks, plotting=False)
        skewness = np.array(skewness)
        filter = np.logical_and(respcorr >= 0.2, skewness <= 20)

        for widget in frame_plot.winfo_children():
            widget.destroy()

        fig1, ax1 = plt.subplots(figsize=(6, 6))
        ax1.scatter(neuron_pos[:, 0], neuron_pos[:, 1], c='k', alpha=0.5, label="Neurons", picker=True)
        ax1.set_title("Neuron Positions (um)")

        fig2, ax2 = plt.subplots(figsize=(10, 1.5))
        ax2.set_title("Spike Train")

        fig3, ax3 = plt.subplots(1, 5, figsize=(15, 1.5))

        # Créer la figure et les axes pour le scatter plot
        # fig, ax = plt.subplots(figsize=(6, 6))
        # fig0, ax0 = plt.subplots(figsize=(15, 1.5))
        # Fonction de callback pour afficher les spikes quand un point est cliqué
        def onpick(event):
            ind = event.ind
            neuron_id = ind[0]
            ax2.clear()
            ax2.plot(np.mean(spks[:, :, neuron_id], axis=0), label=f"Neuron {neuron_id} Spike Times")
            ax2.legend()
            canvas2.draw()

            rf2d, x_tuning, y_tuning, ori_tun, s_tuning = PlotTuningCurve(rfs_gabor,
                                                                          neuron_id, analysis_coverage, sigmas_deg,
                                                                          screen_ratio,
                                                                          show=False)  # Appeler la fonction de tracé de corrélation
            ax3[0].clear()
            ax3[1].clear()
            ax3[2].clear()
            ax3[3].clear()
            ax3[4].clear()
            m = ax3[0].imshow(rf2d, cmap='coolwarm')
            # fig3.colorbar(m)
            ax3[0].set_xticks([0, rf2d.shape[1]], [xM, xm])
            ax3[0].set_yticks([0, rf2d.shape[0]], [yM, ym])
            ax3[0].set_title('2D')
            ax3[1].plot(x_tuning[::-1], c='k')
            ax3[1].set_title('Elevation (deg)')
            ax3[1].set_xticks([0, rf2d.shape[0]], [ym, yM])
            ax3[2].plot(y_tuning, c='k')
            ax3[2].set_title('Azimuth')
            ax3[2].set_xticks([0, rf2d.shape[1]], [xM, xm])
            ax3[3].plot(ori_tun, 'o-', c='k')
            ax3[3].set_title('Orientation')
            ax3[3].set_xticks([0, 4, 8], [0, 90, 180])
            ax3[4].plot(s_tuning, 'o-', c='k')
            ax3[4].set_title('Size (deg)')
            ax3[4].set_xticks([0, len(sigmas) - 1], [sigmas_deg[0], sigmas_deg[-1]])
            canvas3.draw()

        # Affichage dans l'interface
        canvas1 = FigureCanvasTkAgg(fig1, master=frame_plot)
        canvas1.draw()
        canvas1.get_tk_widget().pack(side=tk.TOP, fill=tk.BOTH, expand=True)
        plt.close(fig1)

        canvas2 = FigureCanvasTkAgg(fig2, master=frame_plot)
        canvas2.draw()
        canvas2.get_tk_widget().pack(side=tk.BOTTOM, fill=tk.BOTH, expand=True)
        plt.close(fig2)

        canvas3 = FigureCanvasTkAgg(fig3, master=frame_plot)
        canvas3.draw()
        canvas3.get_tk_widget().pack(side=tk.BOTTOM, fill=tk.BOTH, expand=True)
        plt.close(fig3)

        # Ajouter l'événement pour détecter les clics sur le scatter plot
        fig1.canvas.mpl_connect('pick_event', onpick)

        # Rendre les neurones sélectionnables (pickable)
        ax1.scatter(neuron_pos[:, 0], neuron_pos[:, 1], c='k', alpha=0.1, label="Neuron positions", picker=True)

        # Afficher le plot dans l'interface
        # canvas = FigureCanvasTkAgg(fig, master=frame1)
        # canvas.draw()
        # canvas.get_tk_widget().grid(row=0, column=1)
        #
        # canvas = FigureCanvasTkAgg(fig0, master=frame3)
        # canvas.draw()
        # canvas.get_tk_widget().grid(row=1, column=1)

        # Charger les fichiers de wavelet et afficher les résultats de corrélation
        parent_dir = path_directory
        print(parent_dir)
        try:
            wavelets_downsampled = np.load(os.path.join(parent_dir, 'dwt_downsampled_videodata.npy'))
            w_r_downsampled = wavelets_downsampled[0]
            w_i_downsampled = wavelets_downsampled[1]
            w_c_downsampled = wavelets_downsampled[2]
            del wavelets_downsampled
            gc.collect()
        except Exception as e:
            messagebox.showerror("Error", f"File not found: {e}")
            try:
                messagebox.showerror("running downsampling", f"File not found: {e}")
                w_r_downsampled, w_i_downsampled, w_c_downsampled = coarseWavelet(parent_dir, False, nx, ny, 27, 11,
                                                                                  n_theta, ns)
            except Exception as e:
                messagebox.showerror("Running wavelet decompositon on video", f"File not found: {e}")

                if (visual_coverage != analysis_coverage):
                    visual_coverage = np.array(visual_coverage)
                    analysis_coverage = np.array(analysis_coverage)
                    ratio_x = 1 - ((visual_coverage[0] - visual_coverage[1]) - (
                            analysis_coverage[0] - analysis_coverage[1])) / (
                                      visual_coverage[0] - visual_coverage[1])
                    ratio_y = 1 - ((visual_coverage[2] - visual_coverage[3]) - (
                            analysis_coverage[2] - analysis_coverage[3])) / (
                                      visual_coverage[2] - visual_coverage[3])

                else:
                    ratio_x = 1
                    ratio_y = 1

                downsample_video_binary(movpath, visual_coverage, analysis_coverage, shape=(ny, nx), chunk_size=1000,
                                        ratios=(ratio_x, ratio_y))
                videodata = np.load(movpath[:-4] + '_downsampled.npy')
                waveletDecomposition(videodata, 0, sigmas, parent_dir, library_path=lib_path)
                waveletDecomposition(videodata, 1, sigmas, parent_dir, library_path=lib_path)

                w_r_downsampled, w_i_downsampled, w_c_downsampled = coarseWavelet(parent_dir, False, nx, ny, 27, 11,
                                                                                  n_theta, ns)

        idx = 2441  # 2272
        n_frames = min(nb_frames, w_c_downsampled.shape[0], spks.shape[1])
        rfs_gabor = PearsonCorrelationPinkNoise(w_c_downsampled[:n_frames].reshape(n_frames, -1),
                                                np.mean(spks[:, :n_frames], axis=0),
                                                neuron_pos, 27, 11, ns, analysis_coverage, screen_ratio, sigmas_deg,
                                                plotting=True)

        fig10, ax10 = plt.subplots(1, 4, figsize=(15, 1.5))
        maxes1 = rfs_gabor[2]
        plt.rcParams['axes.facecolor'] = 'none'
        m = ax10[0].scatter(neuron_pos[:, 0], neuron_pos[:, 1], s=5, c=maxes1[0], cmap='jet', alpha=filter)
        fig10.colorbar(m)
        ax10[0].set_title('Azimuth (deg)')
        m = ax10[1].scatter(neuron_pos[:, 0], neuron_pos[:, 1], s=5, c=maxes1[1], cmap='jet_r', alpha=filter)
        fig10.colorbar(m)
        ax10[1].set_title('elevation (deg)')
        m = ax10[2].scatter(neuron_pos[:, 0], neuron_pos[:, 1], s=5, c=maxes1[2], cmap='hsv', alpha=filter)
        fig10.colorbar(m)
        ax10[2].set_title('Orientation (deg)')
        m = ax10[3].scatter(neuron_pos[:, 0], neuron_pos[:, 1], s=5, c=maxes1[3], cmap='coolwarm', alpha=filter)
        fig10.colorbar(m)
        ax10[3].set_title('Size (deg)')

        canvas4 = FigureCanvasTkAgg(fig10, master=frame_plot)
        canvas4.draw()
        canvas4.get_tk_widget().pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        plt.close(fig10)

        def export_plots():
            fig1.savefig("neuron_positions.svg")
            fig2.savefig("spike_train.svg")
            fig3.savefig("tuning_curves.svg")
            fig10.savefig("retinotopy.svg")
            messagebox.showinfo("Export", "Plots exported as SVG files.")

        # Bouton d'exportation
        btn_export = ttk.Button(frame_params, text="Export as SVG", command=export_plots)
        btn_export.grid(row=30, column=0, columnspan=2, pady=10)

        tk.Label(frame_params, text='neuron_ID', bg="white").grid(row=15, column=0, sticky="w", pady=2)
        entry = tk.Entry(frame_params, width=40)
        entry.insert(0, '1173')
        entry.grid(row=19, column=1, pady=2)
        param_entries['neuron_ID'] = entry

        def click_RF():
            neuron_id = int(param_entries["neuron_ID"].get())
            ax2.clear()
            ax2.plot(np.mean(spks[:, :, neuron_id], axis=0), label=f"Neuron {neuron_id} Spike Times")
            ax2.legend()
            canvas2.draw()

            rf2d, x_tuning, y_tuning, ori_tun, s_tuning = PlotTuningCurve(rfs_gabor,
                                                                          neuron_id, analysis_coverage, sigmas_deg,
                                                                          screen_ratio,
                                                                          show=False)
            ax3[0].clear()
            ax3[1].clear()
            ax3[2].clear()
            ax3[3].clear()
            ax3[4].clear()
            ax3[0].imshow(rf2d, cmap='coolwarm')
            ax3[0].set_xticks([0, rf2d.shape[1]], [xM, xm])
            ax3[0].set_yticks([0, rf2d.shape[0]], [yM, ym])
            ax3[0].set_title('2D')
            ax3[1].plot(x_tuning[::-1], c='k')
            ax3[1].set_title('Elevation (deg)')
            ax3[1].set_xticks([0, rf2d.shape[0]], [ym, yM])
            ax3[2].plot(y_tuning, c='k')
            ax3[2].set_title('Azimuth')
            ax3[2].set_xticks([0, rf2d.shape[1]], [xM, xm])
            ax3[3].plot(ori_tun, 'o-', c='k')
            ax3[3].set_title('Orientation')
            ax3[3].set_xticks([0, 4, 8], [0, 90, 180])
            ax3[4].plot(s_tuning, 'o-', c='k')
            ax3[4].set_title('Size (deg)')
            ax3[4].set_xticks([0, len(sigmas) - 1], [sigmas_deg[0], sigmas_deg[-1]])
            canvas3.draw()

        def click_save():
            np.save('correlation_matrix.npy', rfs_gabor[0])
            np.save('maxes_indices.npy', rfs_gabor[1])
            np.save('maxes_corrected.npy', rfs_gabor[2])

        btn_runRF = ttk.Button(frame_params, text="runRF", command=click_RF)
        btn_runRF.grid(row=20, column=0, columnspan=2, pady=10)

        btn_submit = ttk.Button(frame_params, text="save Ret", command=click_save)
        btn_submit.grid(row=21, column=0, columnspan=2, pady=10)

    def quit_app():
        root.quit()
        root.destroy()

    # Création de la fenêtre principale de l'interface
    root = tk.Tk()
    root.title("Neuron Analysis UI")
    root.geometry("1500x1500")
    root.configure(bg="white")

    # Cadre pour les log (bas)
    frame_log = ttk.LabelFrame(root, text="Terminal Output", padding=10)
    frame_log.pack(side=tk.BOTTOM, fill=tk.X, padx=10, pady=10)

    text_log = tk.Text(frame_log, height=10, bg="black", fg="white")
    text_log.pack(fill=tk.BOTH, expand=True)
    sys.stdout = RedirectText(text_log)
    sys.stderr = RedirectText(text_log)

    # Création d'un conteneur pour empiler frame_gabor et frame_params
    frame_left = ttk.Frame(root)
    frame_left.pack(side=tk.LEFT, fill=tk.Y, padx=10, pady=10)

    # Cadre pour les gabors (en haut)
    frame_gabor = ttk.LabelFrame(frame_left, text="Gabor Library", padding=10)
    frame_gabor.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

    # Cadre pour les paramètres (en dessous)
    frame_params = ttk.LabelFrame(frame_left, text="Model Parameters", padding=10)
    frame_params.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

    # Cadre pour les plots (droite)
    frame_plot = ttk.LabelFrame(root, text="Plots", padding=10)
    frame_plot.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=10, pady=10)
    frame_plot.configure(style="TFrame")

    # Appliquer un style blanc
    style = ttk.Style()
    # style.configure("TFrame", background="white")
    # style.configure("TLabel", background="white")
    # style.configure("TLabelFrame", background="white")
    available_themes = style.theme_names()
    # if "yaru" in available_themes:
    #     print('style exist')
    #     style.theme_use("default")
    # else:
    style.theme_use("clam")  # Thème de secours

    print(style.theme_names())
    # Personnalisation manuelle des widgets
    # style.configure("TButton", font=("Arial", 12), padding=6)
    # style.configure("TLabel", font=("Arial", 12), background="white")
    # style.configure("TFrame", background="white")
    # style.configure("TEntry", font=("Arial", 12), padding=5)
    # style.configure("TLabelFrame", font=("Arial", 12, "bold"), background="white")

    root.configure(bg="white")
    frame_params.configure(style="TFrame")
    frame_plot.configure(style="TFrame")

    param_entries = {}
    gabor_entries = {}

    for i, (label, default) in enumerate(param_defaults.items()):
        tk.Label(frame_params, text=label, bg="white").grid(row=i, column=0, sticky="w", pady=2)
        entry = tk.Entry(frame_params, width=40)
        entry.insert(0, default)
        entry.grid(row=i, column=1, pady=2)
        param_entries[label] = entry

    for i, (label, default) in enumerate(gabor_param.items()):
        tk.Label(frame_gabor, text=label, bg="white").grid(row=i, column=0, sticky="w", pady=2)
        entry = tk.Entry(frame_gabor, width=40)
        entry.insert(0, default)
        entry.grid(row=i, column=1, pady=2)
        gabor_entries[label] = entry

    btn_submit = ttk.Button(frame_gabor, text="Create Gabor lIbrary", command=create_gabor)
    btn_submit.grid(row=len(param_defaults) + 3, column=0, columnspan=2, pady=10)

    # Bouton de wavelet_transform
    btn_submit = ttk.Button(frame_params, text="Run wavelet", command=run_wavelet)
    btn_submit.grid(row=len(param_defaults) + 5, column=0, columnspan=2, pady=10)

    # Bouton de validation
    btn_submit = ttk.Button(frame_params, text="Run", command=plot_data)
    btn_submit.grid(row=len(param_defaults) + 6, column=0, columnspan=2, pady=10)

    btn_quit = ttk.Button(frame_params, text="Quit", command=quit_app)
    btn_quit.grid(row=40, column=0, columnspan=2, pady=10)

    root.mainloop()
