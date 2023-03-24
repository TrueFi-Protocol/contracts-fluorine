import { BigNumber, BigNumberish } from 'ethers'
import { ONE_IN_BPS, YEAR } from './constants'

export function withInterest(initialAmount: BigNumberish, apy: number, period: number) {
  const periodInterest = getInterest(initialAmount, apy, period)
  return periodInterest.add(initialAmount)
}

export function getInterest(initialAmount: BigNumberish, apy: number, period: number) {
  const initialAmountBN = BigNumber.from(initialAmount)
  const yearlyInterest = initialAmountBN.mul(apy).div(ONE_IN_BPS)
  return yearlyInterest.mul(period).div(YEAR)
}
