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

  it('sets tranche implementation', async () => {
    const { assetVaultFactory, trancheVaultImplementation } = await loadFixture(assetVaultFactoryFixture)
    expect(await assetVaultFactory.trancheImplementation()).to.eq(trancheVaultImplementation.address)
  })

  it('sets asset vault implementation', async () => {
    const { assetVaultFactory, assetVaultImplementation } = await loadFixture(assetVaultFactoryFixture)
    expect(await assetVaultFactory.assetVaultImplementation()).to.eq(assetVaultImplementation.address)
  })

  it('sets protocol config', async () => {
    const { assetVaultFactory, protocolConfig } = await loadFixture(assetVaultFactoryFixture)
    expect(await assetVaultFactory.protocolConfig()).to.eq(protocolConfig.address)
  })
})
