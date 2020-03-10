const assert = require('assert');
const { Tezos } = require('@taquito/taquito');
const { InMemorySigner } = require('@taquito/signer');
const BigNumber = require("bignumber.js");

const utils = require('./utils');
const { tokenAmountInUnits, unitsInTokenAmount} = utils;

const contractDeploy = require('../deployed/fa12_latest.json');
const faucetA = require('../faucetA.json');
const faucetB = require('../faucetB.json');

const signerFaucetA = InMemorySigner.fromFundraiser(faucetA.email, faucetA.password, faucetA.mnemonic.join(' '));
const signerFaucetB = InMemorySigner.fromFundraiser(faucetB.email, faucetB.password, faucetB.mnemonic.join(' '));

const rpc = 'https://api.tez.ie/rpc/babylonnet';
//const rpc = 'https://rpctest.tzbeta.net';

Tezos.setProvider({ rpc, signer: signerFaucetA });

const getStorage = async (address, keys) => {
    const contract = await Tezos.contract.at(address);
    const storage = await contract.storage();
    const accounts = await keys.reduce(async (prev, current) => {
      const value = await prev;
  
      let entry = {
        balance: new BigNumber(0),
        allowances: {},
      };
  
      try {
        entry = await storage.accounts.get(current);
      } catch (err) {
        // Do nothing
      }
  
      return {
        ...value,
        [current]: entry
      };
    }, Promise.resolve({}));
    return {
      ...storage,
      accounts
    };
  };

const testMethods = async () => {
    // Given
    const fa12Contract = await Tezos.contract.at(contractDeploy.address);
    const methods = fa12Contract.methods;

    // When
    const methodsKeys = Object.keys(methods);
    const methodsThatMustExist = ['transfer', 'mint', 'getTotalSupply', 'getBalance', 'getAllowance', 'burn', 'approve'];
    
    //Then
    assert(methodsKeys.length === methodsThatMustExist.length, "Some methods doesn't exist");
    console.log(`[OK] Methods: ${methodsThatMustExist.join(', ')}.`)
};

const testMint =  async () => {
    // Given
    const contractAddress = contractDeploy.address;
    const contract = await Tezos.contract.at(contractAddress);
    const accountFaucetA = await signerFaucetA.publicKeyHash();
    const accountFaucetB = await signerFaucetB.publicKeyHash();

    const initialStorage = await getStorage(contractAddress, [accountFaucetA, accountFaucetB]);
    const initialFaucetABalance = initialStorage.accounts[accountFaucetA].balance;

    const decimals = initialStorage.decimals;
    const symbol = initialStorage.symbol;
    const value = '2000000000000000000';
    const valueBN = new BigNumber(value);

    // When
    const op = await contract.methods.mint(value).send();
    await op.confirmation();

    // Then
    const storageAfter = await getStorage(contractAddress, [accountFaucetA, accountFaucetB]);
    const balanceFaucetAAfter = storageAfter.accounts[accountFaucetA].balance;
    const balanceFaucetBAfter = storageAfter.accounts[accountFaucetB].balance;

    assert(initialFaucetABalance.plus(value).toString() === balanceFaucetAAfter.toString(), 'Balance plus value should be equal to balance after mint.');
    assert(initialStorage.totalSupply.plus(value).toString() === storageAfter.totalSupply.toString(), 'TotalSupply should be the same.');
    console.log(`[OK] Mint amount ${tokenAmountInUnits(valueBN, decimals)} ${symbol}, check supply and account balance. 
    Total suppĺy: ${tokenAmountInUnits(storageAfter.totalSupply, decimals)} ${symbol}.
    Balance ${accountFaucetA}: ${tokenAmountInUnits(balanceFaucetAAfter, decimals)} ${symbol}.
    Balance ${accountFaucetB}: ${tokenAmountInUnits(balanceFaucetBAfter, decimals)} ${symbol}.`);
};


const testTransferA =  async () => {
  // Given
  const contractAddress = contractDeploy.address;
  const contract = await Tezos.contract.at(contractAddress);
  const accountFaucetA = await signerFaucetA.publicKeyHash();
  const accountFaucetB = await signerFaucetB.publicKeyHash();

  const initialStorage = await getStorage(contractAddress, [accountFaucetA, accountFaucetB]);
  const initialAccountFaucetABalance = initialStorage.accounts[accountFaucetA].balance;
  const initialAccountFaucetBBalance = initialStorage.accounts[accountFaucetB].balance;

  const decimals = initialStorage.decimals;
  const symbol = initialStorage.symbol;
  const value = '2000000000000000000';
  const valueBN = new BigNumber(value);

  // When
  const op = await contract.methods.transfer(accountFaucetA, accountFaucetB, value).send();
  await op.confirmation();

  // Then
  const storageAfter = await getStorage(contractAddress, [accountFaucetA, accountFaucetB]);
  const balanceAccountFaucetAAfter = storageAfter.accounts[accountFaucetA].balance;
  const balanceAccountFaucetBAfter = storageAfter.accounts[accountFaucetB].balance;

  assert(initialAccountFaucetABalance.minus(value).toString() === balanceAccountFaucetAAfter.toString(), 'Balance minus value should be equal to balance after transfer for account A.');
  assert(initialAccountFaucetBBalance.plus(value).toString() === balanceAccountFaucetBAfter.toString(), 'Balance plus value should be equal to balance after transfer for account B.');

  console.log(`[OK] Transfer amount of ${tokenAmountInUnits(valueBN, decimals)} ${symbol} from ${accountFaucetA} to ${accountFaucetB}. 
  Account: ${accountFaucetA} - Initial balance: ${tokenAmountInUnits(initialAccountFaucetABalance, decimals)} ${symbol} - Balance after: ${tokenAmountInUnits(balanceAccountFaucetAAfter, decimals)} ${symbol}.
  Account: ${accountFaucetB} - Initial balance: ${tokenAmountInUnits(initialAccountFaucetBBalance, decimals)} ${symbol} - Balance after: ${tokenAmountInUnits(balanceAccountFaucetBAfter, decimals)} ${symbol}.`);
};

const testTransferB =  async () => {
  // Given
  const contractAddress = contractDeploy.address;
  Tezos.setProvider({ signer: signerFaucetB });

  const accountFaucetA = await signerFaucetA.publicKeyHash();
  const accountFaucetB = await signerFaucetB.publicKeyHash();
  const contract = await Tezos.contract.at(contractAddress);
  const initialStorage = await getStorage(contractAddress, [accountFaucetA, accountFaucetB]);
  const initialAccountFaucetABalance = initialStorage.accounts[accountFaucetA].balance;
  const initialAccountFaucetBBalance = initialStorage.accounts[accountFaucetB].balance;

  const decimals = initialStorage.decimals;
  const symbol = initialStorage.symbol;
  const value = '2000000000000000000';
  const valueBN = new BigNumber(value);

  // When
  const operationAllow = await contract.methods.approve(accountFaucetA, value).send();
  await operationAllow.confirmation();

  const operationTransfer = await contract.methods.transfer(accountFaucetB, accountFaucetA, value).send();
  await operationTransfer.confirmation();

  // Then
  const storageAfter = await getStorage(contractAddress, [accountFaucetA, accountFaucetB]);
  const balanceAccountFaucetAAfter = storageAfter.accounts[accountFaucetA].balance;
  const balanceAccountFaucetBAfter = storageAfter.accounts[accountFaucetB].balance;

  assert(initialAccountFaucetBBalance.minus(value).toString() === balanceAccountFaucetBAfter.toString(), 'Balance minus value should be equal to balance after transfer for account B.');
  assert(initialAccountFaucetABalance.plus(value).toString() === balanceAccountFaucetAAfter.toString(), 'Balance plus value should be equal to balance after transfer for account A.');

  console.log(`[OK] Transfer amount of ${tokenAmountInUnits(valueBN, decimals)} ${symbol} from ${accountFaucetB} to ${accountFaucetA}. 
  Account: ${accountFaucetB} - Initial balance: ${tokenAmountInUnits(initialAccountFaucetBBalance, decimals)} ${symbol} - Balance after: ${tokenAmountInUnits(balanceAccountFaucetBAfter, decimals)} ${symbol}.
  Account: ${accountFaucetA} - Initial balance: ${tokenAmountInUnits(initialAccountFaucetABalance, decimals)} ${symbol} - Balance after: ${tokenAmountInUnits(balanceAccountFaucetAAfter, decimals)} ${symbol}.`);
};

const testProperties =  async () => {
  // Given
  const contractAddress = contractDeploy.address;
  const contract = await Tezos.contract.at(contractAddress);
  
  // When
  const storage = await contract.storage();

  // Then
  assert(storage.decimals.toString() === "18", "Decimals should be 18");
  assert(storage.symbol === "pTez", "Symbol must be pTez");
  assert(storage.name === "Pool Tezos coin", "Name should be Pool Tezos coin");
  console.log(`[OK] Token properties. Symbol: ${storage.symbol}, Name: ${storage.name}, Decimals: ${storage.decimals}.`) 
};

const test = async () => {
    const tests = [
      testMethods,
      testProperties,
      testMint,
      testTransferA,
      testTransferB,
    ];

    for (let test of tests) {
      await test();
    }
};
  
(async () => {
    await test();
})().catch(e => {
    console.error(e)
});