import { expect } from 'chai'
import { constants } from 'ethers'
import { setupFixtureLoader } from '../setup'
import { assetVaultFactoryFixture } from 'fixtures/assetVaultFactoryFixture'
import { extractEventArgFromTx } from 'utils/extractEventArgFromTx'
import { TrancheVault__factory } from 'build/types'

describe('StructuredAssetVaultFactory.createAssetVault', () => {
  const loadFixture = setupFixtureLoader()

  it('only whitelisted manager', async () => {
    const { assetVaultFactory, other, assetVaultParams, tranchesData, token } = await loadFixture(
      assetVaultFactoryFixture
    )

    await expect(
      assetVaultFactory.connect(other).createAssetVault(
        token.address,
        assetVaultParams,
        tranchesData,
        {
          from: 0,
          to: 0,
        },
        true
      )
    ).to.be.revertedWith('SAVF: Only whitelisted manager')
  })

  it('creates asset vault and save in contract', async () => {
    const { assetVaultFactory } = await loadFixture(assetVaultFactoryFixture)

    const assetVaults = await assetVaultFactory.getAssetVaults()

    expect(assetVaults).to.have.length(1)
    expect(assetVaults[0]).not.eq(constants.AddressZero)
  })

  it('creates tranches', async () => {
    const { assetVaultFactory, wallet, tranchesData, createAssetVaultTx } = await loadFixture(assetVaultFactoryFixture)

    const tranches = await extractEventArgFromTx(createAssetVaultTx, [
      assetVaultFactory.address,
      'AssetVaultCreated',
      'tranches',
    ])

    expect(tranches.length).to.eq(3)

    for (let i = 0; i < tranches.length; i++) {
      const tranche = new TrancheVault__factory(wallet).attach(tranches[i])
      expect(await tranche.symbol()).to.eq(tranchesData[i].symbol)
      expect(await tranche.name()).to.eq(tranchesData[i].name)
    }
  })

  it('sets asset vault address in tranches', async () => {
    const { assetVaultFactory, wallet, createAssetVaultTx } = await loadFixture(assetVaultFactoryFixture)

    const tranches = await extractEventArgFromTx(createAssetVaultTx, [
      assetVaultFactory.address,
      'AssetVaultCreated',
      'tranches',
    ])

    const assetVaultAddress = await extractEventArgFromTx(createAssetVaultTx, [
      assetVaultFactory.address,
      'AssetVaultCreated',
      'newAssetVault',
    ])

    for (const trancheAddress of tranches) {
      const tranche = new TrancheVault__factory(wallet).attach(trancheAddress)
      expect(await tranche.portfolio()).to.eq(assetVaultAddress)
    }
  })

  it('emits event', async () => {
    const { assetVaultFactory, wallet, createAssetVaultTx } = await loadFixture(assetVaultFactoryFixture)

    const assetVaultAddress = await extractEventArgFromTx(createAssetVaultTx, [
      assetVaultFactory.address,
      'AssetVaultCreated',
      'newAssetVault',
    ])

    const managerAddress = await extractEventArgFromTx(createAssetVaultTx, [
      assetVaultFactory.address,
      'AssetVaultCreated',
      'manager',
    ])

    expect(assetVaultAddress).not.eq(constants.AddressZero)
    expect(managerAddress).to.eq(wallet.address)
  })
})
