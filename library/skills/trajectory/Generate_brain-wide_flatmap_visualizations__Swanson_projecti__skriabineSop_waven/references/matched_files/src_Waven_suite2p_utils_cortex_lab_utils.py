# Source: src/Waven/suite2p/utils/cortex_lab_utils.py
# Summary: See repo_context.md

# -*- coding: utf-8 -*-
"""
Created on Fri Jul 10 15:31:38 2020

General utility functions for cortex lab experiments

@author: Samuel Failor
"""

from os.path import join
from os.path import exists
import os
from datetime import datetime as dt

    
dirs = [
        # r'//znas.cortexlab.net/Subjects/',
        # r'//zubjects.cortexlab.net/Subjects/',
        # r'//zserver.cortexlab.net/Data/Subjects/',
        # r'//zserver.cortexlab.net/Data/trodes/',
        # r'//zserver.cortexlab.net/Data/expInfo/',
        r'/mnt/z/',
        r'/mnt/c/ali/data/',
        r'/mnt/c/bulk/cortexlab/Subjects',
        r'X:\Subjects',
        r'Y:\Subjects']
        # r'C:\ali\data\Subjects']

def expt_dirs():
    
    return dirs

def get_subject_log(subject):
    exp_path = find_expt_file((subject, '', ''),'subject' )
    mpep_logpath = os.path.join(exp_path, subject + '.txt')
    log = open(mpep_logpath).read()
    return log

def parse_log(log, subject): 
    series = []
    in_series = False
    line_num = 0
    exp_id = 0
    latest_pfile = ''
    for line in log:
        if "Loaded parameter file" in line:
            latest_pfile = line.split('\\')[-1]

        elif 'Starting Series' in line:
            if in_series: series.pop()
            in_series = True
            exp = {
            'overall_id' : exp_id,
            'subject' : subject,
            'date' : line.split(' ')[5],
            'num'  : line.split(' ')[7],
            'pfile' : latest_pfile,
            'log'   : [],
            'start' : line.split(' ')[1],
            'end'  : -1,
            'dur'  : -1
            }
            exp['id_str'] = exp['uid'] = subject + '_' + exp['date'] + '_' + exp['num']
            exp['id_tuple'] = (subject, exp['date'], int(exp['num']))
            
            series.append(exp)
            # latest_pfile = ''
    #         break
        elif 'Completed' in line:
            in_series = False
            exp_id += 1
            series[-1]['end'] = line.split(' ')[1]
            series[-1]['dur'] = (dt.strptime(series[-1]['end'],'%H:%M') - dt.strptime(series[-1]['start'],'%H:%M')).total_seconds()
        elif 'Interrupted' in line:
            series[-1]['log'].append(line)
        line_num += 1
    return series

def find_expt_file(expt_info,file, dirs = None, verbose = False):
    
    subject, expt_date, expt_num = expt_info
       
    file_names = {'timeline' : join(subject, expt_date, str(expt_num),
                                    '_'.join([expt_date,str(expt_num),subject,
                                              'Timeline.mat'])),
                 'protocol' : join(subject, expt_date, str(expt_num), 
                                  'Protocol.mat'),
                 'block' : join(subject, expt_date, str(expt_num),
                                    '_'.join([expt_date,str(expt_num),subject,
                                              'Block.mat'])),
                 'suite2p' : join(subject, expt_date, 'suite2p'),
                 'facemap' : join(subject, expt_date, str(expt_num),
                                    '_'.join([expt_date,str(expt_num),subject,
                                              'eye_proc.npy'])),
                 'eye_log' : join(subject, expt_date, str(expt_num),
                                    '_'.join([expt_date,str(expt_num),subject,
                                              'eye.mat'])),
                 'eye_video' : join(subject, expt_date, str(expt_num),
                                    '_'.join([expt_date,str(expt_num),subject,
                                              'eye.mj2'])),
                 'root' : join(subject,expt_date,str(expt_num)),
                 'date' : join(subject,expt_date),
                 'pfile': join(subject, expt_date, str(expt_num),
                                    '_'.join([subject,expt_date,str(expt_num)
                                              ]) + '.p'),
                 'subject' : subject}
    
                              
    file_name = file_names.get(file.lower(), 'invalid')
    print(file_name)
    if file_name == 'invalid':
        print('File type is invalid. Valid file types are ' 
              + str(list(file_names.keys())))
        return

    if dirs is None:            
        dirs = expt_dirs()
    # print(file_name)
    for d in dirs:
        if verbose:
             print("Looking for %s in %s" % (file_name, d))
        # if verbose: print("Looking for: ", print(os.path.join(d,file_name)))F
        if exists(join(d,file_name)):
            file_path = join(d,file_name)
            if verbose: print("Found")
            # print(file_path)
            break
    
    if 'file_path' in locals():
        return file_path
    else: 
        print('File could not be found! Be sure that ' + 
              'cortex_lab_utils.expt_dirs() includes all valid directories.')


def get_expt_tuple_from_df(exps_df, overall_id):
    row = exps_df[exps_df['overall_id'] == overall_id]
    subject = row['subject'].values[0]
    date = row['date'].values[0]
    exp_num = int(row['num'].values[0])
    return(subject, date, exp_num)
    