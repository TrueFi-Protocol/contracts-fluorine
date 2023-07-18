import { StructuredAssetVaultFactory, StructuredAssetVault, TrancheVault, DepositController, WithdrawController, TransferEnabledController, AllowAllLenderVerifier } from '../../build/artifacts'
import { contract, ExecuteOptions } from 'ethereum-mars'
import { deployProtocolConfig } from './deployProtocolConfig'
import { MarsContract } from 'deployments-utils'

export type FluorineDeployResult = ReturnType<typeof deployFluorine>

export function deployFluorine(_: string, { networkName }: ExecuteOptions) {
  const structuredPortfolio = contract(StructuredAssetVault)
  const tranche = contract('fluorine_TrancheVault', TrancheVault)
  const protocolConfig = deployProtocolConfig(networkName, 'fluorine_')
  const structuredPortfolioFactory = contract(StructuredAssetVaultFactory, [structuredPortfolio, tranche, protocolConfig])
  const defaultDepositController = contract('fluorine_defaultDepositController', DepositController)
  const defaultWithdrawController = contract('fluorine_defaultWithdrawController', WithdrawController)
  const defaultTransferController = contract('fluorine_defaultTransferController', TransferEnabledController)
  const allowAllLenderVerifier = contract(AllowAllLenderVerifier)

  const isTestnet = networkName !== 'mainnet' && networkName !== 'optimism'

  if(isTestnet) {
    whitelistBorrowers(structuredPortfolioFactory)
  }

  return {
    structuredPortfolioFactory,
    defaultDepositController,
    defaultWithdrawController,
    defaultTransferController,
    protocolConfig,
    allowAllLenderVerifier,
  }
}

function whitelistBorrowers(structuredPortfolioFactory: MarsContract<typeof StructuredAssetVaultFactory>) {
  const testnetUsers = [
    '0xD61cDF6074e7DD7ff3C9F1cb665b9487ECD63143',
    '0xe13610d0a3e4303c70791773C5DF8Bb16de185d1',
    '0xEDB7f2db845EfB98A11cD173555196BF54502D38',
    '0x30B2d4683696cE3ecCb83E280f257466AE3F61ee'
  ]

  const whitelistedManagerRole = structuredPortfolioFactory.WHITELISTED_MANAGER_ROLE()

  for(const manager of testnetUsers) {
    if(structuredPortfolioFactory.hasRole(whitelistedManagerRole, manager).equals(false)) {
      structuredPortfolioFactory.grantRole(whitelistedManagerRole, manager)
    }

    for(const borrower of testnetUsers) {
      if(structuredPortfolioFactory.isBorrowerAllowed(manager, borrower).equals(false)) {
        structuredPortfolioFactory.setAllowedBorrower(manager, borrower, true)
      }
    }
  }
}
