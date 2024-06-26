import { defaultAccounts } from "ethereum-waffle"
import { Wallet } from "ethers"

const ganacheDeployer = new Wallet(defaultAccounts[0].secretKey).address

interface ProtocolConfig {
  defaultProtocolFeeRate: number
  protocolAdmin: string
  protocolTreasury: string
  pauserAddress: string
}

interface Config {
  protocolConfig: Record<string, ProtocolConfig>
}

export const config: Config = {
  protocolConfig: {
    mainnet: {
      defaultProtocolFeeRate: 50,
      protocolAdmin: '0x16cEa306506c387713C70b9C1205fd5aC997E78E', // Owner multisig,
      protocolTreasury: '0x4f4AC7a7032A14243aEbDa98Ee04a5D7Fe293d07', // Timelock,
      pauserAddress: '0xf0aE09d3ABdF3641e2eB4cD45cf56873296a02CB', // Config multisig,
    },
    ganache: {
      defaultProtocolFeeRate: 10,
      protocolAdmin: ganacheDeployer,
      protocolTreasury: ganacheDeployer,
      pauserAddress: ganacheDeployer,
    },
    optimism_goerli: {
      defaultProtocolFeeRate: 0,
      protocolAdmin: '0xBf116e1137f7C1067D5c27547d94d493fdC82d44',
      protocolTreasury: '0x715C72ea89CD250890714467963b0F9774FF2520',
      pauserAddress: '0x715C72ea89CD250890714467963b0F9774FF2520'
    },
    goerli: {
      defaultProtocolFeeRate: 50,
      protocolAdmin: '0xBf116e1137f7C1067D5c27547d94d493fdC82d44',
      protocolTreasury: '0xe13610d0a3e4303c70791773C5DF8Bb16de185d1',
      pauserAddress: '0xe13610d0a3e4303c70791773C5DF8Bb16de185d1',
    },
    zkSyncTestnet: {
      defaultProtocolFeeRate: 0,
      protocolAdmin: '0xe13610d0a3e4303c70791773C5DF8Bb16de185d1',
      protocolTreasury: '0x715C72ea89CD250890714467963b0F9774FF2520',
      pauserAddress: '0x715C72ea89CD250890714467963b0F9774FF2520'
    },
    sepolia: {
      defaultProtocolFeeRate: 0,
      protocolAdmin: '0x7F6733Ce45570105b60B4c49C029f8d4acC2A751',
      protocolTreasury: '0x7F6733Ce45570105b60B4c49C029f8d4acC2A751',
      pauserAddress: '0x7F6733Ce45570105b60B4c49C029f8d4acC2A751'
    }
  },
}
