import { expect } from 'chai'
import { constants } from 'ethers'
import { assetVaultFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { MONTH, YEAR } from 'utils/constants'
import { timeTravel, timeTravelFrom } from 'utils/timeTravel'
import { getInterest } from 'utils/interest'

describe('StructuredAssetVault: disbursements integration tests', () => {
  const loadFixture = setupFixtureLoader()

  async function fixture() {
    const fixtureResult = await loadFixture(assetVaultFixture)
    const { provider, protocolConfig, parseTokenUnits, tranches, depositToTranche } = fixtureResult

    const [, , , lenderA, lenderB, managerFeeBeneficiary] = provider.getWallets()

    const protocolFeeRate = 20
    const managerFeeRate = 30

    async function enableFees() {
      await protocolConfig.setDefaultProtocolFeeRate(protocolFeeRate)
      for (const tranche of tranches) {
        await tranche.setManagerFeeBeneficiary(managerFeeBeneficiary.address)
        await tranche.setManagerFeeRate(managerFeeRate)
      }
    }

    const depositAmount = parseTokenUnits(1e6)

    async function depositToTranches() {
      for (const tranche of tranches) {
        await depositToTranche(tranche, depositAmount, lenderA.address)
        await depositToTranche(tranche, depositAmount, lenderB.address)
      }
      const totalDeposited = depositAmount.mul(2).mul(tranches.length)
      return totalDeposited
    }

    return {
      ...fixtureResult,
      lenderA,
      lenderB,
      managerFeeBeneficiary,
      depositAmount,
      protocolFeeRate,
      managerFeeRate,
      depositToTranches,
      enableFees,
    }
  }

  it('half repaid and half lost after close', async () => {
    const {
      wallet,
      lenderA,
      lenderB,
      managerFeeBeneficiary,
      depositAmount,
      protocolFeeRate,
      managerFeeRate,
      parseTokenUnits,
      redeemFromTranche,
      loseAssets,
      assetVaultDuration,
      assetVault,
      repay,
      disburse,
      tranches,
      seniorTranche,
      juniorTranche,
      equityTranche,
      token,
      protocolConfigParams: { protocolTreasury },
      enableFees,
      depositToTranches,
      startAssetVaultAndEnableLiveActions,
    } = await fixture()

    await enableFees()
    const totalDeposited = await depositToTranches()
    const startTx = await startAssetVaultAndEnableLiveActions()

    const principal = depositAmount.mul(4)
    const interest = depositAmount.mul(2)

    await disburse(principal, { interest })

    await timeTravelFrom(startTx, assetVaultDuration + 1)
    await assetVault.close()

    await loseAssets(principal.add(interest).div(2))
    await repay(principal.div(2), interest.div(2))

    for (const tranche of tranches) {
      await tranche.connect(lenderA).approve(wallet.address, constants.MaxUint256)
      await redeemFromTranche(tranche, await tranche.balanceOf(lenderA.address), lenderA.address, lenderA.address)

      await tranche.connect(lenderB).approve(wallet.address, constants.MaxUint256)
      await redeemFromTranche(tranche, await tranche.balanceOf(lenderB.address), lenderB.address, lenderB.address)
    }

    const finalAssetVaultAmount = totalDeposited.sub(principal.div(2)).add(interest.div(2))
    const finalAssetVaultVirtualAmount = totalDeposited.add(interest)

    const delta = parseTokenUnits('0.01')

    const expectedProtocolFee = getInterest(finalAssetVaultVirtualAmount, protocolFeeRate, assetVaultDuration)
    expect(await token.balanceOf(protocolTreasury)).to.be.closeTo(expectedProtocolFee, delta)

    const expectedManagerFee = getInterest(finalAssetVaultVirtualAmount, managerFeeRate, assetVaultDuration)
    expect(await token.balanceOf(managerFeeBeneficiary.address)).to.be.closeTo(expectedManagerFee, delta)

    const expectedLenderBalance = finalAssetVaultAmount.sub(expectedProtocolFee).sub(expectedManagerFee).div(2)
    expect(await token.balanceOf(lenderA.address)).to.be.closeTo(expectedLenderBalance, delta)
    expect(await token.balanceOf(lenderB.address)).to.be.closeTo(expectedLenderBalance, delta)

    expect(await token.balanceOf(seniorTranche.address)).to.eq(0)
    expect(await token.balanceOf(juniorTranche.address)).to.eq(0)
    expect(await token.balanceOf(equityTranche.address)).to.eq(0)
  })

  it('half repaid and half lost just before close', async () => {
    const {
      wallet,
      lenderA,
      lenderB,
      managerFeeBeneficiary,
      depositAmount,
      protocolFeeRate,
      managerFeeRate,
      parseTokenUnits,
      redeemFromTranche,
      loseAssets,
      assetVaultDuration,
      assetVault,
      repay,
      disburse,
      tranches,
      seniorTranche,
      juniorTranche,
      equityTranche,
      token,
      protocolConfigParams: { protocolTreasury },
      enableFees,
      depositToTranches,
      startAssetVaultAndEnableLiveActions,
    } = await fixture()

    await enableFees()
    const totalDeposited = await depositToTranches()
    const startTx = await startAssetVaultAndEnableLiveActions()

    const principal = depositAmount.mul(4)
    const interest = depositAmount.mul(2)

    await disburse(principal, { interest })

    await timeTravelFrom(startTx, assetVaultDuration + 1)

    await loseAssets(principal.add(interest).div(2))
    await repay(principal.div(2), interest.div(2))

    await assetVault.close()

    for (const tranche of tranches) {
      await tranche.connect(lenderA).approve(wallet.address, constants.MaxUint256)
      await redeemFromTranche(tranche, await tranche.balanceOf(lenderA.address), lenderA.address, lenderA.address)

      await tranche.connect(lenderB).approve(wallet.address, constants.MaxUint256)
      await redeemFromTranche(tranche, await tranche.balanceOf(lenderB.address), lenderB.address, lenderB.address)
    }

    const finalAssetVaultAmount = totalDeposited.sub(principal.div(2)).add(interest.div(2))
    const finalAssetVaultVirtualAmount = totalDeposited.add(interest)

    const delta = parseTokenUnits('0.02')

    const expectedProtocolFee = getInterest(finalAssetVaultVirtualAmount, protocolFeeRate, assetVaultDuration)
    expect(await token.balanceOf(protocolTreasury)).to.be.closeTo(expectedProtocolFee, delta)

    const expectedManagerFee = getInterest(finalAssetVaultVirtualAmount, managerFeeRate, assetVaultDuration)
    expect(await token.balanceOf(managerFeeBeneficiary.address)).to.be.closeTo(expectedManagerFee, delta)

    const expectedLenderBalance = finalAssetVaultAmount.sub(expectedProtocolFee).sub(expectedManagerFee).div(2)
    expect(await token.balanceOf(lenderA.address)).to.be.closeTo(expectedLenderBalance, delta)
    expect(await token.balanceOf(lenderB.address)).to.be.closeTo(expectedLenderBalance, delta)

    expect(await token.balanceOf(seniorTranche.address)).to.eq(0)
    expect(await token.balanceOf(juniorTranche.address)).to.eq(0)
    expect(await token.balanceOf(equityTranche.address)).to.eq(0)
  })

  it('half defaults before and half after AssetVault close', async () => {
    const {
      depositAmount,
      assetVaultDuration,
      disburse,
      updateState,
      assetVault,
      wallet,
      lenderA,
      lenderB,
      redeemFromTranche,
      seniorTranche,
      parseTokenUnits,
      protocolFeeRate,
      managerFeeRate,
      token,
      protocolConfigParams: { protocolTreasury },
      managerFeeBeneficiary,
      enableFees,
      depositToTranches,
      startAssetVaultAndEnableLiveActions,
    } = await fixture()

    await enableFees()
    const totalDeposited = await depositToTranches()
    const startTx = await startAssetVaultAndEnableLiveActions()

    const principal = depositAmount.mul(4)
    const interest = depositAmount.mul(2)
    await disburse(principal, { interest })

    await timeTravelFrom(startTx, assetVaultDuration)

    await updateState(principal.add(interest).div(2)) // default half
    await assetVault.close()

    await timeTravel(MONTH)
    await updateState(0) // default another half

    await seniorTranche.connect(lenderA).approve(wallet.address, constants.MaxUint256)
    await redeemFromTranche(
      seniorTranche,
      await seniorTranche.balanceOf(lenderA.address),
      lenderA.address,
      lenderA.address
    )

    await seniorTranche.connect(lenderB).approve(wallet.address, constants.MaxUint256)
    await redeemFromTranche(
      seniorTranche,
      await seniorTranche.balanceOf(lenderB.address),
      lenderB.address,
      lenderB.address
    )

    const finalAssetVaultAmount = totalDeposited.sub(principal)
    const assetVaultAmountOnDefault = totalDeposited.add(interest)
    const protocolFeeUntilClose = getInterest(assetVaultAmountOnDefault, protocolFeeRate, assetVaultDuration)
    const managerFeeUntilClose = getInterest(assetVaultAmountOnDefault, managerFeeRate, assetVaultDuration)

    const assetVaultAmountAfterClose = finalAssetVaultAmount.sub(protocolFeeUntilClose).sub(managerFeeUntilClose)
    const protocolFeeAfterClose = getInterest(assetVaultAmountAfterClose, protocolFeeRate, MONTH)
    const expectedProtocolFee = protocolFeeUntilClose.add(protocolFeeAfterClose)

    const delta = parseTokenUnits('0.01')

    expect(await token.balanceOf(protocolTreasury)).to.be.closeTo(expectedProtocolFee, delta)
    expect(await token.balanceOf(managerFeeBeneficiary.address)).to.be.closeTo(managerFeeUntilClose, delta)

    const expectedLenderBalance = assetVaultAmountAfterClose.sub(protocolFeeAfterClose).div(2)
    expect(await token.balanceOf(lenderA.address)).to.be.closeTo(expectedLenderBalance, delta)
    expect(await token.balanceOf(lenderB.address)).to.be.closeTo(expectedLenderBalance, delta)

    expect(await token.balanceOf(seniorTranche.address)).to.eq(0)
  })

  it('disburse drains AssetVault', async () => {
    const {
      tranches,
      seniorTranche,
      juniorTranche,
      equityTranche,
      depositToTranche,
      startAssetVaultAndEnableLiveActions,
      assetVault,
      token,
      disburse,
      enableFees,
      depositToTranches,
      depositAmount,
    } = await fixture()

    await depositToTranches()
    await startAssetVaultAndEnableLiveActions()

    await disburse(await token.balanceOf(assetVault.address))

    await enableFees()

    // wait for fees to accrue
    await timeTravel(YEAR)
    await assetVault.updateCheckpoints()
    for (const tranche of tranches) {
      expect(await tranche.unpaidManagerFee()).to.be.gt(0)
      expect(await tranche.unpaidProtocolFee()).to.be.gt(0)
    }

    await depositToTranche(seniorTranche, depositAmount)
    expect(await seniorTranche.unpaidManagerFee()).to.be.gt(0)
    expect(await seniorTranche.unpaidProtocolFee()).to.be.gt(0)

    await depositToTranche(juniorTranche, depositAmount)
    expect(await juniorTranche.unpaidManagerFee()).to.eq(0)
    expect(await juniorTranche.unpaidProtocolFee()).to.eq(0)

    await depositToTranche(equityTranche, depositAmount)
    expect(await equityTranche.unpaidManagerFee()).to.eq(0)
    expect(await equityTranche.unpaidProtocolFee()).to.eq(0)

    await assetVault.updateCheckpoints()
    expect(await seniorTranche.unpaidManagerFee()).to.eq(0)
    expect(await seniorTranche.unpaidProtocolFee()).to.eq(0)
  })

  it('disburse drains AssetVault, repay after close', async () => {
    const {
      token,
      disburse,
      assetVault,
      startAssetVaultAndEnableLiveActions,
      depositToTranches,
      enableFees,
      assetVaultDuration,
      tranches,
      repay,
      wallet,
      lenderA,
      lenderB,
      redeemFromTranche,
      parseTokenUnits,
    } = await fixture()

    await depositToTranches()
    const startTx = await startAssetVaultAndEnableLiveActions()

    const principal = await token.balanceOf(assetVault.address)
    const interest = parseTokenUnits(1e5)
    await disburse(principal, { interest })

    await enableFees()

    await timeTravelFrom(startTx, assetVaultDuration + 1)
    await assetVault.close()

    for (const tranche of tranches) {
      expect(await tranche.unpaidManagerFee()).to.be.gt(0)
      expect(await tranche.unpaidProtocolFee()).to.be.gt(0)
    }

    await repay(principal, interest)

    for (const tranche of tranches) {
      expect(await tranche.unpaidManagerFee()).to.eq(0)
      expect(await tranche.unpaidProtocolFee()).to.eq(0)
    }

    for (const tranche of tranches) {
      await tranche.connect(lenderA).approve(wallet.address, constants.MaxUint256)
      await redeemFromTranche(tranche, await tranche.balanceOf(lenderA.address), lenderA.address, lenderA.address)

      await tranche.connect(lenderB).approve(wallet.address, constants.MaxUint256)
      await redeemFromTranche(tranche, await tranche.balanceOf(lenderB.address), lenderB.address, lenderB.address)

      expect(await token.balanceOf(tranche.address)).to.eq(0)
    }
  })
})
