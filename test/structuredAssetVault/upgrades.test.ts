import { setupFixtureLoader } from 'test/setup'
import { assetVaultFixture } from 'fixtures/assetVaultFixture'
import { StructuredAssetVault__factory } from 'contracts'
import { expect } from 'chai'

describe('StructuredAssetVault.upgrades', () => {
  const loadFixture = setupFixtureLoader()

  it('sets DEFAULT_ADMIN role to the protocol admin', async () => {
    const {
      assetVault,
      protocolConfigParams: { protocolAdmin },
    } = await loadFixture(assetVaultFixture)
    const defaultAdminRole = await assetVault.DEFAULT_ADMIN_ROLE()
    expect(await assetVault.hasRole(defaultAdminRole, protocolAdmin.address)).to.be.true
  })

  it('upgrades to the new implementation', async () => {
    const {
      assetVault,
      wallet,
      provider,
      protocolConfigParams: { protocolAdmin },
    } = await loadFixture(assetVaultFixture)
    const newImplementation = await new StructuredAssetVault__factory(wallet).deploy()
    await assetVault.connect(protocolAdmin).upgradeTo(newImplementation.address)
    const implementationSlot = await newImplementation.proxiableUUID()
    const expectedImplementationStorageValue = `0x${newImplementation.address.toLowerCase().slice(2).padStart(64, '0')}`
    expect(await provider.getStorageAt(assetVault.address, implementationSlot)).to.eq(
      expectedImplementationStorageValue
    )
  })

  it('fails to upgrade if not called by DEFAULT_ADMIN', async () => {
    const { assetVault, wallet } = await loadFixture(assetVaultFixture)
    const newImplementation = await new StructuredAssetVault__factory(wallet).deploy()
    const defaultAdminRole = await assetVault.DEFAULT_ADMIN_ROLE()
    const reason = `AccessControl: account ${wallet.address.toLowerCase()} is missing role ${defaultAdminRole}`
    await expect(assetVault.upgradeTo(newImplementation.address)).to.be.revertedWith(reason)
  })
})
