import { expect } from 'chai'
import { assetVaultFactoryFixture } from 'fixtures/assetVaultFactoryFixture'
import { setupFixtureLoader } from 'test/setup'

describe('StructuredAssetVaultFactory.setAllowedBorrower', () => {
  const loadFixture = setupFixtureLoader()

  it('only protocol admin', async () => {
    const { assetVaultFactory, wallet, other } = await loadFixture(assetVaultFactoryFixture)
    await expect(
      assetVaultFactory.connect(other).setAllowedBorrower(wallet.address, other.address, true)
    ).to.be.revertedWith('SAVF: Only protocol admin')
  })

  it('only for whitelisted manager', async () => {
    const {
      assetVaultFactory,
      other,
      protocolConfigParams: { protocolAdmin },
    } = await loadFixture(assetVaultFactoryFixture)
    await expect(
      assetVaultFactory.connect(protocolAdmin).setAllowedBorrower(other.address, other.address, true)
    ).to.be.revertedWith('SAVF: Manager not whitelisted')
  })

  it('can allow borrower', async () => {
    const {
      assetVaultFactory,
      wallet,
      other,
      another,
      protocolConfigParams: { protocolAdmin },
    } = await loadFixture(assetVaultFactoryFixture)

    await assetVaultFactory.connect(protocolAdmin).setAllowedBorrower(wallet.address, other.address, true)
    await assetVaultFactory.connect(protocolAdmin).setAllowedBorrower(wallet.address, another.address, true)

    expect(await assetVaultFactory.getAllowedBorrowers(wallet.address)).to.deep.eq([other.address, another.address])
  })

  it('can disallow borrower', async () => {
    const {
      assetVaultFactory,
      wallet,
      other,
      another,
      protocolConfigParams: { protocolAdmin },
    } = await loadFixture(assetVaultFactoryFixture)

    await assetVaultFactory.connect(protocolAdmin).setAllowedBorrower(wallet.address, other.address, true)
    await assetVaultFactory.connect(protocolAdmin).setAllowedBorrower(wallet.address, another.address, true)
    await assetVaultFactory.connect(protocolAdmin).setAllowedBorrower(wallet.address, other.address, false)

    expect(await assetVaultFactory.getAllowedBorrowers(wallet.address)).to.deep.eq([another.address])
  })

  it('emits BorrowersAllowed event', async () => {
    const {
      assetVaultFactory,
      wallet,
      other,
      another,
      protocolConfigParams: { protocolAdmin },
    } = await loadFixture(assetVaultFactoryFixture)
    await assetVaultFactory.connect(protocolAdmin).setAllowedBorrower(wallet.address, other.address, true)

    await expect(assetVaultFactory.connect(protocolAdmin).setAllowedBorrower(wallet.address, another.address, true))
      .to.emit(assetVaultFactory, 'AllowedBorrowersChanged')
      .withArgs(wallet.address, [other.address, another.address])
  })
})
