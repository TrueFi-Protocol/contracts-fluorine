import { TrancheVaultTest, MultiAction__factory } from 'build/types'
import { Wallet } from 'ethers'
import { getAssetVaultFactoryFixture } from './assetVaultFactoryFixture'
import { BigNumberish } from 'ethers'
import { timeTravel } from 'utils/timeTravel'
import { getTxTimestamp } from 'utils/timestamp'
import { sum } from 'utils/sum'
import { assetVaultUtils } from './assetsVaultUtils'
import { FixtureConfig, FixtureTrancheData } from './types'

export enum AssetVaultStatus {
  CapitalFormation,
  Live,
  Closed,
}

export const getAssetVaultFixture = (fixtureConfig?: Partial<FixtureConfig>) => {
  return async ([wallet, other, ...rest]: Wallet[]) => {
    const factoryFixtureResult = await getAssetVaultFactoryFixture(fixtureConfig)([wallet, other, ...rest])
    const { assetVaultDuration, getAssetVaultFromTx, tranches, tranchesData, token } = factoryFixtureResult

    const assetVault = await getAssetVaultFromTx()

    function withdrawFromTranche(
      tranche: TrancheVaultTest,
      amount: BigNumberish,
      owner = wallet.address,
      receiver = wallet.address
    ) {
      return tranche.withdraw(amount, receiver, owner)
    }

    function redeemFromTranche(
      tranche: TrancheVaultTest,
      amount: BigNumberish,
      owner = wallet.address,
      receiver = wallet.address
    ) {
      return tranche.redeem(amount, receiver, owner)
    }

    async function startAssetVaultAndEnableLiveActions() {
      const tx = await assetVault.start()
      for (const { depositController, withdrawController } of tranchesData) {
        const vaultStatus = await assetVault.status()
        await depositController.setDepositAllowed(true, vaultStatus)
        await withdrawController.setWithdrawAllowed(true, vaultStatus)
      }
      return tx
    }

    async function startAndCloseAssetVault() {
      await assetVault.start()
      await timeTravel(assetVaultDuration)
      await assetVault.close()
    }

    async function mintToAssetVault(amount: BigNumberish, structuredAssetVault = assetVault) {
      await token.mint(structuredAssetVault.address, amount)
      await structuredAssetVault.mockIncreaseVirtualTokenBalance(amount)
    }

    const [equityTranche, juniorTranche, seniorTranche] = tranches

    const vaultUtils = assetVaultUtils(wallet, assetVault, token)

    const [equity, junior, senior] = tranchesData.map(
      (trancheData, idx): FixtureTrancheData => ({
        ...trancheData,
        trancheIdx: idx,
        getCurrentDeficit: async () => (await tranches[idx].getCheckpoint()).deficit,
      })
    )

    return {
      assetVault,
      AssetVaultStatus,
      tranches,
      withdrawFromTranche,
      redeemFromTranche,
      startAndCloseAssetVault,
      startAssetVaultAndEnableLiveActions,
      ...factoryFixtureResult,
      equityTranche,
      juniorTranche,
      seniorTranche,
      mintToAssetVault,
      ...vaultUtils,
      equity,
      junior,
      senior,
    }
  }
}

export const assetVaultFixture = getAssetVaultFixture()

export const getAssetVaultLiveFixture = (fixtureConfig?: Partial<FixtureConfig>) => {
  return async ([wallet, borrower, ...rest]: Wallet[]) => {
    const assetVaultFixtureResult = await getAssetVaultFixture(fixtureConfig)([wallet, borrower, ...rest])
    const {
      tranches,
      depositToTranche,
      parseTokenUnits,
      startAssetVaultAndEnableLiveActions,
      equity,
      junior,
      senior,
      assetVault,
      token,
      protocolConfigParams: { protocolAdmin },
    } = assetVaultFixtureResult

    const initialDeposits = [2e6, 3e6, 5e6].map(parseTokenUnits)
    const totalDeposit = sum(...initialDeposits)
    for (let i = 0; i < tranches.length; i++) {
      await depositToTranche(tranches[i], initialDeposits[i])
    }

    const assetVaultStartTx = await startAssetVaultAndEnableLiveActions()
    const assetVaultStartTimestamp = await getTxTimestamp(assetVaultStartTx)

    async function deployMultiAction() {
      const multiAction = await new MultiAction__factory(wallet).deploy(assetVault.address)
      await token.mint(multiAction.address, parseTokenUnits(1e10))

      const managerRole = await assetVault.MANAGER_ROLE()
      await assetVault.connect(protocolAdmin).grantRole(managerRole, multiAction.address)

      return { multiAction }
    }

    return {
      ...assetVaultFixtureResult,
      initialDeposits,
      senior: { ...senior, initialDeposit: initialDeposits[2] },
      junior: { ...junior, initialDeposit: initialDeposits[1] },
      equity: { ...equity, initialDeposit: initialDeposits[0] },
      assetVaultStartTx,
      assetVaultStartTimestamp,
      totalDeposit,
      deployMultiAction,
    }
  }
}

export const assetVaultLiveFixture = getAssetVaultLiveFixture()
