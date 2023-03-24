import { assetVaultFixture, assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { timeTravel, timeTravelAndMine, timeTravelTo } from 'utils/timeTravel'
import { YEAR, MINUTE } from 'utils/constants'
import { expect } from 'chai'
import { sum } from 'utils/sum'
import { getTxTimestamp } from 'utils/timestamp'
import { percentOf } from 'utils/percentOf'
import { getInterest, withInterest } from 'utils/interest'

describe('StructuredAssetVault.calculateWaterfall', () => {
  const loadFixture = setupFixtureLoader()

  const DELTA = 1e5

  it('returns deposits in CapitalFromation', async () => {
    const { assetVault, depositToTranche, seniorTranche, juniorTranche, equityTranche, parseTokenUnits } =
      await loadFixture(assetVaultFixture)

    const seniorDeposit = parseTokenUnits(1000)
    const juniorDeposit = parseTokenUnits(1000)
    const equityDeposit = parseTokenUnits(1000)

    await depositToTranche(seniorTranche, seniorDeposit)
    await depositToTranche(juniorTranche, juniorDeposit)
    await depositToTranche(equityTranche, equityDeposit)

    const waterfall = await assetVault.calculateWaterfall()

    expect(waterfall[2]).to.eq(seniorDeposit)
    expect(waterfall[1]).to.eq(juniorDeposit)
    expect(waterfall[0]).to.eq(equityDeposit)
  })

  it('returns 0 for no deposit on tranche', async () => {
    const { assetVault, juniorTranche, equityTranche, depositToTranche, parseTokenUnits, tranchesData } =
      await loadFixture(assetVaultFixture)
    const amount = parseTokenUnits(1000)
    await depositToTranche(juniorTranche, amount)
    await depositToTranche(equityTranche, amount)
    const totalDeposit = amount.mul(2)

    await assetVault.start()
    await timeTravelAndMine(YEAR)

    const waterfall = await assetVault.calculateWaterfall()
    expect(waterfall[2]).to.eq(0)
    const juniorExpectedAmount = withInterest(amount, tranchesData[1].targetApy, YEAR)
    expect(waterfall[1]).to.be.closeTo(juniorExpectedAmount, DELTA)
    expect(waterfall[0]).to.be.closeTo(totalDeposit.sub(juniorExpectedAmount), DELTA)
  })

  it('returns deposits in Closed', async () => {
    const { assetVault, assetVaultStartTimestamp, junior, senior } = await loadFixture(assetVaultLiveFixture)

    await timeTravelTo(assetVaultStartTimestamp + YEAR)
    await assetVault.close()
    const waterfall = await assetVault.calculateWaterfall()

    const expectedSenior = withInterest(senior.initialDeposit, senior.targetApy, YEAR)
    const expectedJunior = withInterest(junior.initialDeposit, junior.targetApy, YEAR)

    const totalAssets = await assetVault.totalAssets()
    const expectedEquity = totalAssets.sub(expectedSenior).sub(expectedJunior)

    expect(waterfall[2]).to.eq(expectedSenior)
    expect(waterfall[1]).to.eq(expectedJunior)
    expect(waterfall[0]).to.eq(expectedEquity)
  })

  it("AssetVault didn't change value, no time has passed", async () => {
    const { assetVault, initialDeposits } = await loadFixture(assetVaultLiveFixture)

    const waterfall = await assetVault.calculateWaterfall()

    expect(waterfall[2]).to.be.closeTo(initialDeposits[2], DELTA)
    expect(waterfall[1]).to.be.closeTo(initialDeposits[1], DELTA)
    expect(waterfall[0]).to.be.closeTo(initialDeposits[0], DELTA)
  })

  it('each tranche gains target value, 1 year passed', async () => {
    const { assetVault, mintToAssetVault, parseTokenUnits, tranchesData, initialDeposits } = await loadFixture(
      assetVaultLiveFixture
    )

    const mintedTokens = parseTokenUnits(1e9)
    await mintToAssetVault(mintedTokens)

    const targetApys = tranchesData.map(({ targetApy }) => targetApy)

    const timePassed = YEAR
    await timeTravelAndMine(timePassed)
    const waterfall = await assetVault.calculateWaterfall()

    const expectedAssetVaultValue = sum(...initialDeposits, mintedTokens)
    const expectedEquityValue = expectedAssetVaultValue.sub(waterfall[2]).sub(waterfall[1])

    expect(waterfall[2]).to.be.closeTo(withInterest(initialDeposits[2], targetApys[2], timePassed), DELTA)
    expect(waterfall[1]).to.be.closeTo(withInterest(initialDeposits[1], targetApys[1], timePassed), DELTA)
    expect(waterfall[0]).to.be.closeTo(expectedEquityValue, DELTA)
  })

  it('each tranche gains target value, half a year passed', async () => {
    const { assetVault, mintToAssetVault, parseTokenUnits, tranchesData, initialDeposits } = await loadFixture(
      assetVaultLiveFixture
    )

    const mintedTokens = parseTokenUnits(1e9)
    await mintToAssetVault(mintedTokens)

    const targetApys = tranchesData.map(({ targetApy }) => targetApy)

    const timePassed = YEAR / 2
    await timeTravelAndMine(timePassed)
    const waterfall = await assetVault.calculateWaterfall()

    const expectedAssetVaultValue = sum(...initialDeposits, mintedTokens)
    const expectedEquityValue = expectedAssetVaultValue.sub(waterfall[2]).sub(waterfall[1])

    expect(waterfall[2]).to.be.closeTo(withInterest(initialDeposits[2], targetApys[2], timePassed), DELTA)
    expect(waterfall[1]).to.be.closeTo(withInterest(initialDeposits[1], targetApys[1], timePassed), DELTA)
    expect(waterfall[0]).to.be.closeTo(expectedEquityValue, DELTA)
  })

  it("AssetVault didn't change value", async () => {
    const { assetVault, totalDeposit, senior, junior } = await loadFixture(assetVaultLiveFixture)

    const timePassed = YEAR
    await timeTravelAndMine(timePassed)
    const waterfall = await assetVault.calculateWaterfall()

    const expectedAssetVaultValue = totalDeposit
    const expectedEquityValue = expectedAssetVaultValue.sub(waterfall[2]).sub(waterfall[1])

    expect(waterfall[2]).to.be.closeTo(withInterest(senior.initialDeposit, senior.targetApy, timePassed), DELTA)
    expect(waterfall[1]).to.be.closeTo(withInterest(junior.initialDeposit, junior.targetApy, timePassed), DELTA)
    expect(waterfall[0]).to.be.closeTo(expectedEquityValue, DELTA)
    expect(sum(...waterfall)).to.equal(expectedAssetVaultValue)
  })

  it('AssetVault lost value, equity lost everything, junior still has funds', async () => {
    const { assetVault, disburse, updateState, parseTokenUnits, senior, totalDeposit } = await loadFixture(
      assetVaultLiveFixture
    )
    const defaultedValue = parseTokenUnits(2e6)

    await disburse(defaultedValue)
    await timeTravel(YEAR)
    await updateState(0)

    const waterfall = await assetVault.calculateWaterfall()

    const expectedAssetVaultValue = totalDeposit.sub(defaultedValue)
    const expectedJuniorValue = expectedAssetVaultValue.sub(waterfall[2])
    const expectedEquityValue = 0

    expect(waterfall[2]).to.be.closeTo(withInterest(senior.initialDeposit, senior.targetApy, YEAR), DELTA)
    expect(waterfall[1]).to.be.closeTo(expectedJuniorValue, DELTA)
    expect(waterfall[0]).to.be.closeTo(expectedEquityValue, DELTA)
    expect(sum(...waterfall)).to.equal(expectedAssetVaultValue)
  })

  it('AssetVault lost value, equity and junior lost everything', async () => {
    const { assetVault, disburse, updateState, parseTokenUnits, senior, totalDeposit } = await loadFixture(
      assetVaultLiveFixture
    )
    const defaultedValue = parseTokenUnits(5e6)

    await disburse(defaultedValue)
    await timeTravel(YEAR)
    await updateState(0)

    const waterfallValues = await assetVault.calculateWaterfall()

    expect(waterfallValues[2]).to.be.closeTo(senior.initialDeposit, DELTA)
    expect(waterfallValues[1]).to.be.closeTo(0, DELTA)
    expect(waterfallValues[0]).to.be.closeTo(0, DELTA)
    expect(sum(...waterfallValues)).to.equal(totalDeposit.sub(defaultedValue))
  })

  it('AssetVault lost everything', async () => {
    const { assetVault, disburse, updateState, totalDeposit } = await loadFixture(assetVaultLiveFixture)

    await disburse(totalDeposit)
    await timeTravel(YEAR)
    await updateState(0)

    const waterfall = await assetVault.calculateWaterfall()

    expect(waterfall[2]).to.be.closeTo(0, DELTA)
    expect(waterfall[1]).to.be.closeTo(0, DELTA)
    expect(waterfall[0]).to.be.closeTo(0, DELTA)
  })

  it('waterfall values change after 1 minute', async () => {
    const { assetVault, parseTokenUnits, mintToAssetVault } = await loadFixture(assetVaultLiveFixture)

    const mintedTokens = parseTokenUnits(1e9)
    await mintToAssetVault(mintedTokens)

    const waterfallBefore = await assetVault.calculateWaterfall()
    await timeTravelAndMine(MINUTE)
    const waterfallAfter = await assetVault.calculateWaterfall()

    expect(waterfallBefore[2]).to.lt(waterfallAfter[2])
    expect(waterfallBefore[1]).to.lt(waterfallAfter[1])
    expect(waterfallBefore[0]).to.gt(waterfallAfter[0])
  })

  it('waterfall calculated after AssetVault end date', async () => {
    const { assetVault, assetVaultDuration, totalDeposit, senior, junior } = await loadFixture(assetVaultLiveFixture)

    await timeTravelAndMine(assetVaultDuration + YEAR)
    const waterfall = await assetVault.calculateWaterfall()

    const expectedSeniorValue = withInterest(senior.initialDeposit, senior.targetApy, assetVaultDuration)
    expect(waterfall[2]).to.be.closeTo(expectedSeniorValue, DELTA)

    const expectedJuniorValue = withInterest(junior.initialDeposit, junior.targetApy, assetVaultDuration)
    expect(waterfall[1]).to.be.closeTo(expectedJuniorValue, DELTA)

    const expectedEquityValue = totalDeposit.sub(waterfall[2]).sub(waterfall[1])
    expect(waterfall[0]).to.be.closeTo(expectedEquityValue, DELTA)

    expect(sum(...waterfall)).to.equal(totalDeposit)
  })

  it('each tranche gains target value, 1 year passed, 2 tranches', async () => {
    const {
      mintToAssetVault,
      parseTokenUnits,
      tranchesData,
      initialDeposits: defaultInitialDeposits,
      tranchesInitData,
      depositToTranche,
      createAssetVaultAndSetupControllers,
    } = await loadFixture(assetVaultLiveFixture)
    const initialDeposits = defaultInitialDeposits.slice(0, 2)
    const { assetVault, tranches } = await createAssetVaultAndSetupControllers({
      tranchesInitData: tranchesInitData.slice(0, 2),
    })

    await depositToTranche(tranches[0], initialDeposits[0])
    await depositToTranche(tranches[1], initialDeposits[1])

    await assetVault.start()

    const mintedTokens = parseTokenUnits(1e9)
    await mintToAssetVault(mintedTokens, assetVault)

    await timeTravelAndMine(YEAR)
    const waterfall = await assetVault.calculateWaterfall()

    const expectedAssetVaultValue = sum(...initialDeposits, mintedTokens)
    const expectedEquityValue = expectedAssetVaultValue.sub(waterfall[1])
    expect(waterfall[1]).to.be.closeTo(withInterest(initialDeposits[1], tranchesData[1].targetApy, YEAR), DELTA)
    expect(waterfall[0]).to.be.closeTo(expectedEquityValue, DELTA)
  })

  it('unitranche gains target value, 1 year passed', async () => {
    const {
      mintToAssetVault,
      parseTokenUnits,
      initialDeposits,
      tranchesInitData,
      depositToTranche,
      createAssetVaultAndSetupControllers,
    } = await loadFixture(assetVaultLiveFixture)
    const { assetVault, tranches } = await createAssetVaultAndSetupControllers({
      tranchesInitData: [tranchesInitData[0]],
    })

    await depositToTranche(tranches[0], initialDeposits[0])

    await assetVault.start()

    const mintedTokens = parseTokenUnits(1e9)
    await mintToAssetVault(mintedTokens, assetVault)
    await timeTravelAndMine(YEAR)
    const waterfall = await assetVault.calculateWaterfall()

    const expectedEquityValue = sum(initialDeposits[0], mintedTokens)
    expect(waterfall[0]).to.be.closeTo(expectedEquityValue, DELTA)
    expect(waterfall).to.have.lengthOf(1)
  })

  describe('with fees', () => {
    const DELTA = 1e6

    it("AssetVault didn't change value", async () => {
      const { assetVault, senior, junior, protocolConfig } = await loadFixture(assetVaultLiveFixture)
      const protocolFeeRate = 50
      await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)
      await assetVault.updateCheckpoints()

      const timePassed = YEAR
      await timeTravelAndMine(timePassed)

      const seniorValue = withInterest(senior.initialDeposit, senior.targetApy, timePassed)
      const juniorValue = withInterest(junior.initialDeposit, junior.targetApy, timePassed)

      const seniorValueAfterFees = seniorValue.sub(percentOf(seniorValue, protocolFeeRate))
      const juniorValueAfterFees = juniorValue.sub(percentOf(juniorValue, protocolFeeRate))
      const assetVaultValue = await assetVault.totalAssets()
      const equityValueAfterFees = assetVaultValue.sub(seniorValueAfterFees).sub(juniorValueAfterFees)

      const waterfall = await assetVault.calculateWaterfall()
      expect(waterfall[2]).to.be.closeTo(seniorValueAfterFees, DELTA)
      expect(waterfall[1]).to.be.closeTo(juniorValueAfterFees, DELTA)
      expect(waterfall[0]).to.be.closeTo(equityValueAfterFees, DELTA)
    })

    it('AssetVault lost value, equity lost everything, junior still has funds', async () => {
      const { assetVault, disburse, updateState, parseTokenUnits, senior, protocolConfig, totalDeposit } =
        await loadFixture(assetVaultLiveFixture)
      const protocolFeeRate = 50
      await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)
      await assetVault.updateCheckpoints()

      const defaultedValue = parseTokenUnits(2e6)
      await disburse(defaultedValue)
      await timeTravel(YEAR)
      await updateState(0)

      const assetVaultValue = totalDeposit.sub(defaultedValue)
      const seniorValue = withInterest(senior.initialDeposit, senior.targetApy, YEAR)
      const seniorValueAfterFees = seniorValue.sub(percentOf(seniorValue, protocolFeeRate))

      const totalAssets = await assetVault.totalAssets()
      const juniorValueAfterFees = totalAssets.sub(seniorValueAfterFees)

      const waterfall = await assetVault.calculateWaterfall()
      expect(waterfall[2]).to.be.closeTo(seniorValueAfterFees, DELTA)
      expect(waterfall[1]).to.be.closeTo(juniorValueAfterFees, DELTA)
      expect(waterfall[0]).to.eq(0)

      const totalFee = withInterest(totalDeposit, protocolFeeRate, YEAR).sub(totalDeposit)
      expect(sum(...waterfall)).to.be.closeTo(assetVaultValue.sub(totalFee), DELTA)
    })

    it('AssetVault lost value, equity and junior lost everything', async () => {
      const { assetVault, disburse, updateState, parseTokenUnits, protocolConfig, totalDeposit, initialDeposits } =
        await loadFixture(assetVaultLiveFixture)
      const protocolFeeRate = 50
      await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)
      await assetVault.updateCheckpoints()

      const defaultedValue = parseTokenUnits(5e6)
      await disburse(defaultedValue)
      await timeTravel(YEAR)
      await updateState(0)

      const seniorValue = totalDeposit.sub(defaultedValue)
      const tranchesFees = initialDeposits.map((deposit) => getInterest(deposit, protocolFeeRate, YEAR))
      const totalFee = sum(...tranchesFees)
      const seniorValueAfterFees = seniorValue.sub(totalFee)

      const waterfall = await assetVault.calculateWaterfall()

      expect(waterfall[2]).to.be.closeTo(seniorValueAfterFees, DELTA)
      expect(waterfall[1]).to.eq(0)
      expect(waterfall[0]).to.eq(0)
    })

    it('AssetVault lost everything', async () => {
      const {
        assetVault,
        disburse,
        updateState,
        protocolConfig,
        assetVaultStartTimestamp,
        initialDeposits,
        totalDeposit,
      } = await loadFixture(assetVaultLiveFixture)
      const protocolFeeRate = 50
      await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)
      const updateTx = await assetVault.updateCheckpoints()

      const timePassed = (await getTxTimestamp(updateTx)) - assetVaultStartTimestamp
      const tranchesFees = initialDeposits.map((deposit) => getInterest(deposit, protocolFeeRate, timePassed))
      const totalFee = sum(...tranchesFees)

      const defaultedValue = totalDeposit.sub(totalFee)
      await disburse(defaultedValue)
      await timeTravel(YEAR)
      await updateState(0)

      const waterfall = await assetVault.calculateWaterfall()
      expect(waterfall[2]).to.eq(0)
      expect(waterfall[1]).to.eq(0)
      expect(waterfall[0]).to.eq(0)
    })

    it('with unpaid fees when tranche is called', async () => {
      const { assetVault, disburse, protocolConfig, depositToTranche, juniorTranche, parseTokenUnits } =
        await loadFixture(assetVaultLiveFixture)
      const protocolFeeRate = 50
      await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)
      await assetVault.updateCheckpoints()

      const maxDisbursement = (await assetVault.liquidAssets()).sub(parseTokenUnits(1))
      await disburse(maxDisbursement)
      await timeTravelAndMine(YEAR)

      const waterfallBeforeDeposits = await assetVault.calculateWaterfall()

      for (let i = 0; i < 5; i++) {
        await depositToTranche(juniorTranche, 10)
      }

      const waterfallAfterDeposits = await assetVault.calculateWaterfall()
      const delta = parseTokenUnits(1)
      expect(waterfallAfterDeposits[0]).to.be.closeTo(waterfallBeforeDeposits[0], delta)
      expect(waterfallAfterDeposits[1]).to.be.closeTo(waterfallBeforeDeposits[1], delta)
      expect(waterfallAfterDeposits[2]).to.be.closeTo(waterfallBeforeDeposits[2], delta)
    })

    it('with unpaid fees when updateCheckpoints is called', async () => {
      const { assetVault, disburse, protocolConfig, parseTokenUnits } = await loadFixture(assetVaultLiveFixture)
      const protocolFeeRate = 50
      await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)
      await assetVault.updateCheckpoints()

      const maxDisbursement = (await assetVault.totalAssets()).sub(parseTokenUnits(100))
      await disburse(maxDisbursement)
      await timeTravelAndMine(YEAR)

      const waterfallBeforeCheckpoints = await assetVault.calculateWaterfall()

      for (let i = 0; i < 5; i++) {
        await assetVault.updateCheckpoints()
      }

      const waterfallAfterCheckpoints = await assetVault.calculateWaterfall()
      const delta = parseTokenUnits(1)
      expect(waterfallAfterCheckpoints[0]).to.be.closeTo(waterfallBeforeCheckpoints[0], delta)
      expect(waterfallAfterCheckpoints[1]).to.be.closeTo(waterfallBeforeCheckpoints[1], delta)
      expect(waterfallAfterCheckpoints[2]).to.be.closeTo(waterfallBeforeCheckpoints[2], delta)
    })
  })
})
