import { expect } from 'chai'
import { AssetVaultStatus, assetVaultFixture, assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { timeTravel, timeTravelTo } from 'utils/timeTravel'
import { DAY, YEAR } from 'utils/constants'
import { getTxTimestamp, timePassedBetween } from 'utils/timestamp'
import { getInterest, withInterest } from 'utils/interest'

describe('StructuredAssetVault.close', () => {
  const loadFixture = setupFixtureLoader()

  const DELTA = 1e5

  it('sets status to Closed', async () => {
    const { assetVault } = await loadFixture(assetVaultLiveFixture)
    await assetVault.close()
    expect(await assetVault.status()).to.equal(AssetVaultStatus.Closed)
  })

  it('transfers assets to vaults', async () => {
    const { assetVault, tranches, token, initialDeposits } = await loadFixture(assetVaultLiveFixture)

    await assetVault.close()

    expect(await token.balanceOf(tranches[0].address)).to.be.closeTo(initialDeposits[0], DELTA)
    expect(await token.balanceOf(tranches[1].address)).to.be.closeTo(initialDeposits[1], DELTA)
    expect(await token.balanceOf(tranches[2].address)).to.be.closeTo(initialDeposits[2], DELTA)
    expect(await token.balanceOf(assetVault.address)).to.eq(0)
  })

  it('cannot be closed twice', async () => {
    const { assetVault } = await loadFixture(assetVaultLiveFixture)
    await assetVault.close()
    await expect(assetVault.close()).to.be.revertedWith('SAV: AssetVault already closed')
  })

  it('distribute assets correctly when nothing was disbursed', async () => {
    const {
      assetVaultDuration,
      assetVault,
      senior,
      junior,
      seniorTranche,
      juniorTranche,
      equityTranche,
      totalDeposit,
      assetVaultStartTimestamp,
    } = await loadFixture(assetVaultLiveFixture)

    await timeTravelTo(assetVaultStartTimestamp + assetVaultDuration)
    await assetVault.close()

    const expectedSeniorAssets = withInterest(senior.initialDeposit, senior.targetApy, assetVaultDuration)
    const expectedJuniorAssets = withInterest(junior.initialDeposit, junior.targetApy, assetVaultDuration)
    const expectedEquityAssets = totalDeposit.sub(expectedSeniorAssets).sub(expectedJuniorAssets)
    expect(await seniorTranche.totalAssets()).to.eq(expectedSeniorAssets)
    expect(await juniorTranche.totalAssets()).to.eq(expectedJuniorAssets)
    expect(await equityTranche.totalAssets()).to.eq(expectedEquityAssets)
  })

  describe('with outstanding assets', () => {
    it('cannot close before end date', async () => {
      const { assetVault, disburse } = await loadFixture(assetVaultLiveFixture)
      await disburse(1000)
      await expect(assetVault.close()).to.be.revertedWith('SAV: Outstanding assets exist')
    })

    it('can close after end date', async () => {
      const { assetVault, disburse, assetVaultDuration, assetVaultStartTimestamp } = await loadFixture(
        assetVaultLiveFixture
      )
      await disburse(1000)
      await timeTravelTo(assetVaultStartTimestamp + assetVaultDuration + 1)
      await assetVault.close()
      expect(await assetVault.status()).to.eq(AssetVaultStatus.Closed)
    })
  })

  it("user can't close before end date", async () => {
    const { assetVault, other } = await loadFixture(assetVaultLiveFixture)
    await expect(assetVault.connect(other).close()).to.be.revertedWith("SAV: Can't close before end date")
  })

  it('user can close after end date', async () => {
    const { assetVault, other, AssetVaultStatus, assetVaultDuration, assetVaultStartTimestamp } = await loadFixture(
      assetVaultLiveFixture
    )

    await timeTravelTo(assetVaultStartTimestamp + assetVaultDuration + 1)

    await assetVault.connect(other).close()
    expect(await assetVault.status()).to.equal(AssetVaultStatus.Closed)
  })

  it('can close after outstanding assets repaid', async () => {
    const { assetVault, disburse, repay, AssetVaultStatus, parseTokenUnits } = await loadFixture(assetVaultLiveFixture)
    const principal = parseTokenUnits(1e6)
    const interest = parseTokenUnits(1e5)
    await disburse(principal, { interest })
    await repay(principal, interest)

    await assetVault.close()
    expect(await assetVault.status()).to.equal(AssetVaultStatus.Closed)
  })

  it('sets distributed assets', async () => {
    const { assetVault, tranches } = await loadFixture(assetVaultLiveFixture)
    await assetVault.close()
    for (let i = 0; i < tranches.length; i++) {
      const { distributedAssets } = await assetVault.tranchesData(i)
      expect(distributedAssets).to.eq(await tranches[i].totalAssets())
    }
  })

  it('sets max possible waterfall values', async () => {
    const { assetVault, senior, junior } = await loadFixture(assetVaultLiveFixture)

    await timeTravel(YEAR / 2)
    await assetVault.updateCheckpoints()
    const waterfall = await assetVault.calculateWaterfall()

    await timeTravel(YEAR / 2)
    await assetVault.close()

    expect((await assetVault.tranchesData(0)).maxValueOnClose).to.eq(0)
    expect((await assetVault.tranchesData(1)).maxValueOnClose).to.be.closeTo(
      withInterest(waterfall[1], junior.targetApy, YEAR / 2),
      DELTA
    )
    expect((await assetVault.tranchesData(2)).maxValueOnClose).to.be.closeTo(
      withInterest(waterfall[2], senior.targetApy, YEAR / 2),
      DELTA
    )
  })

  it('close before predicted end date updates AssetVault end date', async () => {
    const { assetVault } = await loadFixture(assetVaultLiveFixture)

    await timeTravel(YEAR)
    const tx = await assetVault.close()

    expect(await assetVault.endDate()).to.eq(await getTxTimestamp(tx))
  })

  it('close after predicted end date does not update AssetVault end date', async () => {
    const { assetVault, assetVaultDuration, assetVaultStartTx } = await loadFixture(assetVaultLiveFixture)

    await timeTravel(assetVaultDuration + DAY)
    await assetVault.close()

    const expectedEndDate = (await getTxTimestamp(assetVaultStartTx)) + assetVaultDuration
    expect(await assetVault.endDate()).to.eq(expectedEndDate)
  })

  it('emits event', async () => {
    const { assetVault, AssetVaultStatus } = await loadFixture(assetVaultLiveFixture)
    await expect(assetVault.close()).to.emit(assetVault, 'AssetVaultStatusChanged').withArgs(AssetVaultStatus.Closed)
  })

  it('transfers accrued protocol fees', async () => {
    const { assetVault, protocolConfig, protocolConfigParams, token, tranches, totalDeposit } = await loadFixture(
      assetVaultLiveFixture
    )
    const protocolFeeRate = 500
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)
    const updateTx = await assetVault.updateCheckpoints()

    await timeTravel(YEAR)
    const closeTx = await assetVault.close()

    const timePassed = await timePassedBetween(updateTx, closeTx)
    const expectedProtocolFees = getInterest(totalDeposit, protocolFeeRate, timePassed)
    expect(await token.balanceOf(protocolConfigParams.protocolTreasury)).to.be.closeTo(
      expectedProtocolFees,
      tranches.length
    )
  })

  it('transfers accrued manager fees', async () => {
    const {
      seniorTranche,
      assetVault,
      token,
      another,
      senior: { initialDeposit, targetApy },
      parseTokenUnits,
    } = await loadFixture(assetVaultLiveFixture)
    const managerFeeRate = 500
    await seniorTranche.setManagerFeeBeneficiary(another.address)
    await seniorTranche.setManagerFeeRate(managerFeeRate)
    const updateTx = await assetVault.updateCheckpoints()

    await timeTravel(YEAR)
    const closeTx = await assetVault.close()

    const timePassed = await timePassedBetween(updateTx, closeTx)
    const expectedSeniorValue = withInterest(initialDeposit, targetApy, timePassed)
    const expectedManagerFees = getInterest(expectedSeniorValue, managerFeeRate, timePassed)
    const delta = parseTokenUnits(0.1)
    expect(await token.balanceOf(another.address)).to.be.closeTo(expectedManagerFees, delta)
  })

  it('no assets remain in the AssetVault', async () => {
    const { assetVault, protocolConfig, token } = await loadFixture(assetVaultLiveFixture)
    await protocolConfig.setDefaultProtocolFeeRate(500)

    await timeTravel(YEAR)
    await assetVault.close()

    expect(await token.balanceOf(assetVault.address)).to.eq(0)
  })

  it('updates checkpoint with proper values in tranche', async () => {
    const { assetVault, seniorTranche, senior, protocolConfig, assetVaultStartTimestamp } = await loadFixture(
      assetVaultLiveFixture
    )
    const protocolFeeRate = 500
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

    await timeTravel(YEAR)
    const tx = await assetVault.close()
    const [totalAssets, checkpointProtocolFeeRate, timestamp] = await seniorTranche.getCheckpoint()

    const closeTimestamp = await getTxTimestamp(tx)
    const timePassed = closeTimestamp - assetVaultStartTimestamp
    const expectedTotalAssets = withInterest(senior.initialDeposit, senior.targetApy, timePassed)

    expect(totalAssets).to.eq(expectedTotalAssets)
    expect(checkpointProtocolFeeRate).to.eq(protocolFeeRate)
    expect(timestamp).to.eq(closeTimestamp)
  })

  it('updates checkpoint in each tranche', async () => {
    const { assetVault, seniorTranche, juniorTranche, equityTranche } = await loadFixture(assetVaultLiveFixture)
    await expect(assetVault.close())
      .to.emit(seniorTranche, 'CheckpointUpdated')
      .to.emit(juniorTranche, 'CheckpointUpdated')
      .to.emit(equityTranche, 'CheckpointUpdated')
  })

  describe('capital formation', () => {
    it('does not transfer assets', async () => {
      const { assetVault, token } = await loadFixture(assetVaultFixture)

      const balanceBefore = await token.balanceOf(assetVault.address)
      const tx = await assetVault.close()
      const balanceAfter = await token.balanceOf(assetVault.address)

      expect(balanceAfter).to.eq(balanceBefore)
      await expect(Promise.resolve(tx)).to.not.emit(token, 'Transfer')
    })

    it("user can't close before deadline", async () => {
      const { assetVault, other } = await loadFixture(assetVaultFixture)
      await expect(assetVault.connect(other).close()).to.be.revertedWith('SAV: Only after start deadline')
    })

    it('user can close after deadline', async () => {
      const { assetVault, other, maxCapitalFormationDuration } = await loadFixture(assetVaultFixture)
      await timeTravel(maxCapitalFormationDuration)
      await assetVault.connect(other).close()
      expect(await assetVault.status()).to.equal(AssetVaultStatus.Closed)
    })
  })

  it('reverts when AssetVault is paused', async () => {
    const {
      assetVault,
      protocolConfigParams: { pauser },
    } = await loadFixture(assetVaultLiveFixture)
    await assetVault.connect(pauser).pause()

    await expect(assetVault.close()).to.be.revertedWith('Pausable: paused')
  })
})
