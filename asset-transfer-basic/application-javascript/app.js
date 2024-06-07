/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('../../test-application/javascript/AppUtil.js');

const channelName = process.env.CHANNEL_NAME || 'mychannel'; //createChannel default가 mychannel
const chaincodeName = process.env.CHAINCODE_NAME || 'basic';

const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'javascriptAppUser';

function prettyJSONString(inputString) {
	return JSON.stringify(JSON.parse(inputString), null, 2);
}

// pre-requisites:
// - fabric-sample two organization test-network setup with two peers, ordering service,
//   and 2 certificate authorities
//         ===> from directory /fabric-samples/test-network
//         ./network.sh up createChannel -ca
// - Use any of the asset-transfer-basic chaincodes deployed on the channel "mychannel"
//   with the chaincode name of "basic". The following deploy command will package,
//   install, approve, and commit the javascript chaincode, all the actions it takes
//   to deploy a chaincode to a channel.
//         ===> from directory /fabric-samples/test-network
//         ./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-javascript/ -ccl javascript
// - Be sure that node.js is installed
//         ===> from directory /fabric-samples/asset-transfer-basic/application-javascript
//         node -v
// - npm installed code dependencies
//         ===> from directory /fabric-samples/asset-transfer-basic/application-javascript
//         npm install
// - to run this test application
//         ===> from directory /fabric-samples/asset-transfer-basic/application-javascript
//         node app.js

// NOTE: If you see  kind an error like these:
/*
    2020-08-07T20:23:17.590Z - error: [DiscoveryService]: send[mychannel] - Channel:mychannel received discovery error:access denied
    ******** FAILED to run the application: Error: DiscoveryService: mychannel error: access denied

   OR

   Failed to register user : Error: fabric-ca request register failed with errors [[ { code: 20, message: 'Authentication failure' } ]]
   ******** FAILED to run the application: Error: Identity not found in wallet: appUser
*/
// Delete the /fabric-samples/asset-transfer-basic/application-javascript/wallet directory
// and retry this application.
//
// The certificate authority must have been restarted and the saved certificates for the
// admin and application user are not valid. Deleting the wallet store will force these to be reset
// with the new certificate authority.
//

/**
 *  A test application to show basic queries operations with any of the asset-transfer-basic chaincodes
 *   -- How to submit a transaction
 *   -- How to query and check the results
 *
 * To see the SDK workings, try setting the logging to show on the console before running
 *        export HFC_LOGGING='{"debug":"console"}'
 */
async function main() {
	try {
		// build an in memory object with the network configuration (also known as a connection profile)
		const ccp = buildCCPOrg1();

		// build an instance of the fabric ca services client based on
		// the information in the network configuration
		const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');

		// setup the wallet to hold the credentials of the application user
		const wallet = await buildWallet(Wallets, walletPath);

		// in a real application this would be done on an administrative flow, and only once
		await enrollAdmin(caClient, wallet, mspOrg1);

		// in a real application this would be done only when a new user was required to be added
		// and would be part of an administrative flow
		await registerAndEnrollUser(caClient, wallet, mspOrg1, org1UserId, 'org1.department1');

		// Create a new gateway instance for interacting with the fabric network.
		// In a real application this would be done as the backend server session is setup for
		// a user that has been verified.
		const gateway = new Gateway();

		try {
			// setup the gateway instance
			// The user will now be able to create connections to the fabric network and be able to
			// submit transactions and query. All transactions submitted by this gateway will be
			// signed by this user using the credentials stored in the wallet.
			await gateway.connect(ccp, {
				wallet,
				identity: org1UserId,
				discovery: { enabled: true, asLocalhost: true } // using asLocalhost as this gateway is using a fabric network deployed locally
			});

			// Build a network instance based on the channel where the smart contract is deployed
			const network = await gateway.getNetwork(channelName);

			// Get the contract from the network.
			const contract = network.getContract(chaincodeName);

			// Initialize a set of asset data on the channel using the chaincode 'InitLedger' function.
			// This type of transaction would only be run once by an application the first time it was started after it
			// deployed the first time. Any updates to the chaincode deployed later would likely not need to run
			// an "init" type function.

			console.log('\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger');
			await contract.submitTransaction('InitLedger');
			console.log('*** Result: committed');

			// Let's try a query type operation (function).
			// This will be sent to just one peer and the results will be shown.
			//console.log('\n--> Evaluate Transaction: GetAllAssets, function returns all the current assets on the ledger');
			//let result = await contract.evaluateTransaction('GetAllTransactions');
			//console.log(`*** Result: ${prettyJSONString(result.toString())}`);
			
			console.log('\n--> 트랜스퍼 101');
			let result = await contract.submitTransaction('Transfer', 
				'7cafb40b30e8f7f0c8f57393e2ea63ff58a95907', 
				'f5c705db130ec0cbda536bfacc8e38425b427862', '7500000');
				
			console.log(`*** Result: ${prettyJSONString(result)}`);

			console.log('\n--> 트랜스퍼 102');
			result = await contract.submitTransaction('Transfer', 
				'1a677a3795f8a24b5dd99f83ea31f87595e25db1', 
				'18f1b4386f2e19e7dbf169ab2469c8fa8bc02976', '1000000');
			console.log(`*** Result: ${prettyJSONString(result)}`);

			console.log('\n--> 트랜스퍼 3');
			result = await contract.submitTransaction('Transfer', 
				'0a8077182848001f47826e249f5d8e821ea263bd', 
				'1a677a3795f8a24b5dd99f83ea31f87595e25db1', '100000');
			console.log(`*** Result: ${prettyJSONString(result)}`);

			console.log('\n--> 트랜스퍼 4');
			result = await contract.submitTransaction('Transfer', 
				'1a677a3795f8a24b5dd99f83ea31f87595e25db1', 
				'b284bea203a5c7e0fbae062650c067297579106a', '129000000');
			console.log(`*** Result: ${prettyJSONString(result)}`);

			console.log('\n--> 트랜스퍼 5');
			result = await contract.submitTransaction('Transfer', 
				'78e15f1699dbb6c8a438e90c02044cfa9b9233f3', 
				'17732863dbd50ee07039048d05d1a144297492b2', '220000000');
			console.log(`*** Result: ${prettyJSONString(result)}`);

			// console.log('\n--> Update User');
			// let aa = await contract.evaluateTransaction('UpdateUser','0a8077182848001f47826e249f5d8e821ea263bd','Age','88').catch((err) => {
			// 		console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
			// 		console.log(err.responses);
			// 	});
			// console.log(`*** Result: ${aa}`);
			
			// console.log('\n--> Check User');
			// let user = await contract.evaluateTransaction('GetUser','0a8077182848001f47826e249f5d8e821ea263bd');
			// console.log(`*** Result: ${prettyJSONString(user)}`);
		} finally {
			gateway.disconnect();
		}
	} catch (error) {
		console.error(`******** FAILED to run the application: ${error}`);
		process.exit(1);
	}
}


main();
