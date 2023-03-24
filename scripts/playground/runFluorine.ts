import { defaultAccounts } from 'ethereum-waffle'
import { Web3Provider } from '@ethersproject/providers'
import { deployFluorinePlayground } from './deploy'

export async function runFluorine(provider: Web3Provider, deploymentsFile: string) {
  const { secretKey } = defaultAccounts[0]
  await deployFluorinePlayground(secretKey, provider, deploymentsFile)
  console.log('\n' + 'Fluorine deployment DONE 🌟')
}
