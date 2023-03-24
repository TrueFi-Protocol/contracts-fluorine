import { expect } from 'chai'
import { assetVaultFixture, assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { YEAR } from 'utils/constants'
import { percentOf } from 'utils/percentOf'
import { timeTravelFrom } from 'utils/timeTravel'

describe('StructuredAssetVault.totalAssets', () => {
  const loadFixture = setupFixtureLoader()

  it('CapitalFormation status', async () => {
    const { assetVault, tranches, parseTokenUnits, depositToTranche } = await loadFixture(assetVaultFixture)
    const depositAmount = parseTokenUnits(1000)
    for (const tranche of tranches) {
      await depositToTranche(tranche, depositAmount)
    }
    expect(await assetVault.totalAssets()).to.eq(depositAmount.mul(3))
  })

  describe('Live status', () => {
    it('without disbursements', async () => {
      const { assetVault, token } = await loadFixture(assetVaultLiveFixture)
      const assetVaultBalance = await token.balanceOf(assetVault.address)
      expect(await assetVault.totalAssets()).to.eq(assetVaultBalance)
    })

    it('after disbursement', async () => {
      const { assetVault, token, disburse, parseTokenUnits } = await loadFixture(assetVaultLiveFixture)
      const disbursement = parseTokenUnits(1e6)
      await disburse(disbursement)

      const assetVaultBalance = await token.balanceOf(assetVault.address)
      expect(await assetVault.totalAssets()).to.eq(assetVaultBalance.add(disbursement))
    })

    it('after repay', async () => {
      const { assetVault, token, disburse, repay, parseTokenUnits } = await loadFixture(assetVaultLiveFixture)
      const initialVaultBalance = await token.balanceOf(assetVault.address)

      const principal = parseTokenUnits(1e6)
      const interest = parseTokenUnits(1e5)
      await disburse(principal, { interest })

      await repay(principal, interest)

      expect(await assetVault.totalAssets()).to.eq(initialVaultBalance.add(interest))
    })

    it('transferring assets to AssetVault does not affect total assets', async () => {
      const { assetVault, token, wallet, equityTranche, startAssetVaultAndEnableLiveActions, parseTokenUnits } =
        await loadFixture(assetVaultFixture)
      const amount = parseTokenUnits(1_000)

      await startAssetVaultAndEnableLiveActions()

      await token.approve(equityTranche.address, 1)
      await equityTranche.deposit(1, wallet.address)
      await token.transfer(assetVault.address, amount)

      expect(await assetVault.virtualTokenBalance()).to.eq(1)
      expect(await assetVault.totalAssets()).to.eq(1)
    })
  })

  it('Closed status', async () => {
    const { assetVault, totalDeposit } = await loadFixture(assetVaultLiveFixture)
    expect(await assetVault.totalAssets()).to.eq(totalDeposit)
  })

  it('fee is subtracted', async () => {
    const { protocolConfig, assetVault, totalDeposit, parseTokenUnits, disburse } = await loadFixture(
      assetVaultLiveFixture
    )
    const disbursement = parseTokenUnits(1e6)
    await disburse(disbursement)

    // start accruing fees
    const protocolFeeRate = 100
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)
    const tx = await assetVault.updateCheckpoints()

    await timeTravelFrom(tx, YEAR)

    const protocolFee = percentOf(totalDeposit, protocolFeeRate)
    const expectedTotalAssets = totalDeposit.sub(protocolFee)
    await assetVault.updateCheckpoints()
    expect(await assetVault.totalAssets()).to.closeTo(expectedTotalAssets, parseTokenUnits(0.02))
  })
})
