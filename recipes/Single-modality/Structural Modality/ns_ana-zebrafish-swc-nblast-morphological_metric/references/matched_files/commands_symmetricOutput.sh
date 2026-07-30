# Source: commands/symmetricOutput.sh
# Summary: See repo_context.md

#!/usr/bin/env bash

#$ -l h_vmem=6G

NEWREFPATH=$1
SYMREFPATH=$2
AXIS=$3

# since we are not qsubbing this any more, should just inherit path of main script
echo "PATH=$PATH"

# should already be here
# cd "$REGROOT/commands"

R --no-save --args ${NEWREFPATH} ${SYMREFPATH} ${AXIS} < MakeSymmetricStandardBrain.R
