import { expect } from 'chai'
import { assetVaultFixture, assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { YEAR } from 'utils/constants'
import { timePassedBetween } from 'utils/timestamp'
import { getInterest, withInterest } from 'utils/interest'
import { sum } from 'utils/sum'
import { timeTravel, timeTravelFrom } from 'utils/timeTravel'

describe('StructuredAssetVault.repay', () => {
  const loadFixture = setupFixtureLoader()

  const outstandingPrincipal = 54321
  const principal = 1234
  const interest = 5678

  async function fixture() {
    const fixtureResult = await loadFixture(assetVaultLiveFixture)
    const { disburse } = fixtureResult

    await disburse(outstandingPrincipal)

    return fixtureResult
  }

  it('only repayer', async () => {
    const { repay, other } = await fixture()
    await expect(repay(principal, interest, { sender: other })).to.be.revertedWith('SAV: Only repayer')
  })

  it('is pausable', async () => {
    const {
      assetVault,
      protocolConfigParams: { pauser },
      repay,
    } = await fixture()
    await assetVault.connect(pauser).pause()
    await expect(repay(principal, interest)).to.be.revertedWith('Pausable: paused')
  })

  it('forbidden in CapitalFormation', async () => {
    const { repay } = await loadFixture(assetVaultFixture)
    await expect(repay(principal, interest, { outstandingAssets: 0 })).to.be.revertedWith(
      'SAV: Can repay only after start'
    )
  })

  it('decreases outstanding principal', async () => {
    const { assetVault, repay } = await fixture()
    await repay(principal, interest)
    expect(await assetVault.outstandingPrincipal()).to.eq(outstandingPrincipal - principal)
  })

  it('increases paid interest', async () => {
    const { assetVault, repay } = await fixture()

    await repay(principal, interest)
    expect(await assetVault.paidInterest()).to.eq(interest)

    await repay(principal, interest)
    expect(await assetVault.paidInterest()).to.eq(2 * interest)
  })

  it('updates outstanding assets', async () => {
    const { assetVault, repay } = await fixture()
    const outstandingAssets = 1234
    await repay(principal, interest, { outstandingAssets })
    expect(await assetVault.outstandingAssets()).to.eq(outstandingAssets)
  })

  it('updates asset report id if report is new', async () => {
    const { assetVault, repay } = await fixture()
    const newAssetReportId = 'totallyPossibleAssetReportId'
    const assetReportHistoryLength = (await assetVault.getAssetReportHistory()).length
    await repay(principal, interest, { newAssetReportId })
    expect((await assetVault.getAssetReportHistory()).length).to.eq(assetReportHistoryLength + 1)
    expect(await assetVault.latestAssetReportId()).to.eq(newAssetReportId)
  })

  it('does not update asset report id if report is old', async () => {
    const { assetVault, repay, assetReportId } = await fixture()
    const assetReportHistoryLength = (await assetVault.getAssetReportHistory()).length
    await repay(principal, interest, { newAssetReportId: assetReportId })
    expect((await assetVault.getAssetReportHistory()).length).to.eq(assetReportHistoryLength)
    expect(await assetVault.latestAssetReportId()).to.eq(assetReportId)
  })

  it('emits Repay event', async () => {
    const { assetVault, repay, wallet, assetReportId } = await fixture()
    const outstandingAssets = 1234
    const actionId = 1
    await expect(repay(principal, interest, { outstandingAssets }))
      .to.emit(assetVault, 'Repay')
      .withArgs(actionId, wallet.address, principal, interest, outstandingAssets, assetReportId)
  })

  it('increases action id', async () => {
    const { assetVault, repay } = await fixture()
    await expect(repay(principal, interest)).to.emit(assetVault, 'Repay').withNamedArgs({ actionId: 1 })
    await expect(repay(principal, interest)).to.emit(assetVault, 'Repay').withNamedArgs({ actionId: 2 })
  })

  it('repaid principal cannot be greater than outstanding principal', async () => {
    const { repay } = await fixture()
    await expect(repay(outstandingPrincipal + 1, interest, { outstandingAssets: 0 })).to.be.revertedWith(
      'SAV: Principal overpayment'
    )
  })

  describe('Live status', () => {
    it('increases virtual token balance', async () => {
      const { assetVault, repay, disburse } = await fixture()
      await disburse(principal)

      const balanceBeforeRepay = await assetVault.virtualTokenBalance()
      await repay(principal, interest)
      expect(await assetVault.virtualTokenBalance()).to.eq(balanceBeforeRepay.add(principal).add(interest))
    })

    it('accumulates paid interest when interest is disbursed again', async () => {
      const { disburse, repay, assetVault, totalDeposit, token, wallet } = await loadFixture(assetVaultLiveFixture)
      await token.mint(wallet.address, totalDeposit)

      await disburse(principal, { interest })
      await repay(principal, interest)

      const newPrincipal = totalDeposit.add(interest)
      await disburse(newPrincipal, { interest })
      await repay(newPrincipal, interest)

      expect(await assetVault.paidInterest()).to.eq(2 * interest)
    })

    it('transfers assets to AssetVault', async () => {
      const { assetVault, repay, token, wallet } = await fixture()
      const amount = principal + interest
      expect(repay(principal, interest)).to.changeTokenBalances(
        token,
        [assetVault.address, wallet.address],
        [amount, -amount]
      )
    })

    it('repay lost assets', async () => {
      const { assetVault, disburse, updateState, repay, token, wallet } = await fixture()
      const amount = principal + interest

      await disburse(principal)
      await updateState(0)
      expect(repay(principal, interest, { outstandingAssets: 0 })).to.changeTokenBalances(
        token,
        [assetVault.address, wallet.address],
        [amount, -amount]
      )
    })

    it('pays fees', async () => {
      const {
        disburse,
        repay,
        parseTokenUnits,
        token,
        protocolConfig,
        senior,
        junior,
        protocolConfigParams: { protocolTreasury },
        totalDeposit,
      } = await fixture()
      const protocolFeeRate = 100
      await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

      const disbursement = parseTokenUnits(1e6)
      const disburseTx = await disburse(disbursement)

      await timeTravelFrom(disburseTx, YEAR)
      const repayTx = await repay(disbursement, 0)

      const timePassed = await timePassedBetween(disburseTx, repayTx)

      const expectedSenior = withInterest(senior.initialDeposit, senior.targetApy, timePassed)
      const expectedJunior = withInterest(junior.initialDeposit, junior.targetApy, timePassed)
      const expectedEquity = totalDeposit.sub(expectedSenior).sub(expectedJunior)

      const expectedTotal = expectedSenior.add(expectedJunior).add(expectedEquity)
      const totalFee = getInterest(expectedTotal, protocolFeeRate, timePassed)

      expect(await token.balanceOf(protocolTreasury)).to.be.closeTo(totalFee, 1)
    })
  })

  describe('Closed status', () => {
    const DELTA = 1e5

    it('does not increase virtual token balance', async () => {
      const { assetVault, repay, disburse, assetVaultDuration } = await fixture()
      await disburse(principal)

      await timeTravel(assetVaultDuration)
      await assetVault.close()

      const balanceBeforeRepay = await assetVault.virtualTokenBalance()
      await repay(principal, interest)
      expect(await assetVault.virtualTokenBalance()).to.eq(balanceBeforeRepay)
    })

    it('updates distributed assets', async () => {
      const { assetVault, tranches, disburse, repay, parseTokenUnits, assetVaultDuration } = await loadFixture(
        assetVaultLiveFixture
      )
      const principal = parseTokenUnits(1e6)
      const interest = parseTokenUnits(1e5)

      await disburse(principal, { interest })
      await timeTravel(assetVaultDuration)
      await assetVault.close()

      await repay(principal, interest)

      for (let i = 0; i < tranches.length; i++) {
        const { distributedAssets } = await assetVault.tranchesData(i)
        expect(distributedAssets).to.eq(await tranches[i].totalAssets())
      }
    })

    it('sends all to equity when junior and senior are covered', async () => {
      const { assetVault, equityTranche, disburse, repay, parseTokenUnits, assetVaultDuration } = await loadFixture(
        assetVaultLiveFixture
      )
      const principal = parseTokenUnits(1e6)
      const interest = parseTokenUnits(1e5)

      await disburse(principal, { interest })
      await timeTravel(assetVaultDuration)
      await assetVault.close()

      const equityTotalAssetsBefore = await equityTranche.totalAssets()
      await repay(principal, interest)

      expect(await equityTranche.totalAssets()).to.be.closeTo(
        equityTotalAssetsBefore.add(principal).add(interest),
        DELTA
      )
    })

    describe('junior lost funds, senior is covered', () => {
      it('not repaid enough to cover junior -> sends all to junior', async () => {
        const {
          assetVault,
          disburse,
          equityTranche,
          juniorTranche,
          seniorTranche,
          initialDeposits,
          updateState,
          repay,
        } = await loadFixture(assetVaultLiveFixture)
        const [equityDeposit, juniorDeposit] = initialDeposits
        const juniorDepositQuarter = juniorDeposit.div(4)

        const amountToRepay = juniorDepositQuarter
        const amountToLose = equityDeposit.add(juniorDepositQuarter)
        await disburse(amountToRepay.add(amountToLose))

        await updateState(0)
        await assetVault.close()

        const seniorTotalAssetsBefore = await seniorTranche.totalAssets()
        const juniorTotalAssetsBefore = await juniorTranche.totalAssets()

        await repay(amountToRepay, 0, { outstandingAssets: 0 })

        expect(await seniorTranche.totalAssets()).to.eq(seniorTotalAssetsBefore)
        expect(await juniorTranche.totalAssets()).to.be.closeTo(juniorTotalAssetsBefore.add(amountToRepay), DELTA)
        expect(await equityTranche.totalAssets()).to.eq(0)
      })

      it('repaid enough to cover junior -> sends to junior & equity', async () => {
        const { assetVault, equityTranche, juniorTranche, disburse, repay, equity, parseTokenUnits, updateState } =
          await loadFixture(assetVaultLiveFixture)
        const principal = equity.initialDeposit
        const interest = parseTokenUnits(1e5)

        await disburse(principal, { interest })
        await timeTravel(YEAR)
        await updateState(0)
        await assetVault.close()

        const equityTotalAssetsBefore = await equityTranche.totalAssets()
        const juniorTotalAssetsBefore = await juniorTranche.totalAssets()

        const juniorTrancheTargetValue = (await assetVault.tranchesData(1)).maxValueOnClose
        expect(juniorTotalAssetsBefore.lt(juniorTrancheTargetValue)).to.be.true

        const repayAmount = principal.add(interest)
        await repay(principal, interest, { outstandingAssets: 0 })

        const juniorShare = juniorTrancheTargetValue.sub(juniorTotalAssetsBefore)
        const equityShare = repayAmount.sub(juniorShare)

        expect(await juniorTranche.totalAssets()).to.eq(juniorTrancheTargetValue)
        expect(await equityTranche.totalAssets()).to.be.closeTo(equityTotalAssetsBefore.add(equityShare), DELTA)
      })
    })

    describe('senior lost funds', () => {
      it('not repaid enough to cover senior -> sends all to senior', async () => {
        const {
          assetVault,
          disburse,
          loseAssets,
          equityTranche,
          juniorTranche,
          seniorTranche,
          repay,
          initialDeposits,
        } = await loadFixture(assetVaultLiveFixture)
        const [equityDeposit, juniorDeposit, seniorDeposit] = initialDeposits
        const disburseAmount = equityDeposit.add(juniorDeposit).add(seniorDeposit.div(2))
        const amountToRepay = seniorDeposit.div(4)

        await disburse(disburseAmount)
        await loseAssets(disburseAmount)
        await assetVault.close()

        const seniorTotalAssetsBefore = await seniorTranche.totalAssets()

        await repay(amountToRepay, 0, { outstandingAssets: 0 })

        expect(await seniorTranche.totalAssets()).to.eq(seniorTotalAssetsBefore.add(amountToRepay))
        expect(await juniorTranche.totalAssets()).to.eq(0)
        expect(await equityTranche.totalAssets()).to.eq(0)
      })

      it('not repaid enough to cover junior -> sends to senior & junior', async () => {
        const {
          assetVault,
          disburse,
          equityTranche,
          juniorTranche,
          seniorTranche,
          initialDeposits,
          updateState,
          repay,
        } = await loadFixture(assetVaultLiveFixture)
        const [equityDeposit, juniorDeposit] = initialDeposits

        const amountToRepay = juniorDeposit.div(2)
        const amountToLose = equityDeposit.add(juniorDeposit.div(2))
        await disburse(amountToRepay.add(amountToLose))

        await updateState(0)
        await assetVault.close()

        const juniorTotalAssetsBefore = await juniorTranche.totalAssets()
        const seniorTotalAssetsBefore = await seniorTranche.totalAssets()

        const seniorTrancheTargetValue = (await assetVault.tranchesData(2)).maxValueOnClose
        expect(seniorTotalAssetsBefore.lt(seniorTrancheTargetValue)).to.be.true

        await repay(amountToRepay, 0, { outstandingAssets: 0 })

        const seniorShare = seniorTrancheTargetValue.sub(seniorTotalAssetsBefore)
        const juniorShare = amountToRepay.sub(seniorShare)

        expect(await seniorTranche.totalAssets()).to.eq(seniorTrancheTargetValue)
        expect(await juniorTranche.totalAssets()).to.eq(juniorTotalAssetsBefore.add(juniorShare))
        expect(await equityTranche.totalAssets()).to.eq(0)
      })

      it('repaid enough to cover senior & junior -> sends to all tranches', async () => {
        const { assetVault, disburse, equityTranche, juniorTranche, seniorTranche, repay, totalDeposit, updateState } =
          await loadFixture(assetVaultLiveFixture)

        await disburse(totalDeposit)
        await updateState(0)
        await assetVault.close()

        expect(await seniorTranche.totalAssets()).to.eq(0)
        expect(await juniorTranche.totalAssets()).to.eq(0)
        expect(await equityTranche.totalAssets()).to.eq(0)

        await repay(totalDeposit, 0, { outstandingAssets: 0 })

        const seniorTrancheTargetValue = (await assetVault.tranchesData(2)).maxValueOnClose
        const juniorTrancheTargetValue = (await assetVault.tranchesData(1)).maxValueOnClose

        const equityShare = totalDeposit.sub(seniorTrancheTargetValue).sub(juniorTrancheTargetValue)

        expect(await seniorTranche.totalAssets()).to.eq(seniorTrancheTargetValue)
        expect(await juniorTranche.totalAssets()).to.eq(juniorTrancheTargetValue)
        expect(await equityTranche.totalAssets()).to.eq(equityShare)
      })
    })

    it('assets lost right after AssetVault start', async () => {
      const {
        disburse,
        loseAssets,
        repay,
        parseTokenUnits,
        assetVault,
        assetVaultDuration,
        senior,
        junior,
        totalDeposit,
        seniorTranche,
        juniorTranche,
        equityTranche,
        assetVaultStartTx,
      } = await loadFixture(assetVaultLiveFixture)
      const disburseAmount = parseTokenUnits(6e6)
      const interest = parseTokenUnits(1e6)
      await disburse(disburseAmount)
      await loseAssets(disburseAmount)

      await timeTravelFrom(assetVaultStartTx, assetVaultDuration)
      await assetVault.close()

      await repay(disburseAmount, interest, { outstandingAssets: 0 })

      const expectedSeniorValue = withInterest(senior.initialDeposit, senior.targetApy, assetVaultDuration)
      const expectedJuniorValue = withInterest(junior.initialDeposit, junior.targetApy, assetVaultDuration)
      const expectedEquityValue = totalDeposit.add(interest).sub(expectedSeniorValue).sub(expectedJuniorValue)

      expect(await seniorTranche.totalAssets()).to.be.closeTo(expectedSeniorValue, DELTA)
      expect(await juniorTranche.totalAssets()).to.be.closeTo(expectedJuniorValue, DELTA)
      expect(await equityTranche.totalAssets()).to.be.closeTo(expectedEquityValue, DELTA)
    })

    it('assets lost in the middle of AssetVault duration', async () => {
      const {
        parseTokenUnits,
        disburse,
        assetVault,
        senior,
        junior,
        totalDeposit,
        seniorTranche,
        juniorTranche,
        equityTranche,
        updateState,
        repay,
      } = await loadFixture(assetVaultLiveFixture)
      const principal = parseTokenUnits(6e6)
      const interest = parseTokenUnits(1e6)
      await disburse(principal, { interest })

      await timeTravel(YEAR)
      await updateState(0)

      await timeTravel(YEAR)
      await assetVault.close()

      await repay(principal, interest, { outstandingAssets: 0 })

      const expectedSeniorValueAfterYear = withInterest(senior.initialDeposit, senior.targetApy, YEAR)
      const expectedJuniorValueAfterYear = withInterest(junior.initialDeposit, junior.targetApy, YEAR)
      const expectedSeniorValue = withInterest(expectedSeniorValueAfterYear, senior.targetApy, YEAR)
      const expectedJuniorValue = withInterest(expectedJuniorValueAfterYear, junior.targetApy, YEAR)
      const expectedEquityValue = totalDeposit.add(interest).sub(expectedSeniorValue).sub(expectedJuniorValue)

      expect(await seniorTranche.totalAssets()).to.be.closeTo(expectedSeniorValue, DELTA)
      expect(await juniorTranche.totalAssets()).to.be.closeTo(expectedJuniorValue, DELTA)
      expect(await equityTranche.totalAssets()).to.be.closeTo(expectedEquityValue, DELTA)
    })

    it('assets lost after AssetVault was closed', async () => {
      const {
        disburse,
        loseAssets,
        repay,
        parseTokenUnits,
        assetVault,
        senior,
        junior,
        totalDeposit,
        seniorTranche,
        juniorTranche,
        equityTranche,
        assetVaultDuration,
      } = await loadFixture(assetVaultLiveFixture)
      const disburseAmount = parseTokenUnits(6e6)
      const interest = parseTokenUnits(1e6)
      await disburse(disburseAmount, { interest })

      await timeTravel(assetVaultDuration)

      await assetVault.close()
      await loseAssets(disburseAmount)
      await repay(disburseAmount, interest, { outstandingAssets: 0 })

      const expectedSeniorValue = withInterest(senior.initialDeposit, senior.targetApy, assetVaultDuration)
      const expectedJuniorValue = withInterest(junior.initialDeposit, junior.targetApy, assetVaultDuration)
      const expectedEquityValue = totalDeposit.add(interest).sub(expectedSeniorValue).sub(expectedJuniorValue)

      expect(await seniorTranche.totalAssets()).to.be.closeTo(expectedSeniorValue, DELTA)
      expect(await juniorTranche.totalAssets()).to.be.closeTo(expectedJuniorValue, DELTA)
      expect(await equityTranche.totalAssets()).to.be.closeTo(expectedEquityValue, DELTA)
    })

    it('multiple repayments', async () => {
      const {
        assetVault,
        disburse,
        loseAssets,
        repay,
        equityTranche,
        juniorTranche,
        seniorTranche,
        senior,
        junior,
        parseTokenUnits,
        assetVaultDuration,
        token,
        totalDeposit,
        assetVaultStartTx,
      } = await loadFixture(assetVaultLiveFixture)
      const interest = parseTokenUnits(3e5)
      const disburseAmounts = [1e6, 2e6, 3e6].map(parseTokenUnits)
      const totalDisbursed = sum(...disburseAmounts)

      await disburse(totalDisbursed)
      await loseAssets(totalDisbursed)

      await timeTravelFrom(assetVaultStartTx, assetVaultDuration)
      await assetVault.close()

      for (const amount of disburseAmounts) {
        await repay(amount, interest, { outstandingAssets: 0 })
      }

      const expectedSeniorValue = withInterest(senior.initialDeposit, senior.targetApy, assetVaultDuration)
      const expectedJuniorValue = withInterest(junior.initialDeposit, junior.targetApy, assetVaultDuration)
      const expectedEquityValue = totalDeposit.add(interest.mul(3)).sub(expectedSeniorValue).sub(expectedJuniorValue)

      const delta = parseTokenUnits(100)
      expect(await token.balanceOf(seniorTranche.address)).to.be.closeTo(expectedSeniorValue, delta)
      expect(await token.balanceOf(juniorTranche.address)).to.be.closeTo(expectedJuniorValue, delta)
      expect(await token.balanceOf(equityTranche.address)).to.be.closeTo(expectedEquityValue, delta)
    })

    it('redeem amount is correct after repaying lost assets', async () => {
      const {
        assetVault,
        disburse,
        parseTokenUnits,
        other,
        wallet,
        depositToTranche,
        redeemFromTranche,
        equityTranche,
        token,
        equity,
        updateState,
        repay,
      } = await loadFixture(assetVaultLiveFixture)
      const depositAmount = parseTokenUnits(1e6)
      await depositToTranche(equityTranche, depositAmount, other.address)
      const expectedTotalShares = equity.initialDeposit.add(depositAmount)

      const principal = parseTokenUnits(1e6)
      const interest = parseTokenUnits(1e5)
      await disburse(principal, { interest })
      await updateState(0)

      await timeTravel(YEAR)
      await assetVault.close()

      const expectedEquityValue = parseTokenUnits(1_700_000)

      const walletBalanceBefore = await token.balanceOf(wallet.address)
      const redeemAmount = expectedTotalShares.div(3)
      await redeemFromTranche(equityTranche, redeemAmount)

      const expectedWithdrawAmount = expectedEquityValue.div(3)
      const expectedEquityValueAfterRedeem = expectedEquityValue.sub(expectedWithdrawAmount)
      const expectedTotalSharesAfterRedeem = expectedTotalShares.sub(redeemAmount)

      const delta = parseTokenUnits(500)
      expect(await token.balanceOf(wallet.address)).to.be.closeTo(
        walletBalanceBefore.add(expectedWithdrawAmount),
        delta
      )

      await repay(principal, interest, { outstandingAssets: 0 })

      const expectedEquityValueAfterRepay = expectedEquityValueAfterRedeem.add(principal).add(interest)

      const otherBalanceBefore = await token.balanceOf(other.address)
      await equityTranche.connect(other).redeem(expectedTotalSharesAfterRedeem.div(2), other.address, other.address)
      expect(await token.balanceOf(other.address)).to.be.closeTo(
        otherBalanceBefore.add(expectedEquityValueAfterRepay.div(2)),
        delta
      )
    })
  })
})
