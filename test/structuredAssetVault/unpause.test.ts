import { expect } from 'chai'
import { assetVaultFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'

describe('StructuredAssetVault.unpause', () => {
  const loadFixture = setupFixtureLoader()

  it('only pauser', async () => {
    const {
      assetVault,
      another,
      protocolConfigParams: { pauser },
    } = await loadFixture(assetVaultFixture)
    await assetVault.connect(pauser).pause()
    await expect(assetVault.connect(another).unpause()).to.be.revertedWith('UP: Only pauser')
  })

  it('protocol pauser can unpause asset vault', async () => {
    const {
      assetVault,
      protocolConfigParams: { pauser },
    } = await loadFixture(assetVaultFixture)
    await assetVault.connect(pauser).pause()
    await assetVault.connect(pauser).unpause()
    expect(await assetVault.paused()).to.be.false
  })

  it('updated protocol pauser can unpause asset vault', async () => {
    const {
      protocolConfig,
      wallet,
      assetVault,
      protocolConfigParams: { pauser },
    } = await loadFixture(assetVaultFixture)
    await assetVault.connect(pauser).pause()

    await protocolConfig.setPauserAddress(wallet.address)
    await assetVault.unpause()

    expect(await assetVault.paused()).to.be.false
  })

  it('local pauser can unpause asset vault', async () => {
    const {
      assetVault,
      another,
      protocolConfigParams: { protocolAdmin },
    } = await loadFixture(assetVaultFixture)

    await assetVault.connect(protocolAdmin).grantRole(await assetVault.PAUSER_ROLE(), another.address)
    await assetVault.connect(another).pause()
    await assetVault.connect(another).unpause()

    expect(await assetVault.paused()).to.be.false
  })
})
