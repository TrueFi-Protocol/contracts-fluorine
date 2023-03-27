import { DepositArgsStruct, DisburseArgsStruct } from 'build/types/MultiAction'
import { expect } from 'chai'
import { assetVaultFixture, assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { MONTH, YEAR } from 'utils/constants'
import { timePassedBetween } from 'utils/timestamp'
import { timeTravel, timeTravelAndMine, timeTravelFrom, timeTravelTo } from 'utils/timeTravel'
import { getInterest, withInterest } from 'utils/interest'

describe('StructuredAssetVault.disburse', () => {
  const loadFixture = setupFixtureLoader()

  const principal = 1234
  const interest = 5678

  it('only manager', async () => {
    const { other, disburse } = await loadFixture(assetVaultFixture)
    await expect(disburse(principal, { sender: other })).to.be.revertedWith('SAV: Only manager')
  })

  it('can send only to allowed borrower when whitelist is enabled', async () => {
    const { other, createAssetVault, assetReportId } = await loadFixture(assetVaultLiveFixture)
    const { assetVault } = await createAssetVault({ onlyAllowedBorrowers: true })
    await expect(assetVault.disburse(other.address, principal, principal, assetReportId)).to.be.revertedWith(
      'SAV: Recipient not whitelisted'
    )
  })

  it('can send to everyone when whitelist is disabled', async () => {
    const { other, disburse } = await loadFixture(assetVaultLiveFixture)
    await expect(disburse(principal, { recipient: other })).not.to.be.reverted
  })

  it('is pausable', async () => {
    const {
      assetVault,
      protocolConfigParams: { pauser },
      disburse,
    } = await loadFixture(assetVaultLiveFixture)
    await assetVault.connect(pauser).pause()
    await expect(disburse(principal)).to.be.revertedWith('Pausable: paused')
  })

  describe('only in Live status', () => {
    it('CapitalFormation', async () => {
      const { disburse } = await loadFixture(assetVaultFixture)
      await expect(disburse(principal)).to.be.revertedWith('SAV: AssetVault is not live')
    })

    it('Closed', async () => {
      const { disburse, startAndCloseAssetVault } = await loadFixture(assetVaultFixture)
      await startAndCloseAssetVault()
      await expect(disburse(principal)).to.be.revertedWith('SAV: AssetVault is not live')
    })

    it('Live', async () => {
      const { disburse } = await loadFixture(assetVaultLiveFixture)
      await expect(disburse(principal)).not.to.be.reverted
    })
  })

  it('reverts if has not enough funds', async () => {
    const { disburse, assetVault } = await loadFixture(assetVaultLiveFixture)
    const amount = (await assetVault.virtualTokenBalance()).add(1)
    await expect(disburse(amount)).to.be.revertedWith('SAV: Insufficient funds')
  })

  it('increases outstanding principal', async () => {
    const { assetVault, disburse } = await loadFixture(assetVaultLiveFixture)

    await disburse(principal)
    expect(await assetVault.outstandingPrincipal()).to.eq(principal)

    await disburse(principal)
    expect(await assetVault.outstandingPrincipal()).to.eq(2 * principal)
  })

  it('decreases virtual token balance', async () => {
    const { assetVault, disburse } = await loadFixture(assetVaultLiveFixture)
    const virtualTokenBalanceBefore = await assetVault.virtualTokenBalance()
    await disburse(principal)
    expect(await assetVault.virtualTokenBalance()).to.eq(virtualTokenBalanceBefore.sub(principal))
  })

  it('transfers tokens to sender', async () => {
    const { assetVault, token, wallet, disburse } = await loadFixture(assetVaultLiveFixture)
    await expect(disburse(principal)).to.changeTokenBalances(
      token,
      [assetVault.address, wallet.address],
      [-principal, principal]
    )
  })

  it('updates outstanding assets', async () => {
    const { assetVault, disburse } = await loadFixture(assetVaultLiveFixture)
    await disburse(principal, { interest })
    expect(await assetVault.outstandingAssets()).to.eq(principal + interest)
  })

  it('updates asset report id if report is new', async () => {
    const { assetVault, disburse } = await loadFixture(assetVaultLiveFixture)
    const newAssetReportId = 'totallyPossibleAssetReportId'
    const assetReportHistoryLength = (await assetVault.getAssetReportHistory()).length
    await disburse(principal, { interest, newAssetReportId })
    expect((await assetVault.getAssetReportHistory()).length).to.eq(assetReportHistoryLength + 1)
    expect(await assetVault.latestAssetReportId()).to.eq(newAssetReportId)
  })

  it('does not update asset report id if report is old', async () => {
    const { assetVault, disburse, assetReportId } = await loadFixture(assetVaultLiveFixture)
    await disburse(principal, { newAssetReportId: assetReportId })
    const assetReportHistoryLength = (await assetVault.getAssetReportHistory()).length
    await disburse(principal, { newAssetReportId: assetReportId })
    expect((await assetVault.getAssetReportHistory()).length).to.eq(assetReportHistoryLength)
    expect(await assetVault.latestAssetReportId()).to.eq(assetReportId)
  })

  it('emits Disburse event', async () => {
    const { assetVault, wallet, disburse, assetReportId } = await loadFixture(assetVaultLiveFixture)
    const actionId = 0
    await expect(disburse(principal, { interest }))
      .to.emit(assetVault, 'Disburse')
      .withArgs(actionId, wallet.address, principal, principal + interest, assetReportId)
  })

  it('increases action id', async () => {
    const { assetVault, disburse } = await loadFixture(assetVaultLiveFixture)
    await expect(disburse(principal)).to.emit(assetVault, 'Disburse').withNamedArgs({ actionId: 0 })
    await expect(disburse(principal)).to.emit(assetVault, 'Disburse').withNamedArgs({ actionId: 1 })
  })

  it('pays fees', async () => {
    const {
      assetVault,
      protocolConfig,
      protocolConfigParams: { protocolTreasury },
      token,
      tranches,
      parseTokenUnits,
      disburse,
    } = await loadFixture(assetVaultLiveFixture)
    const protocolFeeRate = 500
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)
    const initialAmount = await token.balanceOf(assetVault.address)

    const updateTx = await assetVault.updateCheckpoints()
    await timeTravel(YEAR)

    const principal = parseTokenUnits(123)

    const disburseTx = await disburse(principal)
    const timePassed = await timePassedBetween(updateTx, disburseTx)
    const expectedFees = getInterest(initialAmount, protocolFeeRate, timePassed)

    // rounding issue: feeRate * assetVaultAssets != feeRate * seniorAssets + feeRate * juniorAssets + feeRate * equityAssets
    const delta = tranches.length
    expect(await token.balanceOf(protocolTreasury)).to.be.closeTo(expectedFees, delta)
  })

  it('reverts when pending fees too high', async () => {
    const { assetVault, protocolConfig, token, parseTokenUnits, disburse } = await loadFixture(assetVaultLiveFixture)
    const protocolFeeRate = 500
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

    await assetVault.updateCheckpoints()
    await timeTravelAndMine(YEAR)

    const assetVaultBalance = await token.balanceOf(assetVault.address)
    const pendingFees = await assetVault.totalPendingFees()
    const amountToKeep = pendingFees.add(parseTokenUnits(50_000))

    const firstDisbursement = assetVaultBalance.sub(amountToKeep)
    await disburse(firstDisbursement)

    const secondDisbursement = amountToKeep.sub(pendingFees).mul(2)
    await expect(disburse(secondDisbursement)).to.be.revertedWith('SAV: Insufficient funds')
  })

  it('disburse and deposit in the same block', async () => {
    const {
      assetVault,
      parseTokenUnits,
      assetReportId,
      totalDeposit,
      deployMultiAction,
      wallet,
      other,
      senior,
      seniorTranche,
      assetVaultStartTimestamp,
    } = await loadFixture(assetVaultLiveFixture)

    const { multiAction } = await deployMultiAction()

    const disburseArgs = {
      recipient: wallet.address,
      amount: parseTokenUnits(1e6),
      outstandingAssets: parseTokenUnits(3e6),
      assetReportId,
    } satisfies DisburseArgsStruct

    const depositArgs = {
      amount: parseTokenUnits(1e6),
      receiver: other.address,
    } satisfies DepositArgsStruct

    await timeTravelTo(assetVaultStartTimestamp + MONTH)
    await multiAction.disburseAndDeposit(disburseArgs, depositArgs, senior.trancheIdx)

    expect(await assetVault.virtualTokenBalance()).to.eq(totalDeposit.sub(disburseArgs.amount).add(depositArgs.amount))
    expect(await assetVault.outstandingAssets()).to.eq(disburseArgs.outstandingAssets)
    expect(await assetVault.outstandingPrincipal()).to.eq(disburseArgs.amount)

    const seniorAssets = withInterest(senior.initialDeposit, senior.targetApy, MONTH)
    expect((await seniorTranche.getCheckpoint()).totalAssets).to.eq(seniorAssets.add(depositArgs.amount))
  })

  it('disburse and deposit in the same block (with fees)', async () => {
    const {
      assetVault,
      parseTokenUnits,
      assetReportId,
      totalDeposit,
      deployMultiAction,
      wallet,
      other,
      senior,
      seniorTranche,
      protocolConfig,
    } = await loadFixture(assetVaultLiveFixture)
    const protocolFeeRate = 100
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)
    const updateCheckpointsTx = await assetVault.updateCheckpoints()

    const { multiAction } = await deployMultiAction()

    const disburseArgs = {
      recipient: wallet.address,
      amount: parseTokenUnits(1e6),
      outstandingAssets: parseTokenUnits(3e6),
      assetReportId,
    } satisfies DisburseArgsStruct

    const depositArgs = {
      amount: parseTokenUnits(1e6),
      receiver: other.address,
    } satisfies DepositArgsStruct

    await timeTravelFrom(updateCheckpointsTx, MONTH)
    await multiAction.disburseAndDeposit(disburseArgs, depositArgs, senior.trancheIdx)

    const totalProtocolFee = getInterest(totalDeposit, protocolFeeRate, MONTH)
    expect(await assetVault.virtualTokenBalance()).to.be.closeTo(
      totalDeposit.sub(disburseArgs.amount).add(depositArgs.amount).sub(totalProtocolFee),
      10
    )
    expect(await assetVault.outstandingAssets()).to.eq(disburseArgs.outstandingAssets)
    expect(await assetVault.outstandingPrincipal()).to.eq(disburseArgs.amount)

    const seniorAssetsBeforeFee = withInterest(senior.initialDeposit, senior.targetApy, MONTH)
    const seniorProtocolFee = getInterest(seniorAssetsBeforeFee, protocolFeeRate, MONTH)
    const seniorCheckpointAssets = seniorAssetsBeforeFee.sub(seniorProtocolFee).add(depositArgs.amount)

    const delta = parseTokenUnits(0.1)
    expect((await seniorTranche.getCheckpoint()).totalAssets).to.be.closeTo(seniorCheckpointAssets, delta)
  })
})
