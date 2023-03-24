import { expect } from 'chai'
import { assetVaultFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'

describe('StructuredAssetVault.pause', () => {
  const loadFixture = setupFixtureLoader()

  it('only pauser', async () => {
    const { assetVault, another } = await loadFixture(assetVaultFixture)
    await expect(assetVault.connect(another).pause()).to.be.revertedWith('UP: Only pauser')
  })

  it('protocol pauser can pause asset vault', async () => {
    const {
      assetVault,
      protocolConfigParams: { pauser },
    } = await loadFixture(assetVaultFixture)
    await assetVault.connect(pauser).pause()
    expect(await assetVault.paused()).to.be.true
  })

  it('updated protocol pauser can pause asset vault', async () => {
    const { protocolConfig, wallet, assetVault } = await loadFixture(assetVaultFixture)
    await protocolConfig.setPauserAddress(wallet.address)
    await assetVault.pause()
    expect(await assetVault.paused()).to.be.true
  })

  it('local pauser can pause asset vault', async () => {
    const {
      assetVault,
      another,
      protocolConfigParams: { protocolAdmin },
    } = await loadFixture(assetVaultFixture)
    await assetVault.connect(protocolAdmin).grantRole(await assetVault.PAUSER_ROLE(), another.address)
    await assetVault.connect(another).pause()
    expect(await assetVault.paused()).to.be.true
  })
})
