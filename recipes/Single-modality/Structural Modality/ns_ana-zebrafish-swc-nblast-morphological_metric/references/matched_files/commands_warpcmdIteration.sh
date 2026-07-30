# Source: commands/warpcmdIteration.sh
# Summary: See repo_context.md

#!/bin/bash

# passed REFBRAIN REGROOT REGBINDIR and MUNGERDIR variables
MY_HOST=`hostname`
LOCKID="$MY_HOST:$JOB_ID:$SGE_TASK_ID"
REFBRAIN=$1
REGROOT=$2
REGBINDIR=$3
MUNGERDIR=$4

cd $REGROOT
"$MUNGERDIR/munger.pl" -b "$REGBINDIR" -k $LOCKID -i -awr 01 -T 4 -X 26 -C 8 -G 80 -R 4 -A '--accuracy 0.4' -W '--accuracy 0.4' -s refbrain/"${REFBRAIN}".nrrd images
