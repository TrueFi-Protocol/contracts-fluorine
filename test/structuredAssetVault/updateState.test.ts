import { expect } from 'chai'
import { assetVaultFixture, assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { timeTravelFrom } from 'utils/timeTravel'
import { YEAR } from 'utils/constants'
import { timePassedBetween } from 'utils/timestamp'
import { getInterest } from 'utils/interest'

describe('StructuredAssetVault.updateState', () => {
  const loadFixture = setupFixtureLoader()

  const outstandingAssets = 1234

  it('only manager', async () => {
    const { other, updateState } = await loadFixture(assetVaultFixture)
    await expect(updateState(outstandingAssets, { sender: other })).to.be.revertedWith('SAV: Only manager')
  })

  it('is pausable', async () => {
    const {
      assetVault,
      protocolConfigParams: { pauser },
      updateState,
    } = await loadFixture(assetVaultFixture)
    await assetVault.connect(pauser).pause()
    await expect(updateState(outstandingAssets)).to.be.revertedWith('Pausable: paused')
  })

  it('reverts in capital formation state', async () => {
    const { updateState } = await loadFixture(assetVaultFixture)
    await expect(updateState(outstandingAssets)).to.be.revertedWith('SAV: Not allowed before start')
  })

  it('updates outstanding assets', async () => {
    const { assetVault, updateState } = await loadFixture(assetVaultLiveFixture)
    await updateState(outstandingAssets)
    expect(await assetVault.outstandingAssets()).to.eq(outstandingAssets)
  })

  it('updates asset report id if report is new', async () => {
    const { assetVault, updateState } = await loadFixture(assetVaultLiveFixture)
    const newAssetReportId = 'totallyPossibleAssetReportId'
    const assetReportHistoryLength = (await assetVault.getAssetReportHistory()).length
    await updateState(outstandingAssets, { newAssetReportId })
    expect((await assetVault.getAssetReportHistory()).length).to.eq(assetReportHistoryLength + 1)
    expect(await assetVault.latestAssetReportId()).to.eq(newAssetReportId)
  })

  it('does not update asset report id if report is old', async () => {
    const { assetVault, updateState, assetReportId } = await loadFixture(assetVaultLiveFixture)
    await updateState(outstandingAssets, { newAssetReportId: assetReportId })
    const assetReportHistoryLength = (await assetVault.getAssetReportHistory()).length
    await updateState(outstandingAssets, { newAssetReportId: assetReportId })
    expect((await assetVault.getAssetReportHistory()).length).to.eq(assetReportHistoryLength)
    expect(await assetVault.latestAssetReportId()).to.eq(assetReportId)
  })

  it('emits StateUpdated event', async () => {
    const { assetVault, updateState, assetReportId } = await loadFixture(assetVaultLiveFixture)
    const actionId = 0
    await expect(updateState(outstandingAssets))
      .to.emit(assetVault, 'StateUpdated')
      .withArgs(actionId, outstandingAssets, assetReportId)
  })

  it('increases action id', async () => {
    const { assetVault, updateState } = await loadFixture(assetVaultLiveFixture)
    await expect(updateState(outstandingAssets)).to.emit(assetVault, 'StateUpdated').withNamedArgs({ actionId: 0 })
    await expect(updateState(outstandingAssets)).to.emit(assetVault, 'StateUpdated').withNamedArgs({ actionId: 1 })
  })

  it('pays fees', async () => {
    const {
      assetVault,
      updateState,
      protocolConfig,
      protocolConfigParams: { protocolTreasury },
      token,
      tranches,
      parseTokenUnits,
    } = await loadFixture(assetVaultLiveFixture)
    const protocolFeeRate = 500
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)
    const initialAmount = await token.balanceOf(assetVault.address)

    const updateCheckpointTx = await assetVault.updateCheckpoints()
    await timeTravelFrom(updateCheckpointTx, YEAR)

    const amount = parseTokenUnits(123)

    const updateStateTx = await updateState(amount)
    const timePassed = await timePassedBetween(updateCheckpointTx, updateStateTx)
    const expectedFees = getInterest(initialAmount, protocolFeeRate, timePassed)

    // rounding issue: feeRate * assetVaultAssets != feeRate * seniorAssets + feeRate * juniorAssets + feeRate * equityAssets
    const delta = tranches.length
    expect(await token.balanceOf(protocolTreasury)).to.be.closeTo(expectedFees, delta)
  })
})
