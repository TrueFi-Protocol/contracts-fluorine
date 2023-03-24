import { expect } from 'chai'
import { assetVaultFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { percentOf } from 'utils/percentOf'

describe('StructuredAssetVault.checkTranchesRatios', () => {
  const loadFixture = setupFixtureLoader()

  const minSubordinateRatio = 2000

  describe('tranche 1', () => {
    it('ratio smaller than min subordinate ratio', async () => {
      const { parseTokenUnits, depositToTranche, equityTranche, juniorTranche, assetVault } = await loadFixture(
        assetVaultFixture
      )
      await assetVault.setTrancheMinSubordinateRatio(1, minSubordinateRatio)

      const juniorDeposit = parseTokenUnits(1000)
      const expectedSubordinateValue = percentOf(juniorDeposit, minSubordinateRatio)
      const equityDeposit = expectedSubordinateValue.sub(1)

      await depositToTranche(equityTranche, equityDeposit)
      await depositToTranche(juniorTranche, juniorDeposit)

      await expect(assetVault.checkTranchesRatios()).to.be.revertedWith('SAV: Tranche min ratio not met')
    })

    it('ratio equal to min subordinate ratio', async () => {
      const { parseTokenUnits, depositToTranche, equityTranche, juniorTranche, assetVault } = await loadFixture(
        assetVaultFixture
      )
      await assetVault.setTrancheMinSubordinateRatio(1, minSubordinateRatio)

      const equityDeposit = parseTokenUnits(1000)
      await depositToTranche(equityTranche, equityDeposit)

      const juniorDeposit = percentOf(equityDeposit, minSubordinateRatio)
      await depositToTranche(juniorTranche, juniorDeposit)

      expect(await assetVault.checkTranchesRatios()).not.to.be.reverted
    })
  })

  describe('tranche 2', () => {
    it('ratio smaller than min subordinate ratio', async () => {
      const { parseTokenUnits, depositToTranche, equityTranche, juniorTranche, seniorTranche, assetVault } =
        await loadFixture(assetVaultFixture)
      await assetVault.setTrancheMinSubordinateRatio(2, minSubordinateRatio)

      const seniorDeposit = parseTokenUnits(1000)
      const expectedSubordinateDeposit = percentOf(seniorDeposit, minSubordinateRatio)
      const subordinateDeposit = expectedSubordinateDeposit.sub(2)

      const equityDeposit = subordinateDeposit.div(2)
      await depositToTranche(equityTranche, equityDeposit)

      const juniorDeposit = subordinateDeposit.div(2)
      await depositToTranche(juniorTranche, juniorDeposit)

      await depositToTranche(seniorTranche, seniorDeposit)

      await expect(assetVault.checkTranchesRatios()).to.be.revertedWith('SAV: Tranche min ratio not met')
    })

    it('ratio equal to min subordinate ratio', async () => {
      const { parseTokenUnits, depositToTranche, equityTranche, juniorTranche, seniorTranche, assetVault } =
        await loadFixture(assetVaultFixture)
      await assetVault.setTrancheMinSubordinateRatio(2, minSubordinateRatio)

      const equityDeposit = parseTokenUnits(1000)
      await depositToTranche(equityTranche, equityDeposit)

      const juniorDeposit = parseTokenUnits(1000)
      await depositToTranche(juniorTranche, juniorDeposit)

      const subordinateDeposit = juniorDeposit.add(equityDeposit)
      const seniorDeposit = percentOf(subordinateDeposit, minSubordinateRatio)
      await depositToTranche(seniorTranche, seniorDeposit)

      expect(await assetVault.checkTranchesRatios()).not.to.be.reverted
    })
  })
})
