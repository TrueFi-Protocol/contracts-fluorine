import '@typechain/hardhat'
import 'hardhat-waffle-dev'
import 'solidity-docgen'
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-verify";

import mocharc from './.mocharc.json'
import compiler from './.compiler.json'

module.exports = {
  defaultNetwork: "zkSyncTestnet",
  zksolc: {
    version: "1.3.5",
    compilerSource: "binary",
    settings: {},
  },
  docgen: {
    pages: 'files',
    templates: './templates',
    exclude: ['mocks', 'proxy', 'test'],
  },
  paths: {
    sources: './contracts',
    artifacts: './build',
    cache: './build',
  },
  abiExporter: {
    path: './build',
    flat: true,
    spacing: 2,
  },
  networks: {
    zkSyncTestnet: {
      url: "https://zksync2-testnet.zksync.dev",
      ethNetwork: "goerli", // Can also be the RPC URL of the network (e.g. `https://goerli.infura.io/v3/<API_KEY>`)
      zksync: true,
      verifyURL: 'https://zksync2-testnet-explorer.zksync.dev/contract_verification',
    },
  },
  typechain: {
    outDir: 'build/types',
    target: 'ethers-v5',
  },
  solidity: {
    compilers: [compiler],
  },
  mocha: {
    ...mocharc,
    timeout: 400000,
  },
  waffle: {
    skipEstimateGas: '0xB71B00',
    injectCallHistory: true,
  },
}
