import { DepositController, WithdrawController } from 'build/types'
import { BigNumber, BytesLike } from 'ethers'

export interface FixtureConfig {
  tokenDecimals: number
  targetApys: number[]
}

export interface TrancheInitData {
  name: string
  symbol: string
  depositControllerImplementation: string
  depositControllerInitData: BytesLike
  withdrawControllerImplementation: string
  withdrawControllerInitData: BytesLike
  transferControllerImplementation: string
  transferControllerInitData: BytesLike
  targetApy: number
  minSubordinateRatio: number
  managerFeeRate: number
}

export interface TrancheData extends TrancheInitData {
  depositController: DepositController
  withdrawController: WithdrawController
}

export interface FixtureTrancheData extends TrancheData {
  trancheIdx: number
  getCurrentDeficit: () => Promise<BigNumber>
}
