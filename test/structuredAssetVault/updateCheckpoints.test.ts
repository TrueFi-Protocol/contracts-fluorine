import { CheckpointStructOutput } from 'build/types/TrancheVault'
import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { getAssetVaultFixture, assetVaultFixture, assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { YEAR } from 'utils/constants'
import { getTxTimestamp } from 'utils/timestamp'
import { getInterest, withInterest } from 'utils/interest'
import { percentOf } from 'utils/percentOf'
import { timeTravel, timeTravelAndMine, timeTravelFrom, timeTravelTo } from 'utils/timeTravel'

describe('StructuredAssetVault.updateCheckpoints', () => {
  const loadFixture = setupFixtureLoader()

  it('is pausable', async () => {
    const {
      assetVault,
      protocolConfigParams: { pauser },
    } = await loadFixture(assetVaultFixture)
    await assetVault.connect(pauser).pause()
    await expect(assetVault.updateCheckpoints()).to.be.revertedWith('Pausable: paused')
  })

  it('reverts in CapitalFormation', async () => {
    const { assetVault } = await loadFixture(assetVaultFixture)
    await expect(assetVault.updateCheckpoints()).to.be.revertedWith('SAV: No checkpoints before start')
  })

  it('collects fees in Closed state', async () => {
    const {
      assetVault,
      depositToTranche,
      parseTokenUnits,
      maxCapitalFormationDuration,
      createAssetVaultTx,
      protocolConfig,
      seniorTranche,
    } = await loadFixture(assetVaultFixture)
    const protocolFee = 500
    await protocolConfig.setDefaultProtocolFeeRate(protocolFee)

    const depositAmount = parseTokenUnits(1000)
    await depositToTranche(seniorTranche, depositAmount)

    await timeTravelFrom(createAssetVaultTx, maxCapitalFormationDuration + 1)
    const closeTx = await assetVault.close()
    await timeTravelFrom(closeTx, YEAR)

    expect(await seniorTranche.totalAssets()).to.eq(depositAmount)
    await assetVault.updateCheckpoints()

    const expectedFee = percentOf(depositAmount, protocolFee)
    expect(await seniorTranche.totalAssets()).to.eq(depositAmount.sub(expectedFee))
  })

  it('updates checkpoint', async () => {
    const {
      protocolConfig,
      assetVault,
      senior,
      junior,
      seniorTranche,
      juniorTranche,
      equityTranche,
      parseTokenUnits,
      totalDeposit,
    } = await loadFixture(assetVaultLiveFixture)
    const protocolFeeRate = 500
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

    await timeTravel(YEAR)

    const tx = await assetVault.updateCheckpoints()
    const txTimestamp = await getTxTimestamp(tx)

    const seniorTargetValue = withInterest(senior.initialDeposit, senior.targetApy, YEAR)
    const juniorTargetValue = withInterest(junior.initialDeposit, junior.targetApy, YEAR)
    const equityTargetValue = totalDeposit.sub(seniorTargetValue).sub(juniorTargetValue)

    const seniorCheckpoint = await seniorTranche.getCheckpoint()
    const juniorCheckpoint = await juniorTranche.getCheckpoint()
    const equityCheckpoint = await equityTranche.getCheckpoint()

    const delta = parseTokenUnits(0.1)

    function assertCheckpoint(checkpoint: CheckpointStructOutput, expectedTotalAssets: BigNumber) {
      expect(checkpoint.totalAssets).to.be.closeTo(expectedTotalAssets, delta)
      expect(checkpoint.protocolFeeRate).to.eq(protocolFeeRate)
      expect(checkpoint.timestamp).to.eq(txTimestamp)
    }

    assertCheckpoint(seniorCheckpoint, seniorTargetValue)
    assertCheckpoint(juniorCheckpoint, juniorTargetValue)
    assertCheckpoint(equityCheckpoint, equityTargetValue)
  })

  it('emits CheckpointUpdated event', async () => {
    const {
      protocolConfig,
      assetVault,
      senior,
      junior,
      seniorTranche,
      juniorTranche,
      equityTranche,
      assetVaultStartTimestamp,
      totalDeposit,
    } = await loadFixture(assetVaultLiveFixture)
    const protocolFeeRate = 500
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

    const timePassed = YEAR
    await timeTravelTo(assetVaultStartTimestamp + timePassed)
    const tx = await assetVault.updateCheckpoints()

    const seniorExpectedValue = withInterest(senior.initialDeposit, senior.targetApy, timePassed)
    const juniorExpectedValue = withInterest(junior.initialDeposit, junior.targetApy, timePassed)
    const equityExpectedValue = totalDeposit.sub(seniorExpectedValue).sub(juniorExpectedValue)

    await expect(tx)
      .to.emit(seniorTranche, 'CheckpointUpdated')
      .withArgs(seniorExpectedValue, protocolFeeRate)
      .to.emit(juniorTranche, 'CheckpointUpdated')
      .withArgs(juniorExpectedValue, protocolFeeRate)
      .to.emit(equityTranche, 'CheckpointUpdated')
      .withArgs(equityExpectedValue, protocolFeeRate)
  })

  it('updating multiple times does not add too much interest', async () => {
    const { assetVault, assetVaultDuration, parseTokenUnits, senior, junior } = await loadFixture(assetVaultLiveFixture)
    const updatesCount = 20
    const period = assetVaultDuration / updatesCount

    for (let i = 0; i < updatesCount; i++) {
      await assetVault.updateCheckpoints()
      await timeTravel(period)
    }

    const waterfall = await assetVault.calculateWaterfall()

    const seniorExpectedValue = withInterest(senior.initialDeposit, senior.targetApy, assetVaultDuration)
    const juniorExpectedValue = withInterest(junior.initialDeposit, junior.targetApy, assetVaultDuration)

    const delta = parseTokenUnits(3e4)
    expect(waterfall[2]).to.be.closeTo(seniorExpectedValue, delta)
    expect(waterfall[1]).to.be.closeTo(juniorExpectedValue, delta)
  })

  it('does not revert when fee is over balance', async () => {
    const {
      assetVault,
      protocolConfig,
      seniorTranche,
      juniorTranche,
      equityTranche,
      depositToTranche,
      parseTokenUnits,
      token,
      startAssetVaultAndEnableLiveActions,
    } = await loadFixture(assetVaultFixture)
    const protocolFeeRate = 10000
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

    await startAssetVaultAndEnableLiveActions()
    await depositToTranche(equityTranche, parseTokenUnits(4000))
    await depositToTranche(juniorTranche, parseTokenUnits(2000))
    await depositToTranche(seniorTranche, parseTokenUnits(1000))
    await timeTravel(YEAR)

    await token.transfer(assetVault.address, parseTokenUnits(0.1))

    await expect(assetVault.updateCheckpoints()).not.to.be.reverted
  })

  describe('with deficit', () => {
    it('deficit cannot be repeatedly assigned to tranche interest', async () => {
      const {
        depositToTranche,
        disburse,
        updateState,
        loseAssets,
        seniorTranche,
        juniorTranche,
        equityTranche,
        parseTokenUnits,
        assetVault,
        tranches,
      } = await loadFixture(getAssetVaultFixture({ tokenDecimals: 18, targetApys: [0, 200, 100] }))

      const totalAssets: BigNumber[] = []
      const delta = parseTokenUnits('0.000001')
      async function assertTotalAssets() {
        for (let i = 0; i < tranches.length; i++) {
          expect(await tranches[i].totalAssets()).to.be.closeTo(totalAssets[i], delta)
        }
      }

      const amount = parseTokenUnits(100)
      await depositToTranche(seniorTranche, amount)
      await depositToTranche(juniorTranche, amount)
      await depositToTranche(equityTranche, amount)

      await assetVault.start()

      const principal = parseTokenUnits(180)
      const interest = percentOf(principal, 1000) // 10%

      await disburse(principal)
      await disburse(parseTokenUnits(102))
      await loseAssets(parseTokenUnits(102))

      await timeTravelAndMine(YEAR)
      await updateState(principal.add(interest))
      for (let i = 0; i < tranches.length; i++) {
        totalAssets.push(await tranches[i].totalAssets())
      }

      await assetVault.updateCheckpoints()
      await assertTotalAssets()

      await assetVault.updateCheckpoints()
      await assertTotalAssets()

      await assetVault.updateCheckpoints()
      await assertTotalAssets()
    })

    it("calling multiple times doesn't change loan deficit", async () => {
      const { totalDeposit, updateState, disburse, protocolConfig, assetVault, tranches, senior, junior, equity } =
        await loadFixture(assetVaultLiveFixture)
      const protocolFeeRate = 500
      await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

      const principal = totalDeposit.sub(1e5)
      const interest = 1e5
      await disburse(principal, { interest })
      await timeTravel(YEAR / 2)
      await updateState(0)

      for (const tranche of tranches) {
        expect(await tranche.unpaidProtocolFee()).to.be.gt(0)
      }

      const seniorDeficitBefore = await senior.getCurrentDeficit()
      const juniorDeficitBefore = await junior.getCurrentDeficit()
      const equityDeficitBefore = await equity.getCurrentDeficit()

      for (let i = 0; i < 6; i++) {
        await assetVault.updateCheckpoints()
      }

      const seniorDeficitAfter = await senior.getCurrentDeficit()
      const juniorDeficitAfter = await junior.getCurrentDeficit()
      const equityDeficitAfter = await equity.getCurrentDeficit()

      const delta = 1e5

      expect(seniorDeficitBefore).to.be.closeTo(seniorDeficitAfter, delta)
      expect(juniorDeficitBefore).to.be.closeTo(juniorDeficitAfter, delta)
      expect(equityDeficitBefore).to.be.closeTo(equityDeficitAfter, delta)
    })

    it('unpaid fees cannot repeatedly increase deficit', async () => {
      const {
        totalDeposit,
        disburse,
        updateState,
        protocolConfig,
        assetVault,
        repay,
        senior,
        junior,
        tranches,
        parseTokenUnits,
      } = await loadFixture(assetVaultLiveFixture)
      const protocolFeeRate = 500
      await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

      const principal = totalDeposit.sub(1)
      const interest = 1e5
      await disburse(principal, { interest })

      const timePassed = YEAR / 2
      await timeTravel(timePassed)
      await updateState(0)

      for (const tranche of tranches) {
        expect(await tranche.unpaidProtocolFee()).to.be.gt(0)
      }

      for (let i = 0; i < 6; i++) {
        await assetVault.updateCheckpoints()
      }

      await repay(principal, interest, { outstandingAssets: 0 })

      const seniorBeforeFee = withInterest(senior.initialDeposit, senior.targetApy, timePassed)
      const seniorProtocolFee = getInterest(seniorBeforeFee, protocolFeeRate, timePassed)
      const seniorAfterFee = seniorBeforeFee.sub(seniorProtocolFee)

      const juniorBeforeFee = withInterest(junior.initialDeposit, junior.targetApy, timePassed)
      const juniorProtocolFee = getInterest(juniorBeforeFee, protocolFeeRate, timePassed)
      const juniorAfterFee = juniorBeforeFee.sub(juniorProtocolFee)

      const equityBeforeFee = totalDeposit.sub(seniorBeforeFee).sub(juniorBeforeFee)
      const equityProtocolFee = getInterest(equityBeforeFee, protocolFeeRate, timePassed)
      const equityAfterFee = equityBeforeFee.sub(equityProtocolFee)

      const [equityValue, juniorValue, seniorValue] = await assetVault.calculateWaterfall()

      const delta = parseTokenUnits(1)
      expect(seniorValue).to.be.closeTo(seniorAfterFee, delta)
      expect(juniorValue).to.be.closeTo(juniorAfterFee, delta)
      expect(equityValue).to.be.closeTo(equityAfterFee, delta)
    })

    it('pending fees do not influence deficit', async () => {
      const {
        disburse,
        protocolConfig,
        updateState,
        parseTokenUnits,
        assetVault,
        equity,
        juniorTranche,
        junior,
        senior,
        depositToTranche,
      } = await loadFixture(assetVaultLiveFixture)

      // drain equity tranche and small amount from junior to cause deficit on default
      const disbursement = equity.initialDeposit.add(BigNumber.from(1e3))
      await disburse(disbursement)
      await updateState(0)

      expect(await junior.getCurrentDeficit()).to.be.gt(0)

      // start accruing fees on junior
      const protocolFeeRate = 100
      await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)
      await assetVault.updateCheckpoints()

      await timeTravelAndMine(2 * YEAR)

      const seniorInterest = getInterest(senior.initialDeposit, senior.targetApy, 2 * YEAR)
      const expectedJuniorBeforeFees = junior.initialDeposit.sub(seniorInterest)
      const expectedJuniorFees = getInterest(expectedJuniorBeforeFees, protocolFeeRate, 2 * YEAR)

      const delta = parseTokenUnits('0.01')

      expect(await juniorTranche.pendingProtocolFee()).to.be.closeTo(expectedJuniorFees, delta)
      let { deficit } = (await assetVault.tranchesData(1)).deficitCheckpoint
      expect(deficit).to.be.gt(0)
      expect(deficit).to.be.lt(parseTokenUnits(0.2))

      await depositToTranche(juniorTranche, parseTokenUnits(6e6))
      ;({ deficit } = (await assetVault.tranchesData(1)).deficitCheckpoint)
      expect(deficit).to.be.gt(0)
      expect(deficit).to.be.lt(parseTokenUnits(0.2))

      await assetVault.updateCheckpoints()
      ;({ deficit } = (await assetVault.tranchesData(1)).deficitCheckpoint)
      expect(deficit).to.be.gt(0)
      expect(deficit).to.be.lt(parseTokenUnits(0.2))
    })

    it('fees calculated correctly with deficit', async () => {
      const { disburse, protocolConfig, assetVault, seniorTranche, senior, totalDeposit, loseAssets } =
        await loadFixture(assetVaultLiveFixture)

      const firstDisbursement = totalDeposit.sub(senior.initialDeposit.div(2))
      await disburse(firstDisbursement)

      const secondDisbursement = senior.initialDeposit.div(2)
      await disburse(secondDisbursement, { interest: senior.initialDeposit.div(2) })
      await loseAssets(firstDisbursement)

      // start accruing fees
      const protocolFeeRate = 100
      await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)
      const updateCheckpointsTx = await assetVault.updateCheckpoints()

      expect(await seniorTranche.unpaidProtocolFee()).to.eq(0)

      const timePassed = YEAR
      await timeTravelFrom(updateCheckpointsTx, timePassed)
      await assetVault.updateCheckpoints()

      const seniorAssumedValue = senior.initialDeposit
      const seniorAssumedValueFee = getInterest(seniorAssumedValue, protocolFeeRate, timePassed)
      const seniorAssumedValueAfterFee = seniorAssumedValue.sub(seniorAssumedValueFee)

      expect('updateCheckpointFromPortfolio').to.be.calledOnContractWith(seniorTranche, [
        seniorAssumedValueAfterFee,
        await senior.getCurrentDeficit(),
      ])
      expect(await seniorTranche.unpaidProtocolFee()).to.eq(seniorAssumedValueFee)
    })

    it('fees do not accrue on deficit', async () => {
      const { assetVault, parseTokenUnits, tranches, depositToTranche, disburse, updateState, repay, tranchesData } =
        await loadFixture(assetVaultFixture)
      const depositAmount = parseTokenUnits(100)
      for (const tranche of tranches) {
        await depositToTranche(tranche, depositAmount)
        await tranche.setManagerFeeRate(1000)
      }
      await assetVault.start()

      const principal = depositAmount.mul(3)
      const interest = parseTokenUnits(10)
      await disburse(principal, { interest })
      await updateState(0)

      const timePassed = 2 * YEAR
      await timeTravel(timePassed)
      await repay(principal, interest, { outstandingAssets: 0 })

      const totalAssetVaultValue = await assetVault.totalAssets()
      const expectedSeniorAmount = withInterest(depositAmount, tranchesData[2].targetApy, timePassed)
      const expectedJuniorAmount = withInterest(depositAmount, tranchesData[1].targetApy, timePassed)
      const expectedEquityAmount = totalAssetVaultValue.sub(expectedSeniorAmount).sub(expectedJuniorAmount)

      const delta = parseTokenUnits(0.001)
      const expectedAmounts = await assetVault.calculateWaterfall()
      expect(expectedAmounts[0]).to.be.closeTo(expectedEquityAmount, delta)
      expect(expectedAmounts[1]).to.be.closeTo(expectedJuniorAmount, delta)
      expect(expectedAmounts[2]).to.be.closeTo(expectedSeniorAmount, delta)
    })

    it('no interest on unpaid fees', async () => {
      const { assetVault, parseTokenUnits, tranches, depositToTranche, disburse, senior, junior } = await loadFixture(
        assetVaultFixture
      )
      const depositAmount = parseTokenUnits(100)
      const managerFeeRate = 1000
      for (const tranche of tranches) {
        await depositToTranche(tranche, depositAmount)
        await tranche.setManagerFeeRate(managerFeeRate)
      }
      const startTx = await assetVault.start()

      const principal = depositAmount.mul(3)
      const interest = parseTokenUnits(10)
      await disburse(principal, { interest })

      await timeTravelFrom(startTx, YEAR)
      await assetVault.updateCheckpoints()
      for (const tranche of tranches) {
        await tranche.setManagerFeeRate(0)
      }

      const seniorAfterYearBeforeFees = withInterest(depositAmount, senior.targetApy, YEAR)
      const seniorFee = getInterest(seniorAfterYearBeforeFees, managerFeeRate, YEAR)
      const seniorAfterYearAfterFees = seniorAfterYearBeforeFees.sub(seniorFee)

      const juniorAfterYearBeforeFees = withInterest(depositAmount, junior.targetApy, YEAR)
      const juniorFee = getInterest(juniorAfterYearBeforeFees, managerFeeRate, YEAR)
      const juniorAfterYearAfterFees = juniorAfterYearBeforeFees.sub(juniorFee)

      expect(await tranches[2].totalAssets()).to.be.closeTo(seniorAfterYearAfterFees, 100)
      expect(await tranches[1].totalAssets()).to.be.closeTo(juniorAfterYearAfterFees, 100)

      await timeTravelFrom(startTx, 2 * YEAR)
      await assetVault.updateCheckpoints()

      const seniorAfterTwoYears = withInterest(seniorAfterYearAfterFees, senior.targetApy, YEAR)
      const juniorAfterTwoYears = withInterest(juniorAfterYearAfterFees, junior.targetApy, YEAR)

      expect(await tranches[2].totalAssets()).to.be.closeTo(seniorAfterTwoYears, 100)
      expect(await tranches[1].totalAssets()).to.be.closeTo(juniorAfterTwoYears, 100)
    })

    it('interest on deficit is calculated correctly with fees enabled', async () => {
      const { assetVault, parseTokenUnits, tranches, depositToTranche, disburse, loseAssets, junior } =
        await loadFixture(assetVaultFixture)
      const depositAmount = parseTokenUnits(100)
      for (const tranche of tranches) {
        await depositToTranche(tranche, depositAmount)
        await tranche.setManagerFeeRate(500)
      }

      await assetVault.start()
      const disburseAmount = parseTokenUnits(150)
      await disburse(disburseAmount)
      await loseAssets(disburseAmount)

      expect(await junior.getCurrentDeficit()).to.eq(parseTokenUnits(50))

      await timeTravel(YEAR)
      await assetVault.updateCheckpoints()
      // 3% senior interest + 5% junior interest from assets and deficit
      expect(await junior.getCurrentDeficit()).to.eq(parseTokenUnits(58))
    })
  })
})
