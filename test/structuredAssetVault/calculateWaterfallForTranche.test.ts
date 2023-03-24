import { expect } from 'chai'
import { assetVaultFixture, assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'

describe('StructuredAssetVault.calculateWaterfallForTranche', () => {
  const loadFixture = setupFixtureLoader()

  it('capital formation, returns 0', async () => {
    const { assetVault, tranches } = await loadFixture(assetVaultFixture)

    for (let i = 0; i < tranches.length; i++) {
      expect(await assetVault.calculateWaterfallForTranche(i)).to.eq(0)
    }
  })

  it('AssetVault status Closed, returns 0', async () => {
    const { assetVault, tranches, startAndCloseAssetVault } = await loadFixture(assetVaultFixture)
    await startAndCloseAssetVault()

    for (let i = 0; i < tranches.length; i++) {
      expect(await assetVault.calculateWaterfallForTranche(i)).to.eq(0)
    }
  })

  it('index out of bounds', async () => {
    const { assetVault, tranches } = await loadFixture(assetVaultLiveFixture)
    await expect(assetVault.calculateWaterfallForTranche(tranches.length)).to.be.revertedWith(
      'SAV: Tranche index out of bounds'
    )
  })

  it('returns correct values', async () => {
    const { assetVault } = await loadFixture(assetVaultLiveFixture)
    const waterfallValues = await assetVault.calculateWaterfall()
    for (let i = 0; i < waterfallValues.length; i++) {
      expect(await assetVault.calculateWaterfallForTranche(i)).to.eq(waterfallValues[i])
    }
  })
})
