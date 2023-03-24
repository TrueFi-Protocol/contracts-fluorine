import { MockToken, StructuredAssetVault } from 'build/types'
import { BigNumber, BigNumberish, Wallet } from 'ethers'

interface ActionOptions {
  sender?: Wallet
  newAssetReportId?: string
}

interface DisburseOptions extends ActionOptions {
  recipient?: Wallet
  interest?: BigNumberish
}

interface RepayOptions extends ActionOptions {
  outstandingAssets?: BigNumberish
}

export function assetVaultUtils(wallet: Wallet, assetVault: StructuredAssetVault, token: MockToken) {
  const assetReportId = 'QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR'

  function updateState(
    outstandingAssets: BigNumberish,
    { sender = wallet, newAssetReportId = assetReportId }: ActionOptions = {}
  ) {
    return assetVault.connect(sender).updateState(outstandingAssets, newAssetReportId)
  }

  async function disburse(
    amount: BigNumberish,
    { interest = 0, sender = wallet, recipient = wallet, newAssetReportId = assetReportId }: DisburseOptions = {}
  ) {
    const newOutstandingAssets = (await assetVault.outstandingAssets()).add(amount).add(interest)
    return assetVault.connect(sender).disburse(recipient.address, amount, newOutstandingAssets, newAssetReportId)
  }

  async function repay(
    principal: BigNumberish,
    interest: BigNumberish,
    { outstandingAssets, sender = wallet, newAssetReportId = assetReportId }: RepayOptions = {}
  ) {
    const amount = BigNumber.from(principal).add(interest)
    outstandingAssets ??= (await assetVault.outstandingAssets()).sub(amount)

    await token.connect(sender).approve(assetVault.address, amount)
    return assetVault.connect(sender).repay(principal, interest, outstandingAssets, newAssetReportId)
  }

  async function loseAssets(amount: BigNumberish) {
    const currentOutstandingAssets = await assetVault.outstandingAssets()
    return updateState(currentOutstandingAssets.sub(amount))
  }

  return { disburse, repay, updateState, assetReportId, loseAssets }
}
