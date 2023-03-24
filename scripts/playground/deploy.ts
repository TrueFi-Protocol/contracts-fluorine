import { deploy, Options } from 'ethereum-mars'
import { JsonRpcProvider } from '@ethersproject/providers'
import { deployFluorine } from '../deployment/deployFluorine'
import { deployPlayground } from './deployPlayground'

const getOptions = (privateKey: string, provider: JsonRpcProvider, deploymentsFile: string): Options => ({
  privateKey,
  network: provider,
  noConfirm: true,
  verify: false,
  disableCommandLineOptions: true,
  outputFile: deploymentsFile,
})

export function deployFluorinePlayground(privateKey: string, provider: JsonRpcProvider, deploymentsFile: string) {
  const options = getOptions(privateKey, provider, deploymentsFile)
  return deploy(options, (deployer, executeOptions) => deployPlayground(deployFluorine(deployer, executeOptions), deployer))
}
