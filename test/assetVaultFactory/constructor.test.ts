import { expect } from 'chai'
import { assetVaultFactoryFixture } from 'fixtures/assetVaultFactoryFixture'
import { setupFixtureLoader } from 'test/setup'

describe('StructuredAssetVaultFactory.constructor', () => {
  const loadFixture = setupFixtureLoader()

  it('grants admin role for deployer', async () => {
    const { assetVaultFactory, wallet } = await loadFixture(assetVaultFactoryFixture)
    const adminRole = await assetVaultFactory.DEFAULT_ADMIN_ROLE()
    expect(await assetVaultFactory.hasRole(adminRole, wallet.address)).to.be.true
  })
})
