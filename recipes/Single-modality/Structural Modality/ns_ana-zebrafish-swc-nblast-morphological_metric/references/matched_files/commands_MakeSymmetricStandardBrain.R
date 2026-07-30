# Source: commands/MakeSymmetricStandardBrain.R
# Summary: See repo_context.md

# A script to take the shape averge brains produced by makeAverageBrain.sh
# and center them around the YZ ie saggital plane

# Steps
# 1. Duplicate and flip the original image
# 2. Calculate an affine registration of the brain against flipped itself
# 3. Read in that registration
# 4. Halve the affine transformation 
# 5. Apply that registration to the raw average brain to generate the nicely
#    centred brain
argPath=commandArgs(trailingOnly = TRUE)

NEWREFPATH = argPath[1]
SYMREFPATH = argPath[2]
AXIS       = argPath[3]

# for cmtk.reformatx
if(!require(nat)) stop('Please run:\ninstall.packages("nat")\nin R!')
# for RunCmdForNewerInput
if(!require(nat.utils)) stop('Please run:\ninstall.packages("nat.utils")\nin R!')

AXIS = if(is.na(AXIS)) "x" else tolower(AXIS)

if(!AXIS%in%c("x","y","z"))
  stop("Unable to parse axis specification") 

MakeFlippedImage<-function(infile,outfile,axis="x"){
	if(missing(outfile))
		outfile=sub("\\.[^.]+$","-flip.nrrd",infile)
	cmd=paste("convertx --flip-",axis,sep=""," ",shQuote(infile)," ",shQuote(outfile))
	result=RunCmdForNewerInput(cmd,infile,outfile)
	return(outfile)
}

CalculateRegistration<-function(template,floating,outfolder,threads=8){
	Sys.setenv(CMTK_NUM_THREADS=threads)
	# nb translate and rotate only, no scale or shear
	cmd=paste("registration -i -v --dofs 6 --outlist",shQuote(outfolder),shQuote(template),shQuote(floating))
	# nb the output file will be called registration and sit inside outfolder
	outfile=file.path(outfolder,"registration")
	result=RunCmdForNewerInput(cmd,c(template,floating),outfile)
	return(outfolder)
}

MakeHalvedAffineRegistration<-function(infolder,outfolder){
	if(missing(outfolder))
		outfolder=sub("\\.list","-halved.list",infolder)
	
	reg=read.cmtkreg(infolder)
	reg$registration$affine_xform$xlate=reg$registration$affine_xform$xlate/2
	reg$registration$affine_xform$rotate=reg$registration$affine_xform$rotate/2
	# only write a CMTK version 2.4 registration if we have CMTK >=3.0 available
	cmtkv3=isTRUE(as.integer(substring(cmtk.dof2mat(version=TRUE),1,1))>=3)
	write.cmtkreg(reg,outfolder,version=ifelse(cmtkv3,'2.4',NA))
	return(outfolder)
}

# debug(MakeHalvedAffineRegistration)
MakeSymmetricStandardBrain<-function(rawimage,symmetricimage, axis="x"){
	flippedimage=MakeFlippedImage(rawimage, axis=axis)
	
	imagestem=sub("\\.[^.]+$","",basename(rawimage))
	flippedimagestem=sub("\\.[^.]+$","",basename(flippedimage))
	regfolder=file.path(dirname(dirname(rawimage)),"Registration",
		paste(flippedimagestem,"_",imagestem,".list",sep=""))
	regfolder=CalculateRegistration(flippedimage,rawimage,regfolder)

	halvedregfolder=MakeHalvedAffineRegistration(regfolder)

	cmtk.reformatx(floating=rawimage,target=rawimage,registrations=halvedregfolder,
		output=symmetricimage)
}

MakeSymmetricStandardBrain(NEWREFPATH, SYMREFPATH, AXIS)
