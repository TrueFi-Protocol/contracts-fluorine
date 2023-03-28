import { ContractTransaction } from 'ethers'
import { assetVaultFixture, assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { assetVaultFactoryFixture } from 'fixtures/assetVaultFactoryFixture'
import { timeTravel } from 'utils/timeTravel'
import { setupFixtureLoader } from './setup'
import { YEAR } from 'utils/constants'

const numberWithCommas = (x: string) => x.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const printGasCost = async (tx: ContractTransaction) => {
  console.log(' '.repeat(10) + 'Gas used: ', numberWithCommas((await tx.wait()).gasUsed.toString()))
}

describe('Gas cost', () => {
  const loadFixture = setupFixtureLoader()
  let testedTx: ContractTransaction

  afterEach(async () => {
    await printGasCost(testedTx)
  })

  describe('AssetVaultFactory', () => {
    it('create AssetVault for 3 tranches', async () => {
      const { createAssetVaultTx } = await loadFixture(assetVaultFactoryFixture)
      testedTx = createAssetVaultTx
    })
  })

  describe('AssetVault', () => {
    describe('3 tranches', () => {
      it('disburse (first)', async () => {
        const { disburse, parseTokenUnits } = await loadFixture(assetVaultLiveFixture)
        const principal = parseTokenUnits(1e6)
        const interest = parseTokenUnits(1e5)

        testedTx = await disburse(principal, { interest })
      })

      it('disburse (following)', async () => {
        const { disburse, parseTokenUnits } = await loadFixture(assetVaultLiveFixture)
        const principal = parseTokenUnits(1e6)
        const interest = parseTokenUnits(1e5)

        await disburse(principal, { interest })
        testedTx = await disburse(principal, { interest })
      })

      it('repay in Live (first)', async () => {
        const { disburse, parseTokenUnits, repay } = await loadFixture(assetVaultLiveFixture)
        const principal = parseTokenUnits(1e6)
        const interest = parseTokenUnits(1e5)

        await disburse(principal, { interest })
        testedTx = await repay(principal, interest)
      })

      it('repay in Live (following)', async () => {
        const { disburse, parseTokenUnits, repay } = await loadFixture(assetVaultLiveFixture)
        const principal = parseTokenUnits(1e6)
        const interest = parseTokenUnits(1e5)

        await disburse(principal, { interest })
        await repay(principal.div(2), interest.div(2))
        testedTx = await repay(principal.div(2), interest.div(2))
      })

      it('repay in Live (after default)', async () => {
        const { disburse, parseTokenUnits, repay, updateState } = await loadFixture(assetVaultLiveFixture)
        const principal = parseTokenUnits(1e6)
        const interest = parseTokenUnits(1e5)

        await disburse(principal, { interest })
        await updateState(0)
        testedTx = await repay(principal, interest, { outstandingAssets: 0 })
      })

      it('repay in Closed (first)', async () => {
        const { disburse, parseTokenUnits, repay, assetVault, assetVaultDuration } = await loadFixture(
          assetVaultLiveFixture
        )
        const principal = parseTokenUnits(1e6)
        const interest = parseTokenUnits(1e5)

        await disburse(principal, { interest })
        await timeTravel(assetVaultDuration)
        await assetVault.close()

        testedTx = await repay(principal, interest)
      })

      it('repay in Closed (following)', async () => {
        const { disburse, parseTokenUnits, repay, assetVault, assetVaultDuration } = await loadFixture(
          assetVaultLiveFixture
        )
        const principal = parseTokenUnits(1e6)
        const interest = parseTokenUnits(1e5)

        await disburse(principal, { interest })
        await timeTravel(assetVaultDuration)
        await assetVault.close()

        await repay(principal.div(2), interest.div(2))
        testedTx = await repay(principal.div(2), interest.div(2))
      })

      it('repay in Closed (after default)', async () => {
        const { disburse, parseTokenUnits, repay, updateState, assetVault } = await loadFixture(assetVaultLiveFixture)
        const principal = parseTokenUnits(1e6)
        const interest = parseTokenUnits(1e5)

        await disburse(principal, { interest })
        await updateState(0)
        await assetVault.close()

        testedTx = await repay(principal, interest, { outstandingAssets: 0 })
      })

      it('update state (first)', async () => {
        const { updateState, parseTokenUnits } = await loadFixture(assetVaultLiveFixture)
        testedTx = await updateState(parseTokenUnits(1e6))
      })

      it('update state (following)', async () => {
        const { updateState, parseTokenUnits } = await loadFixture(assetVaultLiveFixture)
        await updateState(parseTokenUnits(1e6))
        testedTx = await updateState(parseTokenUnits(1e6))
      })

      it('update state (outstanding assets == 0)', async () => {
        const { updateState, parseTokenUnits } = await loadFixture(assetVaultLiveFixture)
        await updateState(parseTokenUnits(1e6))
        testedTx = await updateState(0)
      })

      it('start', async () => {
        const { assetVaultStartTx } = await loadFixture(assetVaultLiveFixture)
        testedTx = assetVaultStartTx
      })

      it('close (in Capital Formation)', async () => {
        const { assetVault } = await loadFixture(assetVaultFixture)
        testedTx = await assetVault.close()
      })

      it('close (in Live)', async () => {
        const { assetVault } = await loadFixture(assetVaultLiveFixture)
        await timeTravel(YEAR)
        testedTx = await assetVault.close()
      })
    })
  })
})
