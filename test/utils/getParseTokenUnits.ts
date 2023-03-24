import { utils } from 'ethers'

export function getParseTokenUnits(decimals: number) {
  return (amount: string | number) => utils.parseUnits(amount.toString(), decimals)
}
