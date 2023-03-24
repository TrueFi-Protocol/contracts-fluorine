import { BigNumber } from 'ethers'
import { ONE_IN_BPS } from './constants'

export function percentOf(value: BigNumber, bps: number) {
  return value.mul(bps).div(ONE_IN_BPS)
}
