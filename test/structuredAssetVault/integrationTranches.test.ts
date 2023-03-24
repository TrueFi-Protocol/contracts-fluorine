import { expect } from 'chai'
import { assetVaultFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { DAY, MONTH, YEAR } from 'utils/constants'
import { timeTravel } from 'utils/timeTravel'
import { getInterest } from 'utils/interest'

describe('StructuredAssetVault: tranches integration tests', () => {
  const loadFixture = setupFixtureLoader()

  it('no deposit in CapitalFormation, deposit just before close', async () => {
    const {
      startAssetVaultAndEnableLiveActions,
      depositToTranche,
      seniorTranche,
      juniorTranche,
      equityTranche,
      parseTokenUnits,
      assetVault,
      token,
    } = await loadFixture(assetVaultFixture)

    await startAssetVaultAndEnableLiveActions()

    await timeTravel(YEAR)

    const juniorDeposit = parseTokenUnits(1e6)
    const seniorDeposit = parseTokenUnits(2e6)
    const equityDeposit = parseTokenUnits(3e6)

    await depositToTranche(juniorTranche, juniorDeposit)
    await depositToTranche(seniorTranche, seniorDeposit)
    await depositToTranche(equityTranche, equityDeposit)

    await assetVault.close()

    const delta = parseTokenUnits('0.1')
    expect(await token.balanceOf(seniorTranche.address)).to.be.closeTo(seniorDeposit, delta)
    expect(await token.balanceOf(juniorTranche.address)).to.be.closeTo(juniorDeposit, delta)
    expect(await token.balanceOf(equityTranche.address)).to.be.closeTo(equityDeposit, delta)
  })

  it('no deposit to junior', async () => {
    const {
      seniorTranche,
      juniorTranche,
      equityTranche,
      parseTokenUnits,
      depositToTranche,
      assetVault,
      token,
      startAssetVaultAndEnableLiveActions,
    } = await loadFixture(assetVaultFixture)

    const depositAmount = parseTokenUnits(1e6)
    await depositToTranche(seniorTranche, depositAmount)
    await depositToTranche(equityTranche, depositAmount)

    await startAssetVaultAndEnableLiveActions()

    await timeTravel(YEAR)

    await assetVault.close()

    expect(await token.balanceOf(seniorTranche.address)).to.be.gt(depositAmount)
    expect(await token.balanceOf(juniorTranche.address)).to.eq(0)
    expect(await token.balanceOf(equityTranche.address)).to.be.lt(depositAmount)
  })

  it('deposit and immediately withdraw all from junior', async () => {
    const {
      seniorTranche,
      juniorTranche,
      equityTranche,
      parseTokenUnits,
      depositToTranche,
      redeemFromTranche,
      assetVault,
      token,
      startAssetVaultAndEnableLiveActions,
      wallet,
    } = await loadFixture(assetVaultFixture)

    const depositAmount = parseTokenUnits(1e6)
    await depositToTranche(seniorTranche, depositAmount)
    await depositToTranche(equityTranche, depositAmount)

    await startAssetVaultAndEnableLiveActions()

    await timeTravel(YEAR)

    await depositToTranche(juniorTranche, depositAmount)
    await redeemFromTranche(juniorTranche, await juniorTranche.balanceOf(wallet.address))

    await timeTravel(YEAR)

    await assetVault.close()

    expect(await token.balanceOf(seniorTranche.address)).to.be.gt(depositAmount)
    expect(await token.balanceOf(juniorTranche.address)).to.eq(0)
    expect(await token.balanceOf(equityTranche.address)).to.be.lt(depositAmount)
  })

  it('no assets in AssetVault lifetime', async () => {
    const { protocolConfig, assetVault } = await loadFixture(assetVaultFixture)
    await protocolConfig.setDefaultProtocolFeeRate(500)

    await assetVault.start()
    await timeTravel(YEAR)

    await expect(assetVault.close()).not.to.be.reverted
  })

  it('no assets in Capital Formation, only for a while in Live', async () => {
    const {
      startAssetVaultAndEnableLiveActions,
      depositToTranche,
      redeemFromTranche,
      juniorTranche,
      protocolConfig,
      assetVault,
      parseTokenUnits,
      wallet,
      protocolConfigParams: { protocolTreasury },
      junior,
      another: lender,
      token,
    } = await loadFixture(assetVaultFixture)
    const protocolFeeRate = 500
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

    await startAssetVaultAndEnableLiveActions()

    await timeTravel(MONTH)
    const depositAmount = parseTokenUnits(1e6)
    await depositToTranche(juniorTranche, depositAmount, lender.address)
    await timeTravel(DAY)

    const allShares = await juniorTranche.balanceOf(lender.address)
    await juniorTranche.connect(lender).approve(wallet.address, allShares)
    await redeemFromTranche(juniorTranche, allShares, lender.address, lender.address)
    await timeTravel(MONTH)

    await assetVault.close()

    const delta = parseTokenUnits('0.01')

    const expectedProtocolFee = getInterest(depositAmount, junior.targetApy, DAY)
    expect(await token.balanceOf(protocolTreasury)).to.be.closeTo(expectedProtocolFee, delta)
    expect(await token.balanceOf(lender.address)).to.be.closeTo(depositAmount.sub(expectedProtocolFee), delta)
  })
})
