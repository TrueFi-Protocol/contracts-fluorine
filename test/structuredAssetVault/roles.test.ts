import { expect } from 'chai'
import { assetVaultFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'

describe('StructuredAssetVault: roles', () => {
  const loadFixture = setupFixtureLoader()

  it('protocol admin can grant borrower role', async () => {
    const {
      assetVault,
      another,
      protocolConfigParams: { protocolAdmin },
    } = await loadFixture(assetVaultFixture)
    const borrowerRole = await assetVault.BORROWER_ROLE()

    expect(await assetVault.hasRole(borrowerRole, another.address)).to.be.false
    await assetVault.connect(protocolAdmin).grantRole(borrowerRole, another.address)
    expect(await assetVault.hasRole(borrowerRole, another.address)).to.be.true
  })

  it('manager can grant repayer role', async () => {
    const { assetVault, other } = await loadFixture(assetVaultFixture)
    const repayerRole = await assetVault.REPAYER_ROLE()

    expect(await assetVault.hasRole(repayerRole, other.address)).to.be.false
    await assetVault.grantRole(repayerRole, other.address)
    expect(await assetVault.hasRole(repayerRole, other.address)).to.be.true
  })
})
