import { TrancheVault__factory } from 'build/types'
import { expect } from 'chai'
import { assetVaultFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'

describe('StructuredAssetVault.getTranches', () => {
  const loadFixture = setupFixtureLoader()

  it('returns tranches addresses', async () => {
    const { assetVault, tranchesData, wallet } = await loadFixture(assetVaultFixture)

    const tranches = await assetVault.getTranches()

    for (let i = 0; i < tranches.length; i++) {
      const tranche = new TrancheVault__factory(wallet).attach(tranches[i])
      expect(await tranche.symbol()).to.eq(tranchesData[i].symbol)
      expect(await tranche.name()).to.eq(tranchesData[i].name)
    }
  })
})
