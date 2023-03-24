import { expect } from 'chai'
import { assetVaultFixture, assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { percentOf } from 'utils/percentOf'

describe('StructuredAssetVault.minTrancheValueComplyingWithRatio', () => {
  const loadFixture = setupFixtureLoader()

  const minSubordinateRatio = 2000

  it('all ratios are limited by tranche directly over them', async () => {
    const { assetVault, initialDeposits, parseTokenUnits } = await loadFixture(assetVaultLiveFixture)

    await assetVault.setTrancheMinSubordinateRatio(1, minSubordinateRatio)
    await assetVault.setTrancheMinSubordinateRatio(2, 5000)

    const minEquityRatioLimit = percentOf(initialDeposits[1], minSubordinateRatio)
    const minJuniorRatioLimit = percentOf(initialDeposits[2], 5000).sub(initialDeposits[0])

    expect(await assetVault.minTrancheValueComplyingWithRatio(0)).to.be.closeTo(minEquityRatioLimit, parseTokenUnits(1))
    expect(await assetVault.minTrancheValueComplyingWithRatio(1)).to.be.closeTo(minJuniorRatioLimit, parseTokenUnits(1))
    expect(await assetVault.minTrancheValueComplyingWithRatio(2)).to.equal(0)
  })

  it('when lower tranches cover all needs, return 0', async () => {
    const { assetVault } = await loadFixture(assetVaultLiveFixture)
    await assetVault.setTrancheMinSubordinateRatio(2, minSubordinateRatio)

    expect(await assetVault.minTrancheValueComplyingWithRatio(1)).to.equal(0)
  })

  it('equity tranche is limited ', async () => {
    const { assetVault, initialDeposits, parseTokenUnits } = await loadFixture(assetVaultLiveFixture)
    await assetVault.setTrancheMinSubordinateRatio(2, 8000)

    const minEquityRatioLimit = percentOf(initialDeposits[2], 8000).sub(initialDeposits[1])

    expect(await assetVault.minTrancheValueComplyingWithRatio(0)).to.be.closeTo(minEquityRatioLimit, parseTokenUnits(1))
  })

  it('is possible to withdraw amount to match min value but not more', async () => {
    const { withdrawFromTranche, equityTranche, assetVault, initialDeposits, parseTokenUnits } = await loadFixture(
      assetVaultLiveFixture
    )
    await assetVault.setTrancheMinSubordinateRatio(1, minSubordinateRatio)

    const minEquityRatioLimit = percentOf(initialDeposits[1], minSubordinateRatio)
    const maxWithdraw = initialDeposits[0].sub(minEquityRatioLimit).sub(parseTokenUnits(1))
    await expect(withdrawFromTranche(equityTranche, maxWithdraw)).to.be.not.reverted
    await expect(withdrawFromTranche(equityTranche, parseTokenUnits(1.1))).to.be.revertedWith(
      'SAV: Tranche min ratio not met'
    )
  })

  it('returns 0 when AssetVault is not live', async () => {
    const { assetVault, startAndCloseAssetVault } = await loadFixture(assetVaultFixture)
    await assetVault.setTrancheMinSubordinateRatio(1, minSubordinateRatio)
    await assetVault.setTrancheMinSubordinateRatio(2, 5000)

    expect(await assetVault.minTrancheValueComplyingWithRatio(0)).to.equal(0)
    expect(await assetVault.minTrancheValueComplyingWithRatio(1)).to.equal(0)
    expect(await assetVault.minTrancheValueComplyingWithRatio(2)).to.equal(0)

    await startAndCloseAssetVault()

    expect(await assetVault.minTrancheValueComplyingWithRatio(0)).to.equal(0)
    expect(await assetVault.minTrancheValueComplyingWithRatio(1)).to.equal(0)
    expect(await assetVault.minTrancheValueComplyingWithRatio(2)).to.equal(0)
  })
})
