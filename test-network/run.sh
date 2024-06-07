#!/bin/bash
#원본은 ci/scripts/run-test-network-basic.sh 참고할 것
set -euo pipefail

function print() {
	GREEN='\033[0;32m'
  NC='\033[0m'
  echo
	echo -e "${GREEN}${1}${NC}"
}

function createNetwork() {
  print "Creating 3 Org network"
  #./network.sh up createChannel -ca
  ./network.sh up createChannel -c mychannel -ca
}

function deployChaincode() {
  print "Deploying chaincode"
  #./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-typescript/ -ccl typescript
  ./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-javascript/ -ccl javascript
}

function stopNetwork() {
  print "Stopping network"
  ./network.sh down
}

# print all executed commands to assist with debug in CI environment
set -x

# Run Javascript application
createNetwork
print "Initializing Javascript application"
deployChaincode
pushd ../asset-transfer-basic/application-javascript
rm -rf ./wallet
npm install
print "Executing app.js"
node app.js
popd

# # Run typescript application
# print "Initializing Typescript application"
# deployChaincode
# pushd ../asset-transfer-basic/application-typescript
# npm install
# print "Building app.ts"
# npm run build
# print "Running the output app"
# rm -rf dist/wallet
# node dist/app.js
# popd

stopNetwork

{ set +x; } 2>/dev/null
