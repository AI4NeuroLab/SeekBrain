# Source: motif_analysis.py
# Summary: See repo_context.md

# -*- coding: utf-8 -*-

import numpy as np
import pandas as pd
import networkx as nx
import matplotlib.pyplot as plt
import sys
import itertools
import json

File_name=['all_region_region_complete_projection_length_Excitatory.csv',
'all_region_region_complete_projection_length_Inhibitory.csv']

############################

# three regions

# 构建E和I的网络

if 1:
    df_excitatory = (pd.read_csv(File_name[0],index_col=0))
    temp_column_1 = list(df_excitatory.columns)
    unweighted_G_E = nx.DiGraph()
    temp_nodes_list= temp_column_1
    for i in range(len(temp_nodes_list)):
        for j in range(len(temp_nodes_list)):
            if i==j:
                continue;
            if df_excitatory[temp_nodes_list[j]][temp_nodes_list[i]]>0:
                unweighted_G_E.add_edges_from([(temp_nodes_list[i],temp_nodes_list[j])])


if 1:
    df_inhibitory = (pd.read_csv(File_name[1],index_col=0))
    temp_column_1 = list(df_inhibitory.columns)
    unweighted_G_I = nx.DiGraph()
    temp_nodes_list= temp_column_1
    for i in range(len(temp_nodes_list)):
        for j in range(len(temp_nodes_list)):
            if i==j:
                continue;
            if df_inhibitory[temp_nodes_list[j]][temp_nodes_list[i]]>0:
                unweighted_G_I.add_edges_from([(temp_nodes_list[i],temp_nodes_list[j])])



###### to calculate motifs

## We define each S* motif as a directed graph in networkx
 # 定义13个motifs
motifs = {
    'S1': nx.DiGraph([(1,2),(1,3)]),
    'S2': nx.DiGraph([(1,2),(3,1)]),
    'S3': nx.DiGraph([(1,2),(1,3),(3,1)]),
    'S4': nx.DiGraph([(1,2),(3,2)]),
    'S5': nx.DiGraph([(1,2),(1,3),(3,2)]),
    'S6': nx.DiGraph([(1,2),(1,3),(3,1),(3,2)]),
    'S7': nx.DiGraph([(2,1),(1,3),(3,1)]),
    'S8': nx.DiGraph([(1,2),(1,3),(3,1),(2,1)]),
    'S9': nx.DiGraph([(2,1),(1,3),(3,2)]),
    'S10': nx.DiGraph([(1,2),(1,3),(2,1),(3,2)]),
    'S11': nx.DiGraph([(1,2),(2,1),(3,1),(3,2)]),
    'S12': nx.DiGraph([(1,2),(2,1),(1,3),(3,1),(3,2)]),
    'S13': nx.DiGraph([(1,2),(2,1),(1,3),(3,1),(3,2),(2,3)])
}

# 画出13个motfs的图片

for i in motifs:
    plt.clf()
    plt.title('Motifs '+i)
    nx.draw(motifs[i], with_labels=True);
    plt.savefig('Motifs_figures_'+i+'.pdf')
    plt.show()

def mcounter(gr, mo):
    """Counts motifs in a directed graph
        :param gr: A ``DiGraph`` object
        :param mo: A ``dict`` of motifs to count
        :returns: A ``dict`` with the number of each motifs, with the same keys as ``mo``
        This function is actually rather simple. It will extract all 3-grams from
        the original graph, and look for isomorphisms in the motifs contained
        in a dictionary. The returned object is a ``dict`` with the number of
        times each motif was found.::
        >>> print mcounter(gr, mo)
        {'S1': 4, 'S3': 0, 'S2': 1, 'S5': 0, 'S4': 3}
        """
    #This function will take each possible subgraphs of gr of size 3, then
    #compare them to the mo dict using .subgraph() and is_isomorphic
    #This line simply creates a dictionary with 0 for all values, and the
    #motif names as keys
    mcount = dict(zip(mo.keys(), list(map(int, np.zeros(len(mo))))))
    nodes = gr.nodes()
    #We use iterools.product to have all combinations of three nodes in the
    #original graph. Then we filter combinations with non-unique nodes, because
    #the motifs do not account for self-consumption.
    triplets = list(itertools.product(*[nodes, nodes, nodes]))
    triplets = [trip for trip in triplets if len(list(set(trip))) == 3]
    triplets = map(list, map(np.sort, triplets))
    u_triplets = []
    [u_triplets.append(trip) for trip in triplets if not u_triplets.count(trip)]
    #The for each each of the triplets, we (i) take its subgraph, and compare
    #it to all fo the possible motifs
    temp__number=0
    for trip in u_triplets:
        temp__number = temp__number+1;
        print temp__number,len(u_triplets), temp__number/(len(u_triplets)*1.0);
        sub_gr = gr.subgraph(trip)
        mot_match = map(lambda mot_id: nx.is_isomorphic(sub_gr, mo[mot_id]), motifs.keys())
        match_keys = [mo.keys()[i] for i in range(len(mo)) if mot_match[i]]
        if len(match_keys) == 1:
            mcount[match_keys[0]] += 1
    return mcount


# 这边我们计算13个motifs的结果
mcount_E = mcounter(unweighted_G_E,motifs)
mcount_I = mcounter(unweighted_G_I,motifs)

# 把针对E和I神经元的motifs的数目，进行保存

file_name = open("mcount_E.json", "w")
json.dump(mcount_E, file_name)
file_name.close()

file_name = open("mcount_I.json", "w")
json.dump(mcount_I, file_name)
file_name.close()


plt.bar(range(len(mcount_E)), list(mcount_E.values()), align='center',color='red',alpha=0.5,label='E')

plt.bar(range(len(mcount_I)), list(mcount_I.values()), align='center',color='blue',alpha=0.5,label='I')

plt.xticks(range(len(mcount_I)), list(mcount_I.keys()))
plt.legend()
plt.xlabel('Motifs',fontsize=15)
plt.ylabel('Number of motifs',fontsize=15)
plt.savefig('Figures_4_three_regions.pdf')
plt.show()



######## 第5种情况，Recurrent loops 的计算

# 首先计算，某一个节点的奥其他所有节点的最短路径
# 之后计算最短路径长度的比例！

temp_shortest_length_E =nx.shortest_path(unweighted_G_E)
temp_shortest_length_I =nx.shortest_path(unweighted_G_I)


temp_count_loopsLength_E=np.zeros(10)
temp_count_loopsLength_I=np.zeros(10)

for i in temp_shortest_length_E:
    for j in temp_shortest_length_E[i]:
        print i,j,len(temp_shortest_length_E[i][j])
        temp_count_loopsLength_E[len(temp_shortest_length_E[i][j])] +=1

for i in temp_shortest_length_I:
    for j in temp_shortest_length_I[i]:
        print i,j,len(temp_shortest_length_I[i][j])
        temp_count_loopsLength_I[len(temp_shortest_length_I[i][j])] +=1


print temp_count_loopsLength_E/(np.sum(temp_count_loopsLength_E)*1.0)
print temp_count_loopsLength_I/(np.sum(temp_count_loopsLength_I)*1.0)

print temp_count_loopsLength_E
print temp_count_loopsLength_I


plt.bar(np.arange(10),temp_count_loopsLength_E/(np.sum(temp_count_loopsLength_E)*1.0),color='red',alpha=0.4,label='E')
plt.bar(np.arange(10),temp_count_loopsLength_I/(np.sum(temp_count_loopsLength_I)*1.0),color='blue',alpha=0.4,label='I')

plt.legend()
plt.xlabel('loop length',fontsize=15)
plt.ylabel('percentage',fontsize=15)
plt.savefig('Figures_5_RecurrentLoops.pdf')

plt.show()


########################接下来计算网络通讯的有效性



####### 保存每个motifs所对应的 信息；

def mcounter_motifs(gr, mo):
    #This function will take each possible subgraphs of gr of size 3, then
    #compare them to the mo dict using .subgraph() and is_isomorphic
    #This line simply creates a dictionary with 0 for all values, and the
    #motif names as keys
    mcount_motifs = dict(zip(mo.keys(), [[]]*len(mo.keys())))
    nodes = gr.nodes()
    #We use iterools.product to have all combinations of three nodes in the
    #original graph. Then we filter combinations with non-unique nodes, because
    #the motifs do not account for self-consumption.
    triplets = list(itertools.product(*[nodes, nodes, nodes]))
    triplets = [trip for trip in triplets if len(list(set(trip))) == 3]
    triplets = map(list, map(np.sort, triplets))
    u_triplets = []
    [u_triplets.append(trip) for trip in triplets if not u_triplets.count(trip)]
    #The for each each of the triplets, we (i) take its subgraph, and compare
    #it to all fo the possible motifs
    temp__number=0
    for trip in u_triplets:
        temp__number = temp__number+1;
        print temp__number,len(u_triplets), temp__number/(len(u_triplets)*1.0);
        sub_gr = gr.subgraph(trip)
        mot_match = map(lambda mot_id: nx.is_isomorphic(sub_gr, mo[mot_id]), motifs.keys())
        match_keys = [mo.keys()[i] for i in xrange(len(mo)) if mot_match[i]]
        if len(match_keys) == 1:
            #mcount_motifs[match_keys[0]].append(trip)
            temp_list = list(np.copy(mcount_motifs[match_keys[0]]))
            temp_list.append(trip)
            mcount_motifs[match_keys[0]] = temp_list
    return mcount_motifs


### 把结果保存在 以下dictionary中

mcount_motifs_E = mcounter_motifs(unweighted_G_E, motifs)
mcount_motifs_I = mcounter_motifs(unweighted_G_I, motifs)

for i in mcount_motifs_E:
    print i, len(mcount_motifs_E[i]), mcount_motifs_E[i]


for i in mcount_motifs_I:
    print i, len(mcount_motifs_I[i]), mcount_motifs_I[i]

########################

# 删除 3个节点之后，看网络属性的变化

def Fun_perturbation_motifs(temp_unweighted_G, temp_mcount_motifs, motifs_index):
    temp_list_network_properties_random=[]
    for i in range(100): # 随机删除100次
        temp_Graph = nx.DiGraph.copy(temp_unweighted_G)
        temp_Graph = temp_Graph.to_undirected()
        temp_list_nodes = list(temp_Graph.nodes())
        np.random.shuffle(temp_list_nodes)
        random_selected_nodes =temp_list_nodes[:3]
        temp_Graph.remove_nodes_from(random_selected_nodes)
        if nx.is_connected(temp_Graph)==False:
            continue;
        temp_val = nx.average_shortest_path_length(temp_Graph)
        temp_list_network_properties_random.append(temp_val)
    temp_list_network_properties_motifs=[]
    for i in range(100): # 删除motifs 100次
        temp_Graph = nx.DiGraph.copy(temp_unweighted_G)
        temp_Graph = temp_Graph.to_undirected()
        temp_index = np.arange(len(temp_mcount_motifs[motifs_index]))
        np.random.shuffle(temp_index)
        temp_random_index = temp_index[0]
        random_selected_nodes = temp_mcount_motifs[motifs_index][temp_random_index]
        temp_Graph.remove_nodes_from(random_selected_nodes)
        if nx.is_connected(temp_Graph)==False:
            continue;
        temp_val = nx.average_shortest_path_length(temp_Graph)
        temp_list_network_properties_motifs.append(temp_val)
    return temp_list_network_properties_random, temp_list_network_properties_motifs


xx =Fun_perturbation_motifs(unweighted_G_E,mcount_motifs_E,'S9')

plt.hist(xx[0],color='red',label='Random')

plt.hist(xx[1],color='blue',label='Motifs')

plt.legend()

plt.show()

#####


