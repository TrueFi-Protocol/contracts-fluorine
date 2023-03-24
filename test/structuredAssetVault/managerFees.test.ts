import { expect } from 'chai'
import { assetVaultFixture, assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { MONTH, YEAR } from 'utils/constants'
import { timePassedBetween } from 'utils/timestamp'
import { timeTravel, timeTravelTo } from 'utils/timeTravel'
import { percentOf } from 'utils/percentOf'
import { withInterest } from 'utils/interest'

describe('StructuredAssetVault: manager fees', () => {
  const loadFixture = setupFixtureLoader()

  it('updates unpaid manager fees if insufficient liquidity', async () => {
    const {
      assetVault,
      seniorTranche,
      juniorTranche,
      equityTranche,
      depositToTranche,
      parseTokenUnits,
      startAssetVaultAndEnableLiveActions,
      disburse,
      junior,
      senior,
      token,
    } = await loadFixture(assetVaultFixture)
    const managerFee = 500
    await equityTranche.setManagerFeeRate(managerFee)
    await juniorTranche.setManagerFeeRate(managerFee)
    await seniorTranche.setManagerFeeRate(managerFee)

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

    const juniorValue = withInterest(juniorDeposit, junior.targetApy, YEAR)
    const expectedJuniorFee = percentOf(juniorValue, managerFee)

    const seniorValue = withInterest(seniorDeposit, senior.targetApy, YEAR)
    const expectedSeniorFee = percentOf(seniorValue, managerFee)

    const assetVaultFees = await assetVault.totalPendingFees()
    const expectedEquityFee = assetVaultFees.sub(expectedSeniorFee).sub(expectedJuniorFee)

    const delta = parseTokenUnits(0.01)
    expect(await equityTranche.unpaidManagerFee()).to.be.closeTo(expectedEquityFee, delta)
    expect(await juniorTranche.unpaidManagerFee()).to.be.closeTo(expectedJuniorFee, delta)
    expect(await seniorTranche.unpaidManagerFee()).to.be.closeTo(expectedSeniorFee, delta)
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
    } = await loadFixture(assetVaultFixture)
    const managerFee = 500
    await seniorTranche.setManagerFeeRate(managerFee)

    await startAssetVaultAndEnableLiveActions()

    await depositToTranche(seniorTranche, parseTokenUnits(1000))
    await timeTravel(YEAR)

    const assetVaultBalanceBefore = await token.balanceOf(assetVault.address)
    const managerBalanceBefore = await token.balanceOf(wallet.address)

    await depositToTranche(seniorTranche, 1)

    const delta = parseTokenUnits(0.0001)
    const expectedFeeAmount = parseTokenUnits(50)
    expect(await token.balanceOf(assetVault.address)).to.be.closeTo(
      assetVaultBalanceBefore.sub(expectedFeeAmount),
      delta
    )
    expect(await token.balanceOf(wallet.address)).to.be.closeTo(managerBalanceBefore.add(expectedFeeAmount), delta)
  })

  it('emits ManagerFeePaid event', async () => {
    const { seniorTranche, depositToTranche, parseTokenUnits, startAssetVaultAndEnableLiveActions, wallet } =
      await loadFixture(assetVaultFixture)
    const managerFee = 500
    await seniorTranche.setManagerFeeRate(managerFee)

    await startAssetVaultAndEnableLiveActions()
    const amount = parseTokenUnits(1e6)
    const firstDepositTx = await depositToTranche(seniorTranche, amount)
    await timeTravel(YEAR)

    const lastDepositTx = await depositToTranche(seniorTranche, 1)

    const timePassed = await timePassedBetween(firstDepositTx, lastDepositTx)
    const expectedFee = percentOf(amount.mul(timePassed), managerFee).div(YEAR)
    await expect(lastDepositTx).to.emit(seniorTranche, 'ManagerFeePaid').withArgs(wallet.address, expectedFee)
  })

  it('almost no fee is applied for withdrawal right after deposit', async () => {
    const {
      seniorTranche,
      depositToTranche,
      redeemFromTranche,
      parseTokenUnits,
      wallet,
      token,
      startAssetVaultAndEnableLiveActions,
    } = await loadFixture(assetVaultFixture)
    const managerFee = 500
    await seniorTranche.setManagerFeeRate(managerFee)

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
      seniorTranche,
      depositToTranche,
      withdrawFromTranche,
      parseTokenUnits,
      wallet,
      other,
      token,
      startAssetVaultAndEnableLiveActions,
    } = await loadFixture(assetVaultFixture)
    const managerFee = 500
    await seniorTranche.setManagerFeeRate(managerFee)

    await startAssetVaultAndEnableLiveActions()
    const amount = parseTokenUnits(1000000)
    await depositToTranche(seniorTranche, amount)

    await timeTravel(YEAR)

    const withdrawAmount = parseTokenUnits(500000)
    await expect(() =>
      withdrawFromTranche(seniorTranche, withdrawAmount, wallet.address, other.address)
    ).to.changeTokenBalance(token, other.address, withdrawAmount)
  })

  it('fees do not have impact on requested shares amount in mint', async () => {
    const {
      seniorTranche,
      mintToTranche,
      depositToTranche,
      parseTokenUnits,
      wallet,
      startAssetVaultAndEnableLiveActions,
    } = await loadFixture(assetVaultFixture)
    const managerFee = 500
    await seniorTranche.setManagerFeeRate(managerFee)

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
      seniorTranche,
      depositToTranche,
      parseTokenUnits,
      token,
      startAssetVaultAndEnableLiveActions,
      disburse,
    } = await loadFixture(assetVaultFixture)
    const managerFee = 100
    await seniorTranche.setManagerFeeRate(managerFee)

    const seniorDeposit = parseTokenUnits(1e6)
    await depositToTranche(seniorTranche, seniorDeposit)
    await startAssetVaultAndEnableLiveActions()

    const assetVaultBalance = await token.balanceOf(assetVault.address)
    await disburse(assetVaultBalance.sub(1e4))

    await timeTravel(YEAR)

    await assetVault.updateCheckpoints()

    expect(await seniorTranche.unpaidManagerFee()).to.be.gt(0)

    const seniorFees = percentOf(seniorDeposit, managerFee)
    const expectedSeniorValue = seniorDeposit.sub(seniorFees)

    expect(await assetVault.totalAssets()).to.be.closeTo(expectedSeniorValue, parseTokenUnits(0.01))
  })

  it('not collected in capital formation', async () => {
    const { seniorTranche, depositToTranche, parseTokenUnits, token, another } = await loadFixture(assetVaultFixture)
    await seniorTranche.setManagerFeeRate(500)
    await seniorTranche.setManagerFeeBeneficiary(another.address)

    await depositToTranche(seniorTranche, parseTokenUnits(1e6))
    await timeTravel(MONTH)
    await depositToTranche(seniorTranche, 1)

    expect(await token.balanceOf(another.address)).to.eq(0)
  })

  it('not collected in Closed status', async () => {
    const {
      seniorTranche,
      depositToTranche,
      withdrawFromTranche,
      parseTokenUnits,
      token,
      startAndCloseAssetVault,
      another,
    } = await loadFixture(assetVaultFixture)
    await seniorTranche.setManagerFeeRate(500)
    await seniorTranche.setManagerFeeBeneficiary(another.address)

    await depositToTranche(seniorTranche, parseTokenUnits(1e6))
    await startAndCloseAssetVault()

    const balanceAfterClose = await token.balanceOf(another.address)
    await timeTravel(MONTH)
    await withdrawFromTranche(seniorTranche, 1)

    expect(await token.balanceOf(another.address)).to.eq(balanceAfterClose)
  })

  it('caps pending fees to tranche assets', async () => {
    const { juniorTranche, assetVault, assetVaultStartTimestamp, senior, junior, totalDeposit, parseTokenUnits } =
      await loadFixture(assetVaultLiveFixture)
    const managerFee = 12000
    await juniorTranche.setManagerFeeRate(managerFee)

    await timeTravelTo(assetVaultStartTimestamp + YEAR)
    await assetVault.updateCheckpoints()

    const waterfall = await assetVault.calculateWaterfall()

    const expectedSenior = withInterest(senior.initialDeposit, senior.targetApy, YEAR)
    const expectedJunior = withInterest(junior.initialDeposit, junior.targetApy, YEAR)
    const expectedEquity = totalDeposit.sub(expectedSenior).sub(expectedJunior)

    const delta = parseTokenUnits(0.01)
    expect(waterfall[0]).to.be.closeTo(expectedEquity, delta)
    expect(waterfall[1]).to.eq(0)
    expect(waterfall[2]).to.be.closeTo(expectedSenior, delta)
  })

  it('caps pending fees to tranche assets for multiple fee types', async () => {
    const {
      juniorTranche,
      assetVault,
      assetVaultStartTimestamp,
      senior,
      junior,
      totalDeposit,
      parseTokenUnits,
      protocolConfig,
    } = await loadFixture(assetVaultLiveFixture)
    const managerFee = 6000
    await juniorTranche.setManagerFeeRate(managerFee)
    const protocolFee = 6000
    await protocolConfig.setCustomProtocolFeeRate(juniorTranche.address, protocolFee)
    await assetVault.updateCheckpoints()

    await timeTravelTo(assetVaultStartTimestamp + YEAR)
    await assetVault.updateCheckpoints()

    const waterfall = await assetVault.calculateWaterfall()

    const expectedSenior = withInterest(senior.initialDeposit, senior.targetApy, YEAR)
    const expectedJunior = withInterest(junior.initialDeposit, junior.targetApy, YEAR)
    const expectedEquity = totalDeposit.sub(expectedSenior).sub(expectedJunior)

    const delta = parseTokenUnits(0.01)
    expect(waterfall[0]).to.be.closeTo(expectedEquity, delta)
    expect(waterfall[1]).to.eq(0)
    expect(waterfall[2]).to.be.closeTo(expectedSenior, delta)
  })
})
