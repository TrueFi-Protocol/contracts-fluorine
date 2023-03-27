import { expect } from 'chai'
import { assetVaultFixture, assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { getTxTimestamp } from 'utils/timestamp'
import { percentOf } from 'utils/percentOf'

describe('StructuredAssetVault.start', () => {
  const loadFixture = setupFixtureLoader()

  it('changes status', async () => {
    const { assetVault, AssetVaultStatus } = await loadFixture(assetVaultFixture)
    expect(await assetVault.status()).to.eq(AssetVaultStatus.CapitalFormation)
    await assetVault.start()
    expect(await assetVault.status()).to.eq(AssetVaultStatus.Live)
  })

  describe('only in Capital Formation status', () => {
    it('reverts in Live', async () => {
      const { assetVault } = await loadFixture(assetVaultLiveFixture)
      await expect(assetVault.start()).to.be.revertedWith('SAV: Only in capital formation')
    })

    it('reverts in Closed', async () => {
      const { assetVault } = await loadFixture(assetVaultLiveFixture)
      await assetVault.close()
      await expect(assetVault.start()).to.be.revertedWith('SAV: Only in capital formation')
    })

    it('passes in CapitalFormation', async () => {
      const { assetVault } = await loadFixture(assetVaultFixture)
      await expect(assetVault.start()).not.to.be.reverted
    })
  })

  it('only manager', async () => {
    const { assetVault, other } = await loadFixture(assetVaultFixture)
    await expect(assetVault.connect(other).start()).to.be.revertedWith('SAV: Only manager')
  })

  it('incorrect senior to subordinate tranches ratio', async () => {
    const seniorMinSubordinateRatio = 2000
    const { parseTokenUnits, depositToTranche, equityTranche, juniorTranche, seniorTranche, assetVault } =
      await loadFixture(assetVaultFixture)
    await assetVault.setTrancheMinSubordinateRatio(2, seniorMinSubordinateRatio)

    const seniorDeposit = parseTokenUnits(1000)
    const expectedSubordinateDeposit = percentOf(seniorDeposit, seniorMinSubordinateRatio)
    const subordinateDeposit = expectedSubordinateDeposit.sub(2)

    const equityDeposit = subordinateDeposit.div(2)
    await depositToTranche(equityTranche, equityDeposit)

    const juniorDeposit = subordinateDeposit.div(2)
    await depositToTranche(juniorTranche, juniorDeposit)

    await depositToTranche(seniorTranche, seniorDeposit)

    await expect(assetVault.start()).to.be.revertedWith('SAV: Tranche min ratio not met')
  })

  it('incorrect junior to equity ratio', async () => {
    const juniorMinSubordinateRatio = 2000
    const { parseTokenUnits, depositToTranche, equityTranche, juniorTranche, assetVault } = await loadFixture(
      assetVaultFixture
    )
    await assetVault.setTrancheMinSubordinateRatio(1, juniorMinSubordinateRatio)

    const juniorDeposit = parseTokenUnits(1000)
    const expectedSubordinateValue = percentOf(juniorDeposit, juniorMinSubordinateRatio)
    const equityDeposit = expectedSubordinateValue.sub(1)

    await depositToTranche(equityTranche, equityDeposit)
    await depositToTranche(juniorTranche, juniorDeposit)

    await expect(assetVault.start()).to.be.revertedWith('SAV: Tranche min ratio not met')
  })

  it('pulls funds from vaults to AssetVault', async () => {
    const { assetVault, tranches, token, depositToTranche } = await loadFixture(assetVaultFixture)
    const initialStructuredAssetVaultBalance = await token.balanceOf(assetVault.address)

    const depositAmount = 100

    for (const tranche of tranches) {
      await depositToTranche(tranche, depositAmount)
    }

    await assetVault.start()

    for (const tranche of tranches) {
      expect(await token.balanceOf(tranche.address)).to.eq(0)
    }
    expect(await token.balanceOf(assetVault.address)).to.eq(
      initialStructuredAssetVaultBalance.add(depositAmount * tranches.length)
    )
  })

  it('updates checkpoint', async () => {
    const { assetVault, tranches, depositToTranche } = await loadFixture(assetVaultFixture)
    const values = [100, 150, 200]

    for (let i = 0; i < tranches.length; i++) {
      await depositToTranche(tranches[i], values[i])
    }

    const tx = await assetVault.start()
    const txTimestamp = await getTxTimestamp(tx)

    for (let i = 0; i < values.length; i++) {
      const { totalAssets, timestamp } = await tranches[i].getCheckpoint()
      expect(totalAssets).to.eq(values[i])
      expect(timestamp).to.eq(txTimestamp)
    }
  })

  it('sets AssetVault start date', async () => {
    const { assetVault } = await loadFixture(assetVaultFixture)
    const tx = await assetVault.start()
    expect(await assetVault.startDate()).to.eq(await getTxTimestamp(tx))
  })

  it('sets AssetVault end date', async () => {
    const { assetVault, assetVaultDuration } = await loadFixture(assetVaultFixture)
    const tx = await assetVault.start()
    const txTimestamp = await getTxTimestamp(tx)
    expect(await assetVault.endDate()).to.eq(txTimestamp + assetVaultDuration)
  })

  it('emits event', async () => {
    const { assetVault, AssetVaultStatus } = await loadFixture(assetVaultFixture)
    await expect(assetVault.start()).to.emit(assetVault, 'AssetVaultStatusChanged').withArgs(AssetVaultStatus.Live)
  })

  it('reverts if minimum tranche size on any tranche is not met', async () => {
    const { assetVault, tranches, depositToTranche } = await loadFixture(assetVaultFixture)
    const depositAmount = 100
    await assetVault.setMinimumSize(depositAmount)

    await expect(assetVault.start()).to.be.revertedWith('SAV: Minimum size not reached')
    await depositToTranche(tranches[0], depositAmount)
    await expect(assetVault.start()).to.be.not.reverted
  })

  it('reverts when AssetVault is paused', async () => {
    const {
      assetVault,
      protocolConfigParams: { pauser },
    } = await loadFixture(assetVaultFixture)
    await assetVault.connect(pauser).pause()

    await expect(assetVault.start()).to.be.revertedWith('Pausable: paused')
  })

  it('does not allow share value manipulation', async () => {
    const {
      assetVault,
      token,
      wallet: malicious,
      other: victim,
      equityTranche,
      startAssetVaultAndEnableLiveActions,
      parseTokenUnits,
    } = await loadFixture(assetVaultFixture)

    const amount = parseTokenUnits(1_000)
    const singleWei = 1

    // Frontrunning
    await token.connect(malicious).approve(equityTranche.address, singleWei)
    await equityTranche.connect(malicious).deposit(singleWei, malicious.address)
    await token.connect(malicious).transfer(assetVault.address, amount)

    await startAssetVaultAndEnableLiveActions()

    await token.connect(victim).approve(equityTranche.address, amount.div(2))
    await equityTranche.connect(victim).deposit(amount.div(2), victim.address)

    // The victim tokens are taken over by malicious address
    expect(await equityTranche.maxWithdraw(victim.address)).gt(0)
  })
})
