import {
  DepositController,
  DepositController__factory,
  MockLenderVerifier__factory,
  StructuredAssetVaultTest__factory,
  TrancheVaultTest,
  TrancheVaultTest__factory,
  WithdrawController,
  WithdrawController__factory,
} from 'build/types'
import { BigNumberish, constants, Contract, ContractTransaction, Wallet } from 'ethers'
import { YEAR, DAY } from 'utils/constants'
import { extractEventArgFromTx } from 'utils/extractEventArgFromTx'
import { deployControllers } from 'fixtures/deployControllers'
import { deployProtocolConfig } from './deployProtocolConfig'
import { getTranchesInitData } from './getTranchesInitData'
import { FixtureConfig, TrancheData, TrancheInitData } from './types'
import { deployAssetVaultFactory } from './deployAssetVaultFactory'
import { deployToken } from './deployToken'

interface AssetVaultParams {
  name: string
  duration: number
  capitalFormationPeriod: number
  minimumSize: number
}

const defaultFixtureConfig: FixtureConfig = {
  tokenDecimals: 6,
  targetApys: [0, 500, 300],
}

export const getAssetVaultFactoryFixture = (fixtureConfig?: Partial<FixtureConfig>) => {
  return async (wallets: Wallet[]) => {
    const [wallet] = wallets
    const { tokenDecimals, targetApys } = { ...defaultFixtureConfig, ...fixtureConfig }

    const { token, parseTokenUnits } = await deployToken(wallets, tokenDecimals)
    const { protocolConfig, protocolConfigParams } = await deployProtocolConfig(wallets)
    const { assetVaultFactory, whitelistedManagerRole } = await deployAssetVaultFactory(wallet, protocolConfig)
    const { depositController, withdrawController, transferController } = await deployControllers(wallet)
    const lenderVerifier = await new MockLenderVerifier__factory(wallet).deploy()

    const tranchesInitData = getTranchesInitData(wallet, {
      depositController,
      withdrawController,
      transferController,
      lenderVerifier,
      tokenDecimals,
      targetApys,
    })

    const assetVaultDuration = 2 * YEAR

    const assetVaultParams: AssetVaultParams = {
      name: 'AssetVault',
      duration: assetVaultDuration,
      capitalFormationPeriod: 90 * DAY,
      minimumSize: 0,
    }

    const expectedEquityRate = { from: 200, to: 2000 }

    async function createAssetVault(
      params: Partial<{
        token: Wallet | Contract
        assetVaultParams: AssetVaultParams
        tranchesInitData: TrancheInitData[]
        expectedEquityRate: { from: number; to: number }
        onlyAllowedBorrowers: boolean
      }> = {}
    ) {
      const args = {
        token,
        assetVaultParams,
        tranchesInitData,
        expectedEquityRate,
        onlyAllowedBorrowers: false,
        ...params,
      }
      const createAssetVaultTx = await assetVaultFactory.createAssetVault(
        args.token.address,
        args.assetVaultParams,
        args.tranchesInitData,
        args.expectedEquityRate,
        args.onlyAllowedBorrowers
      )
      const assetVault = await getAssetVaultFromTx(createAssetVaultTx)

      return { assetVault, createAssetVaultTx }
    }

    async function createAssetVaultAndSetupControllers(...args: Parameters<typeof createAssetVault>) {
      const { assetVault, createAssetVaultTx } = await createAssetVault(...args)
      const tranches = await getTranchesFromTx(createAssetVaultTx)
      const controllers: { depositController: DepositController; withdrawController: WithdrawController }[] = []
      for (let i = 0; i < tranches.length; i++) {
        const depositControllerAddress = await tranches[i].depositController()
        const withdrawControllerAddress = await tranches[i].withdrawController()
        const depositController = DepositController__factory.connect(depositControllerAddress, wallet)
        const withdrawController = WithdrawController__factory.connect(withdrawControllerAddress, wallet)
        controllers.push({ depositController, withdrawController })
      }
      return { assetVault, tranches, createAssetVaultTx, controllers }
    }

    const { createAssetVaultTx } = await createAssetVault()

    const { timestamp: now } = await wallet.provider.getBlock('latest')
    const maxCapitalFormationDuration = 90 * DAY
    const startDeadline = now + maxCapitalFormationDuration

    const tranches = await getTranchesFromTx(createAssetVaultTx)

    const sizes = [
      { floor: constants.Zero, ceiling: parseTokenUnits(5e9) },
      { floor: constants.Zero, ceiling: parseTokenUnits(5e9) },
      { floor: constants.Zero, ceiling: parseTokenUnits(1e10) },
    ]

    const tranchesData: TrancheData[] = []
    for (let i = 0; i < tranches.length; i++) {
      const depositControllerAddress = await tranches[i].depositController()
      const withdrawControllerAddress = await tranches[i].withdrawController()
      const depositController = DepositController__factory.connect(depositControllerAddress, wallet)
      const withdrawController = WithdrawController__factory.connect(withdrawControllerAddress, wallet)
      tranchesData.push({
        ...tranchesInitData[i],
        depositController,
        withdrawController,
      })

      await depositController.setCeiling(sizes[i].ceiling)
      await withdrawController.setFloor(sizes[i].floor)
    }

    async function depositToTranche(tranche: TrancheVaultTest, amount: BigNumberish, receiver = wallet.address) {
      await token.approve(tranche.address, amount)
      return tranche.deposit(amount, receiver)
    }

    async function mintToTranche(tranche: TrancheVaultTest, shares: BigNumberish, receiver = wallet.address) {
      await token.approve(tranche.address, constants.MaxUint256)
      return tranche.mint(shares, receiver)
    }

    async function getAssetVaultFromTx(tx: ContractTransaction = createAssetVaultTx) {
      const assetVaultAddress: string = await extractEventArgFromTx(tx, [
        assetVaultFactory.address,
        'AssetVaultCreated',
        'newAssetVault',
      ])
      return new StructuredAssetVaultTest__factory(wallet).attach(assetVaultAddress)
    }

    async function getTranchesFromTx(tx: ContractTransaction = createAssetVaultTx) {
      const tranchesAddresses: string[] = await extractEventArgFromTx(tx, [
        assetVaultFactory.address,
        'AssetVaultCreated',
        'tranches',
      ])
      const tranches = tranchesAddresses.map((address) => new TrancheVaultTest__factory(wallet).attach(address))
      return tranches
    }

    return {
      assetVaultFactory,
      tranchesData,
      tranches,
      token,
      assetVaultDuration,
      assetVaultParams,
      createAssetVaultTx,
      parseTokenUnits,
      depositToTranche,
      mintToTranche,
      getAssetVaultFromTx,
      getTranchesFromTx,
      startDeadline,
      maxCapitalFormationDuration,
      whitelistedManagerRole,
      protocolConfig,
      protocolConfigParams,
      expectedEquityRate,
      tranchesInitData,
      createAssetVault,
      createAssetVaultAndSetupControllers,
      lenderVerifier,
    }
  }
}

export const assetVaultFactoryFixture = getAssetVaultFactoryFixture()
