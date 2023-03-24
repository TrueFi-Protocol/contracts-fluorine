import { MockToken__factory } from 'build/types'
import { Wallet } from 'ethers'
import { getParseTokenUnits } from 'utils/getParseTokenUnits'

export async function deployToken([wallet, other]: Wallet[], tokenDecimals: number) {
  const parseTokenUnits = getParseTokenUnits(tokenDecimals)
  const token = await new MockToken__factory(wallet).deploy(tokenDecimals)
  await token.mint(wallet.address, parseTokenUnits(1e12))
  await token.mint(other.address, parseTokenUnits(1e10))

  return { token, parseTokenUnits }
}
