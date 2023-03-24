import { DepositController, MockLenderVerifier, TransferController, WithdrawController } from 'build/types'
import { Wallet } from 'ethers'
import { getParseTokenUnits } from 'utils/getParseTokenUnits'
import { TrancheInitData } from './types'

interface Params {
  depositController: DepositController
  withdrawController: WithdrawController
  transferController: TransferController
  lenderVerifier: MockLenderVerifier
  tokenDecimals: number
  targetApys: number[]
}

export function getTranchesInitData(
  wallet: Wallet,
  { depositController, withdrawController, transferController, lenderVerifier, tokenDecimals, targetApys }: Params
): TrancheInitData[] {
  const parseTokenUnits = getParseTokenUnits(tokenDecimals)
  return [
    {
      name: 'Equity Tranche',
      symbol: 'EQT',
      depositControllerImplementation: depositController.address,
      depositControllerInitData: depositController.interface.encodeFunctionData('initialize', [
        wallet.address,
        lenderVerifier.address,
        0,
        parseTokenUnits(1e10),
      ]),
      withdrawControllerImplementation: withdrawController.address,
      withdrawControllerInitData: withdrawController.interface.encodeFunctionData('initialize', [wallet.address, 0, 1]),
      transferControllerImplementation: transferController.address,
      transferControllerInitData: transferController.interface.encodeFunctionData('initialize', [wallet.address]),
      targetApy: targetApys[0],
      minSubordinateRatio: 0,
      managerFeeRate: 0,
    },
    {
      name: 'Junior Tranche',
      symbol: 'JNT',
      depositControllerImplementation: depositController.address,
      depositControllerInitData: depositController.interface.encodeFunctionData('initialize', [
        wallet.address,
        lenderVerifier.address,
        0,
        parseTokenUnits(1e10),
      ]),
      withdrawControllerImplementation: withdrawController.address,
      withdrawControllerInitData: withdrawController.interface.encodeFunctionData('initialize', [wallet.address, 0, 1]),
      transferControllerImplementation: transferController.address,
      transferControllerInitData: transferController.interface.encodeFunctionData('initialize', [wallet.address]),
      targetApy: targetApys[1],
      minSubordinateRatio: 0,
      managerFeeRate: 0,
    },
    {
      name: 'Senior Tranche',
      symbol: 'SNT',
      depositControllerImplementation: depositController.address,
      depositControllerInitData: depositController.interface.encodeFunctionData('initialize', [
        wallet.address,
        lenderVerifier.address,
        0,
        parseTokenUnits(1e10),
      ]),
      withdrawControllerImplementation: withdrawController.address,
      withdrawControllerInitData: withdrawController.interface.encodeFunctionData('initialize', [wallet.address, 0, 1]),
      transferControllerImplementation: transferController.address,
      transferControllerInitData: transferController.interface.encodeFunctionData('initialize', [wallet.address]),
      targetApy: targetApys[2],
      minSubordinateRatio: 0,
      managerFeeRate: 0,
    },
  ]
}
