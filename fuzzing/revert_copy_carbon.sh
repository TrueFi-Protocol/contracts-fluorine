rm -rf contracts/contracts-carbon
perl -i -pe's+"../contracts-carbon/+"contracts-carbon/contracts/+g' contracts/**/*.sol
