import { expect } from 'chai'
import { assetVaultFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { DAY, MONTH, YEAR } from 'utils/constants'
import { timePassedBetween } from 'utils/timestamp'
import { timeTravel } from 'utils/timeTravel'
import { percentOf } from 'utils/percentOf'
import { sum } from 'utils/sum'
import { getInterest, withInterest } from 'utils/interest'

describe('StructuredAssetVault: protocol fees', () => {
  const loadFixture = setupFixtureLoader()

  it('uses protocol fee rate from checkpoint', async () => {
    const {
      protocolConfig,
      seniorTranche,
      depositToTranche,
      parseTokenUnits,
      token,
      protocolConfigParams,
      startAssetVaultAndEnableLiveActions,
    } = await loadFixture(assetVaultFixture)
    const { protocolTreasury } = protocolConfigParams
    const initialProtocolFeeRate = 500
    await protocolConfig.setDefaultProtocolFeeRate(initialProtocolFeeRate)

    await startAssetVaultAndEnableLiveActions()
    const amount = parseTokenUnits(1000)
    await depositToTranche(seniorTranche, amount)

    await timeTravel(YEAR)

    await protocolConfig.setDefaultProtocolFeeRate(10_000)
    await depositToTranche(seniorTranche, 1)

    const delta = parseTokenUnits(0.00001)
    expect(await token.balanceOf(protocolTreasury)).to.be.closeTo(percentOf(amount, initialProtocolFeeRate), delta)
  })

  it('updates unpaid protocol fees if insufficient liquidity', async () => {
    const {
      assetVault,
      protocolConfig,
      seniorTranche,
      juniorTranche,
      equityTranche,
      depositToTranche,
      parseTokenUnits,
      startAssetVaultAndEnableLiveActions,
      disburse,
      senior,
      junior,
    } = await loadFixture(assetVaultFixture)
    const protocolFeeRate = 500
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

    await startAssetVaultAndEnableLiveActions()

    const equityDeposit = parseTokenUnits(4000)
    const juniorDeposit = parseTokenUnits(2000)
    const seniorDeposit = parseTokenUnits(1000)
    const totalDeposited = sum(equityDeposit, juniorDeposit, seniorDeposit)

    await depositToTranche(equityTranche, equityDeposit)
    await depositToTranche(juniorTranche, juniorDeposit)
    await depositToTranche(seniorTranche, seniorDeposit)
    await disburse(totalDeposited.sub(parseTokenUnits(1)))
    await timeTravel(YEAR)

    await assetVault.updateCheckpoints()

    const juniorValue = withInterest(juniorDeposit, junior.targetApy, YEAR)
    const expectedJuniorFee = percentOf(juniorValue, protocolFeeRate)

    const seniorValue = withInterest(seniorDeposit, senior.targetApy, YEAR)
    const expectedSeniorFee = percentOf(seniorValue, protocolFeeRate)

    const assetVaultFees = await assetVault.totalPendingFees()
    const expectedEquityFee = assetVaultFees.sub(expectedSeniorFee).sub(expectedJuniorFee)

    const delta = parseTokenUnits(0.0001)
    expect(await equityTranche.unpaidProtocolFee()).to.be.closeTo(expectedEquityFee, parseTokenUnits(1))
    expect(await juniorTranche.unpaidProtocolFee()).to.be.closeTo(expectedJuniorFee, delta)
    expect(await seniorTranche.unpaidProtocolFee()).to.be.closeTo(expectedSeniorFee, delta)
  })

  it('transfers protocol fee to protocol if sufficient liquidity', async () => {
    const {
      assetVault,
      protocolConfig,
      seniorTranche,
      depositToTranche,
      parseTokenUnits,
      protocolConfigParams,
      token,
      startAssetVaultAndEnableLiveActions,
    } = await loadFixture(assetVaultFixture)
    const { protocolTreasury } = protocolConfigParams
    const protocolFeeRate = 500
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

    await startAssetVaultAndEnableLiveActions()
    await depositToTranche(seniorTranche, parseTokenUnits(1000))
    await timeTravel(YEAR)

    const assetVaultBalanceBefore = await token.balanceOf(assetVault.address)
    const protocolBalanceBefore = await token.balanceOf(protocolTreasury)

    await depositToTranche(seniorTranche, 1)

    const delta = parseTokenUnits(0.0001)
    const expectedFeeAmount = parseTokenUnits(50)
    expect(await token.balanceOf(assetVault.address)).to.be.closeTo(
      assetVaultBalanceBefore.sub(expectedFeeAmount),
      delta
    )
    expect(await token.balanceOf(protocolTreasury)).to.be.closeTo(protocolBalanceBefore.add(expectedFeeAmount), delta)
  })

  it('emits ProtocolFeePaid event', async () => {
    const {
      protocolConfig,
      protocolConfigParams,
      seniorTranche,
      depositToTranche,
      parseTokenUnits,
      startAssetVaultAndEnableLiveActions,
    } = await loadFixture(assetVaultFixture)
    const protocolFeeRate = 500
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

    await startAssetVaultAndEnableLiveActions()
    const amount = parseTokenUnits(1000000)
    const firstDepositTx = await depositToTranche(seniorTranche, amount)
    await timeTravel(YEAR)

    const lastDepositTx = await depositToTranche(seniorTranche, 1)

    const timePassed = await timePassedBetween(firstDepositTx, lastDepositTx)
    const expectedFee = percentOf(amount.mul(timePassed), protocolFeeRate).div(YEAR)
    await expect(lastDepositTx)
      .to.emit(seniorTranche, 'ProtocolFeePaid')
      .withArgs(protocolConfigParams.protocolTreasury, expectedFee)
  })

  it('almost no fee is applied for withdrawal right after deposit', async () => {
    const {
      protocolConfig,
      seniorTranche,
      depositToTranche,
      redeemFromTranche,
      parseTokenUnits,
      wallet,
      token,
      startAssetVaultAndEnableLiveActions,
    } = await loadFixture(assetVaultFixture)
    const protocolFeeRate = 500
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

    await startAssetVaultAndEnableLiveActions()
    const amount = parseTokenUnits(1e6)

    await depositToTranche(seniorTranche, amount)
    const balanceBefore = await token.balanceOf(wallet.address)
    await redeemFromTranche(seniorTranche, await seniorTranche.balanceOf(wallet.address))

    const delta = parseTokenUnits(0.01)
    expect(await token.balanceOf(wallet.address)).to.be.closeTo(balanceBefore.add(amount), delta)
  })

  it('fees do not have impact on given withdraw amount', async () => {
    const {
      protocolConfig,
      seniorTranche,
      depositToTranche,
      withdrawFromTranche,
      parseTokenUnits,
      wallet,
      token,
      startAssetVaultAndEnableLiveActions,
    } = await loadFixture(assetVaultFixture)
    const protocolFeeRate = 100
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

    await startAssetVaultAndEnableLiveActions()
    const amount = parseTokenUnits(1000000)
    await depositToTranche(seniorTranche, amount)

    await timeTravel(YEAR)

    const withdrawAmount = parseTokenUnits(500000)
    await expect(() => withdrawFromTranche(seniorTranche, withdrawAmount)).to.changeTokenBalance(
      token,
      wallet.address,
      withdrawAmount
    )
  })

  it('fees do not have impact on requested shares amount in mint', async () => {
    const {
      protocolConfig,
      seniorTranche,
      mintToTranche,
      depositToTranche,
      parseTokenUnits,
      wallet,
      startAssetVaultAndEnableLiveActions,
    } = await loadFixture(assetVaultFixture)
    const protocolFeeRate = 100
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

    await startAssetVaultAndEnableLiveActions()
    await depositToTranche(seniorTranche, parseTokenUnits(1e6))
    await timeTravel(YEAR)

    const amount = parseTokenUnits(1e6)
    await expect(() => mintToTranche(seniorTranche, amount)).to.changeTokenBalance(
      seniorTranche,
      wallet.address,
      amount
    )
  })

  it('correctly calculates totalAssets when there are unpaid fees', async () => {
    const {
      assetVault,
      protocolConfig,
      seniorTranche,
      depositToTranche,
      parseTokenUnits,
      startAssetVaultAndEnableLiveActions,
      disburse,
    } = await loadFixture(assetVaultFixture)
    const protocolFeeRate = 100
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

    const depositAmount = parseTokenUnits(1e6)
    await depositToTranche(seniorTranche, depositAmount)
    await startAssetVaultAndEnableLiveActions()

    const totalAssets = await assetVault.totalAssets()

    const principal = totalAssets.sub(1e3)
    await disburse(principal)

    await timeTravel(DAY)
    await assetVault.updateCheckpoints()

    const expectedFees = getInterest(totalAssets, protocolFeeRate, DAY)
    expect(await seniorTranche.unpaidProtocolFee()).to.be.gt(0)
    expect(await assetVault.totalAssets()).to.be.closeTo(totalAssets.sub(expectedFees), parseTokenUnits(0.01))
  })

  it('not collected in capital formation', async () => {
    const {
      seniorTranche,
      depositToTranche,
      protocolConfig,
      parseTokenUnits,
      token,
      protocolConfigParams: { protocolTreasury },
    } = await loadFixture(assetVaultFixture)
    await protocolConfig.setDefaultProtocolFeeRate(500)

    await depositToTranche(seniorTranche, parseTokenUnits(1e6))
    await timeTravel(MONTH)
    await depositToTranche(seniorTranche, 1)

    expect(await token.balanceOf(protocolTreasury)).to.eq(0)
  })

  it('collected in Closed status after transition from Live', async () => {
    const {
      seniorTranche,
      depositToTranche,
      withdrawFromTranche,
      protocolConfig,
      parseTokenUnits,
      token,
      protocolConfigParams: { protocolTreasury },
      startAndCloseAssetVault,
    } = await loadFixture(assetVaultFixture)
    await protocolConfig.setDefaultProtocolFeeRate(500)

    await depositToTranche(seniorTranche, parseTokenUnits(1e6))
    await startAndCloseAssetVault()

    const balanceAfterClose = await token.balanceOf(protocolTreasury)
    await timeTravel(MONTH)
    await withdrawFromTranche(seniorTranche, 1)

    expect(await token.balanceOf(protocolTreasury)).to.be.gt(balanceAfterClose)
  })

  it('protocol fees paid when updating checkpoint from AssetVault in Closed', async () => {
    const {
      seniorTranche,
      protocolConfig,
      depositToTranche,
      parseTokenUnits,
      disburse,
      updateState,
      assetVault,
      assetVaultDuration,
      token,
      protocolConfigParams: { protocolTreasury },
    } = await loadFixture(assetVaultFixture)
    await protocolConfig.setDefaultProtocolFeeRate(500)

    await depositToTranche(seniorTranche, parseTokenUnits(1e6))

    await assetVault.start()
    await disburse(parseTokenUnits(1e5))

    await timeTravel(assetVaultDuration)
    await assetVault.close()

    await timeTravel(MONTH)

    const protocolBalanceBeforeDefault = await token.balanceOf(protocolTreasury)
    await expect(updateState(0)).to.emit(seniorTranche, 'ProtocolFeePaid')
    const protocolBalanceAfterDefault = await token.balanceOf(protocolTreasury)

    expect(protocolBalanceAfterDefault.gt(protocolBalanceBeforeDefault)).to.be.true
  })

  it('collected in Closed status after transition from CapitalFormation', async () => {
    const {
      seniorTranche,
      depositToTranche,
      protocolConfig,
      parseTokenUnits,
      token,
      protocolConfigParams: { protocolTreasury },
      assetVault,
    } = await loadFixture(assetVaultFixture)
    await protocolConfig.setDefaultProtocolFeeRate(500)

    await depositToTranche(seniorTranche, parseTokenUnits(1e6))
    await assetVault.close()

    const balanceAfterClose = await token.balanceOf(protocolTreasury)
    await timeTravel(MONTH)
    await seniorTranche.updateCheckpoint()

    expect(await token.balanceOf(protocolTreasury)).to.be.gt(balanceAfterClose)
  })

  describe('manager + protocol fee', () => {
    it('updates both unpaid fees if insufficient liquidity', async () => {
      const {
        assetVault,
        seniorTranche,
        juniorTranche,
        equityTranche,
        depositToTranche,
        parseTokenUnits,
        startAssetVaultAndEnableLiveActions,
        protocolConfig,
        disburse,
        junior,
        senior,
        token,
      } = await loadFixture(assetVaultFixture)
      const feeRate = 500
      await seniorTranche.setManagerFeeRate(feeRate)
      await juniorTranche.setManagerFeeRate(feeRate)
      await equityTranche.setManagerFeeRate(feeRate)
      await protocolConfig.setDefaultProtocolFeeRate(feeRate)

      await startAssetVaultAndEnableLiveActions()
      const equityDeposit = parseTokenUnits(4000)
      const juniorDeposit = parseTokenUnits(2000)
      const seniorDeposit = parseTokenUnits(1000)

      await depositToTranche(equityTranche, equityDeposit)
      await depositToTranche(juniorTranche, juniorDeposit)
      await depositToTranche(seniorTranche, seniorDeposit)
      const assetVaultBalance = await token.balanceOf(assetVault.address)

      await disburse(assetVaultBalance.sub(1e4))

      await timeTravel(YEAR)

      await assetVault.updateCheckpoints()

      const delta = parseTokenUnits(0.01)

      const juniorWithInterest = withInterest(juniorDeposit, junior.targetApy, YEAR)
      const expectedJuniorFee = percentOf(juniorWithInterest, feeRate)
      expect(await juniorTranche.unpaidProtocolFee()).to.be.closeTo(expectedJuniorFee, delta)
      expect(await juniorTranche.unpaidManagerFee()).to.be.closeTo(expectedJuniorFee, delta)

      const seniorWithInterest = withInterest(seniorDeposit, senior.targetApy, YEAR)
      const expectedSeniorFee = percentOf(seniorWithInterest, feeRate)
      expect(await seniorTranche.unpaidProtocolFee()).to.be.closeTo(expectedSeniorFee, delta)
      expect(await seniorTranche.unpaidManagerFee()).to.be.closeTo(expectedSeniorFee, delta)

      const assetVaultFees = await assetVault.totalPendingFees()
      const expectedEquityFee = assetVaultFees.sub(expectedSeniorFee.mul(2)).sub(expectedJuniorFee.mul(2)).div(2)
      expect(await equityTranche.unpaidProtocolFee()).to.be.closeTo(expectedEquityFee, delta)
      expect(await equityTranche.unpaidManagerFee()).to.be.closeTo(expectedEquityFee, delta)
    })

    it('transfers manager fee to manager if sufficient liquidity', async () => {
      const {
        assetVault,
        seniorTranche,
        depositToTranche,
        parseTokenUnits,
        token,
        startAssetVaultAndEnableLiveActions,
        wallet,
        protocolConfig,
        protocolConfigParams,
      } = await loadFixture(assetVaultFixture)
      const feeRate = 500
      await seniorTranche.setManagerFeeRate(feeRate)
      await protocolConfig.setDefaultProtocolFeeRate(feeRate)
      const { protocolTreasury } = protocolConfigParams

      await startAssetVaultAndEnableLiveActions()
      await depositToTranche(seniorTranche, parseTokenUnits(1000))
      await timeTravel(YEAR)

      const assetVaultBalanceBefore = await token.balanceOf(assetVault.address)
      const managerBalanceBefore = await token.balanceOf(wallet.address)
      const protocolBalanceBefore = await token.balanceOf(protocolTreasury)

      await assetVault.updateCheckpoints()
      await depositToTranche(seniorTranche, 1)

      const delta = parseTokenUnits(0.0001)
      const expectedFeeAmount = parseTokenUnits(50)
      expect(await token.balanceOf(assetVault.address)).to.be.closeTo(
        assetVaultBalanceBefore.sub(expectedFeeAmount.mul(2)),
        delta
      )
      expect(await token.balanceOf(wallet.address)).to.be.closeTo(managerBalanceBefore.add(expectedFeeAmount), delta)
      expect(await token.balanceOf(protocolTreasury)).to.be.closeTo(protocolBalanceBefore.add(expectedFeeAmount), delta)
    })
  })
})
