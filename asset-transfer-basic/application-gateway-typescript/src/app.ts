/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { TextDecoder } from 'util';

const channelName = envOrDefault('CHANNEL_NAME', 'mychannel');
const chaincodeName = envOrDefault('CHAINCODE_NAME', 'basic');
const mspId = envOrDefault('MSP_ID', 'Org1MSP');

// Path to crypto materials.
const cryptoPath = envOrDefault('CRYPTO_PATH', path.resolve(__dirname, '..', '..', '..', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com'));

// Path to user private key directory.
const keyDirectoryPath = envOrDefault('KEY_DIRECTORY_PATH', path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore'));

// Path to user certificate directory.
const certDirectoryPath = envOrDefault('CERT_DIRECTORY_PATH', path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts'));

// Path to peer tls certificate.
const tlsCertPath = envOrDefault('TLS_CERT_PATH', path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt'));

// Gateway peer endpoint.
const peerEndpoint = envOrDefault('PEER_ENDPOINT', 'localhost:7051');

// Gateway peer SSL host name override.
const peerHostAlias = envOrDefault('PEER_HOST_ALIAS', 'peer0.org1.example.com');

const utf8Decoder = new TextDecoder();
const assetId = `asset${Date.now()}`;

async function main(): Promise<any> {

    await displayInputParameters();

    // The gRPC client connection should be shared by all Gateway connections to this endpoint.
    const client = await newGrpcConnection();

    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        // Default timeouts for different gRPC calls
        evaluateOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        endorseOptions: () => {
            return { deadline: Date.now() + 15000 }; // 15 seconds
        },
        submitOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        commitStatusOptions: () => {
            return { deadline: Date.now() + 60000 }; // 1 minute
        },
    });

    try {
        const network = gateway.getNetwork(channelName);

        const contract = network.getContract(chaincodeName);

        await initLedger(contract);
	
	return contract;
    } finally {
        // gateway.close();
        // client.close();
    }
}

main().then((ctx: any) => {
	const express = require('express');
	const cors = require('cors');
	const app = express();
	const bodyParser = require('body-parser');
	const port = 3000;

	app.use(cors());
	app.use(bodyParser.urlencoded());
	app.use(bodyParser.json());

	app.get('/selectUserList', async (req: any, res: any) => {
		res.send(await getAllUsers(ctx));
	})

	app.get('/selectUser', async (req: any, res: any) => {
	        res.send(await getUser(ctx, req.query.userId));
	})

	app.post('/updateUser', async (req: any, res: any) => {
		res.send(await updateUser(ctx, req.body.Address, req.body.Balance, req.body.Age, req.body.Gender, req.body.Job, req.body.Status));
	})

	app.get('/selectTrxList', async (req: any, res: any) => {
		res.send(await getAllTransactions(ctx));
	})
	
	app.get('/selectTrx', async (req: any, res: any) => {
	        res.send(await getAllTransactions(ctx));
	})

	app.get('/selectWatchList', async (req: any, res: any) => {
		res.send(await getWatchList(ctx));
	})

	app.post('/insertTrx', async (req: any, res: any) => {
		res.send(await transfer(ctx, req.body).then(res => { return res }));
	})

	app.listen(port, () => {
		console.log(`Example app listening on port ${port}`)
	})
}).catch(error => {
    console.error('******** FAILED to run the application:', error);
    process.exitCode = 1;
});

async function newGrpcConnection(): Promise<grpc.Client> {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function newIdentity(): Promise<Identity> {
    const certPath = await getFirstDirFileName(certDirectoryPath);
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

async function getFirstDirFileName(dirPath: string): Promise<string> {
    const files = await fs.readdir(dirPath);
    return path.join(dirPath, files[0]);
}

async function newSigner(): Promise<Signer> {
    const keyPath = await getFirstDirFileName(keyDirectoryPath);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

/**
 * This type of transaction would typically only be run once by an application the first time it was started after its
 * initial deployment. A new version of the chaincode deployed later would likely not need to run an "init" function.
 */
async function initLedger(contract: Contract): Promise<void> {
    console.log('\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger');

    await contract.submitTransaction('InitLedger');

    console.log('*** Transaction committed successfully');
}

/**
 * Evaluate a transaction to query ledger state.
 */
async function getAllAssets(contract: Contract): Promise<any> {
    console.log('\n--> Evaluate Transaction: GetAllAssets, function returns all the current assets on the ledger');

    const resultBytes = await contract.evaluateTransaction('GetAllAssets');

    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log('*** Result:', result);

    return result;
}

async function getAllUsers(contract: Contract): Promise<any> {
       	const resultBytes = await contract.evaluateTransaction('GetAllUsers');
        const resultJson = utf8Decoder.decode(resultBytes);
        const result = JSON.parse(resultJson);
        return result;
}

async function getUser(contract: Contract, userId: string): Promise<any> {
	const resultBytes = await contract.evaluateTransaction('GetUser', userId);
        const resultJson = utf8Decoder.decode(resultBytes);
        const result = JSON.parse(resultJson);
	return result;
}

async function updateUser(contract: Contract, address: string, balance: string, age: string, gender: string, job: string, status: string): Promise<any>{
	return await contract.submitTransaction('UpdateUser', address, balance, age, gender, job, status);
}

async function getAllTransactions(contract: Contract): Promise<any> {
        const resultBytes = await contract.evaluateTransaction('GetAllTransactions');
        const resultJson = utf8Decoder.decode(resultBytes);
        const result = JSON.parse(resultJson);
        return result;
}

async function getWatchList(contract: Contract): Promise<any> {
        const resultBytes = await contract.evaluateTransaction('GetWatchList');
        const resultJson = utf8Decoder.decode(resultBytes);
        const result = JSON.parse(resultJson);
        return result;
}

async function transfer(contract: Contract, payload: any): Promise<any> {
	let result = await contract.submitTransaction('Transfer', payload.sender.trim(), payload.receiver.trim(), payload.amount.toString().trim());
	let result2 = Object.keys(result).map((key: any) => String.fromCharCode(result[key])).join('');
	console.log(result2);

	return result2;
}

/**
 * envOrDefault() will return the value of an environment variable, or a default value if the variable is undefined.
 */
function envOrDefault(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
}

/**
 * displayInputParameters() will print the global scope parameters used by the main driver routine.
 */
async function displayInputParameters(): Promise<void> {
    console.log(`channelName:       ${channelName}`);
    console.log(`chaincodeName:     ${chaincodeName}`);
    console.log(`mspId:             ${mspId}`);
    console.log(`cryptoPath:        ${cryptoPath}`);
    console.log(`keyDirectoryPath:  ${keyDirectoryPath}`);
    console.log(`certDirectoryPath: ${certDirectoryPath}`);
    console.log(`tlsCertPath:       ${tlsCertPath}`);
    console.log(`peerEndpoint:      ${peerEndpoint}`);
    console.log(`peerHostAlias:     ${peerHostAlias}`);
}
