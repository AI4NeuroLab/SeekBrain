# Source: Documentation/Documentation.md
# Summary: See repo_context.md


# NEUROCARTA 
***A Toolbox for Reconstruction and Analysis of Neural Networks***  
  
## About  
Neurocarta is a MATLAB/Octave toolbox for the reconstruction and analysis of neural networks. It utilizes data from the [Allen Mouse Brain Connectivity Atlas](https://connectivity.brain-map.org) (AMBCA), a database featuring of quantifications of targeted neuronal projections throughout the mouse brain. These quantifications are extracte from imaging experiments where fluorescent protein expressing viral tracers are injected in anatomically defined brain areas. At the time of writing the AMBCA consists of 2917 experiments.

Neurocarta compiles the neuronal projections data into network representations of the anatomical connectivity in the mouse brain. It also provides functionality to further analyze said networks using graph theoretical tools, and to investigate individual experiments from the AMBCA. A publication is currently being written to illustrate how Neurocarta can be used in research.
  
## General workflow and file organization  
  
![Neurocarta flow chart](https://raw.githubusercontent.com/DepartmentofNeurophysiology/Neurocarta/refs/heads/main/Documentation/flowchart.png)

Installing the toolbox is done by using `git clone` or simply downloading from Github. All necessary code is contained in the Toolbox folder. The repository contains some pre-existing data that cannot be downloaded; a manually compiled list of nodes to use for network compilation. The file **startup.m** is automatically ran when starting MATLAB in the toolbox folder, and adds all the necessary directories to the search path.

Build the database by running **build_database**, this downloads and imports acomplete AMBCA (stored in Data) and metadata (stored in Structures). One can download only a subset of the AMBCA using the search function on their website and storing the result in a custom experiments.csv file placed in the Structures directory. The build_database function is stoppable and will pick up where it left when restarted.

Once installed, individual experiments can be visualized using the **autocorrelatemap** function and compared with **crosscorrelatemaps**. Moving on, use **loadmap** to compile a network from the projections data. This function returns a bilateral adjacency matrix where every entry `(i, j)` represents the normalized axonal density originating in structure `i`, and targeting structure `j`. This matrix is used for further analysis and can be entered into the various functions found in the Networks_analysis folder.
  
## Functions  
For a detailed description and syntax of each function, type ```help <function>``` in MATLAB or Octave.  
  
### Build

Function|Description
---|---
build_database | Download and import entire AMBCA including metadata
  
### Experiments

Function|Description
---|---
autocorrelatemap|Create figure with overview of experiment statistics
crosscorrelatemaps|Create figure with comparative overview of two experiments
findexperiments|Find experiments that satisfy certain conditions
groupexperiments|Group experiments into a single representation by averaging
autothreshold|Filter weak projections from an experiment


### Network construction

Function|Description
---|---
findarea|Find area by (partial) name
loadmap|Compile experiment files into single network
generatemaps|Calls `loadmap` with many different parameters
filtermap|Filter weak connections from network
trimmap|Remove any disconnected nodes from network

### Network analysis

Function|Description
---|---
getdegree|Returns node degree (number of incoming/outgoing connections)
shortestpath|Computes the shortest path between a pair of nodes
getpathlength|Returns the length (weight) of a given path
getpaths|Compute shortest path between all node pairs
getsynapses|Computes degree of separation between nodes
getcentrality|Returns betweenness centrality measure for nodes in the network
kshortestpaths|Computes the K shortest paths a pair of nodes
getkpaths|Computes the K shortest paths between all node pairs
macromap|Returns adjacency matrix with averaged connectivity between larger brain regions
exportnetwork|Exports network data to GEXF file format suitable for network visualization software
