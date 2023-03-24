import { expect } from 'chai'
import { assetVaultFixture, assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { constants } from 'ethers'

describe('StructuredAssetVault.maxTrancheValueComplyingWithRatio', () => {
  const loadFixture = setupFixtureLoader()

  const minSubordinateRatio = 2000

  it('returns max possible values for all tranches', async () => {
    const { assetVault, initialDeposits, parseTokenUnits } = await loadFixture(assetVaultLiveFixture)

    await assetVault.setTrancheMinSubordinateRatio(1, minSubordinateRatio)
    await assetVault.setTrancheMinSubordinateRatio(2, 5000)

    const maxJuniorRatioLimit = initialDeposits[0].mul(5) //  1/0.2
    const maxSeniorRatioLimit = initialDeposits[0].add(initialDeposits[1]).mul(2) // 1/0.5
    expect(await assetVault.maxTrancheValueComplyingWithRatio(0)).to.equal(constants.MaxUint256)
    expect(await assetVault.maxTrancheValueComplyingWithRatio(1)).to.be.closeTo(maxJuniorRatioLimit, parseTokenUnits(1))
    expect(await assetVault.maxTrancheValueComplyingWithRatio(2)).to.be.closeTo(maxSeniorRatioLimit, parseTokenUnits(1))
  })

  it('returns max int when min ratio is not set for tranche', async () => {
    const { assetVault } = await loadFixture(assetVaultLiveFixture)

    expect(await assetVault.maxTrancheValueComplyingWithRatio(1)).to.equal(constants.MaxUint256)
    expect(await assetVault.maxTrancheValueComplyingWithRatio(2)).to.equal(constants.MaxUint256)
  })

  it('is possible to deposit amount to match max value but not more', async () => {
    const { depositToTranche, juniorTranche, assetVault, initialDeposits, parseTokenUnits } = await loadFixture(
      assetVaultLiveFixture
    )
    await assetVault.setTrancheMinSubordinateRatio(1, minSubordinateRatio)

    const maxJuniorDeposit = initialDeposits[0].mul(5).sub(initialDeposits[1]).sub(parseTokenUnits(1))
    await expect(depositToTranche(juniorTranche, maxJuniorDeposit)).to.be.not.reverted
    await expect(depositToTranche(juniorTranche, parseTokenUnits(1.1))).to.be.revertedWith(
      'SAV: Tranche min ratio not met'
    )
  })

  it('returns max int when AssetVault is not live', async () => {
    const { assetVault, startAndCloseAssetVault } = await loadFixture(assetVaultFixture)

    await assetVault.setTrancheMinSubordinateRatio(1, minSubordinateRatio)
    await assetVault.setTrancheMinSubordinateRatio(2, 5000)

    expect(await assetVault.maxTrancheValueComplyingWithRatio(1)).to.equal(constants.MaxUint256)
    expect(await assetVault.maxTrancheValueComplyingWithRatio(2)).to.equal(constants.MaxUint256)

    await startAndCloseAssetVault()

    expect(await assetVault.maxTrancheValueComplyingWithRatio(1)).to.equal(constants.MaxUint256)
    expect(await assetVault.maxTrancheValueComplyingWithRatio(2)).to.equal(constants.MaxUint256)
  })
})
