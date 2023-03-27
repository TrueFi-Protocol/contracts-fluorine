import { expect } from 'chai'
import { assetVaultFixture, assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { YEAR } from 'utils/constants'
import { timeTravelAndMine } from 'utils/timeTravel'
import { getInterest } from 'utils/interest'

describe('StructuredAssetVault.liquidAssets', () => {
  const loadFixture = setupFixtureLoader()

  it('simple token transfer does not make any effect', async () => {
    const { assetVault, token } = await loadFixture(assetVaultFixture)
    await token.transfer(assetVault.address, 1234)
    expect(await assetVault.liquidAssets()).to.eq(0)
  })

  it('respects pending fees', async () => {
    const { assetVault, seniorTranche, protocolConfig, depositToTranche, parseTokenUnits } = await loadFixture(
      assetVaultFixture
    )
    const protocolFeeRate = 500
    await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)

    const depositAmount = parseTokenUnits(1000)
    await depositToTranche(seniorTranche, depositAmount)

    await assetVault.start()
    await timeTravelAndMine(YEAR)

    const accruedFee = getInterest(depositAmount, protocolFeeRate, YEAR)

    const delta = parseTokenUnits(0.00001)
    expect(await assetVault.liquidAssets()).to.be.closeTo(depositAmount.sub(accruedFee), delta)
  })

  it('returns correct value after disburse', async () => {
    const { disburse, totalDeposit, parseTokenUnits, assetVault } = await loadFixture(assetVaultLiveFixture)
    const disbursedAmount = parseTokenUnits(1e6)
    await disburse(disbursedAmount)
    expect(await assetVault.liquidAssets()).to.eq(totalDeposit.sub(disbursedAmount))
  })
})
