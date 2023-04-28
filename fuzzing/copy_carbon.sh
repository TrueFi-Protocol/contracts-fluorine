perl -i -pe's+"contracts-carbon/contracts/+"../contracts-carbon/+g' contracts/**/*.sol
cp -r ../contracts-carbon/contracts contracts/contracts-carbon
