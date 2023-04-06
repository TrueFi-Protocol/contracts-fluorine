import { Wallet } from 'zksync-web3'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'
import { config } from '../scripts/deployment/config'
import { ProtocolConfig__factory } from '../build/types'
import { encodeInitializeCall } from 'deployments-utils'

const makeDeploy =
  (deployer: Deployer) =>
  async (artifactName: string, args: any[] = []) => {
    const artifact = await deployer.loadArtifact(artifactName)
    const contract = await deployer.deploy(artifact, args)

    const contractAddress = contract.address
    console.log(`${artifact.contractName} was deployed to ${contractAddress}`)

    return contract
  }

export default async function (hre: HardhatRuntimeEnvironment) {
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is not set')
  }
  const wallet = new Wallet(privateKey)
  const deploy = makeDeploy(new Deployer(hre, wallet))
  const portfolio = await deploy('StructuredAssetVault')
  const protocolConfigImplementation = await deploy('ProtocolConfig')
  const tranche = await deploy('TrancheVault')
  const { defaultProtocolFeeRate, pauserAddress, protocolAdmin, protocolTreasury } = config.protocolConfig.zkSyncTestnet
  const initializeCallData = encodeInitializeCall(
    ProtocolConfig__factory,
    defaultProtocolFeeRate,
    protocolAdmin,
    protocolTreasury,
    pauserAddress
  )
  const protocolConfigProxy = await deploy('ProxyWrapper', [protocolConfigImplementation.address, initializeCallData])
  await deploy('StructuredAssetVaultFactory', [portfolio.address, tranche.address, protocolConfigProxy.address])
  await deploy('DepositController')
  await deploy('WithdrawController')
  await deploy('TransferController')
  await deploy('AllowAllLenderVerifier')
}
