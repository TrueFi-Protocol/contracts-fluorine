import {
  ProtocolConfig,
  StructuredAssetVaultFactory__factory,
  StructuredAssetVaultTest__factory,
  TrancheVaultTest__factory,
} from 'build/types'
import { Wallet } from 'ethers'

export async function deployAssetVaultFactory(deployer: Wallet, protocolConfig: ProtocolConfig) {
  const assetVaultImplementation = await new StructuredAssetVaultTest__factory(deployer).deploy()
  const trancheVaultImplementation = await new TrancheVaultTest__factory(deployer).deploy()
  const assetVaultFactory = await new StructuredAssetVaultFactory__factory(deployer).deploy(
    assetVaultImplementation.address,
    trancheVaultImplementation.address,
    protocolConfig.address
  )

  const whitelistedManagerRole = await assetVaultFactory.WHITELISTED_MANAGER_ROLE()
  await assetVaultFactory.grantRole(whitelistedManagerRole, deployer.address)

  return { assetVaultImplementation, trancheVaultImplementation, assetVaultFactory, whitelistedManagerRole }
}
