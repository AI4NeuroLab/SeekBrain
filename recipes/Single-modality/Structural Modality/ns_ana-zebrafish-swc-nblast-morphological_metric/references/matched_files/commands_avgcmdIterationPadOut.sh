# Source: commands/avgcmdIterationPadOut.sh
# Summary: See repo_context.md

#!/bin/sh
# 2009-05-18 15:36:03 BST
REFBRAIN=$1
AVGBRAIN=$2
REGROOT=$3
REGBINDIR=$4

MY_HOST=`hostname`
LOCKID="$MY_HOST:$JOB_ID"

export CMTK_NUM_THREADS=8
cd $REGROOT
# Collect up the registration files we want
# NB use echo so that shell expands *.list
# REGROOT is quoted so that spaces can be used (so though not a clever idea ...)
REGFILES=`echo "${REGROOT}"/Registration/warp/${REFBRAIN}*.list`
echo "Averaging the following registration files $REGFILES"

"${REGBINDIR}/avg_adm" --verbose --cubic --ushort --auto-scale --no-ref-data \
--pad-out 0 --output-warp "$REGROOT/average/$AVGBRAIN" \
-o NRRD:"$REGROOT/refbrain/$AVGBRAIN.nrrd" $REGFILES
