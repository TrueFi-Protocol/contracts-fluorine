import { assetVaultFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'
import { expect } from 'chai'
import { MockToken__factory, StructuredAssetVault__factory } from 'build/types'
import { assetVaultFactoryFixture } from 'fixtures/assetVaultFactoryFixture'
import { deployBehindProxy } from 'utils/deployBehindProxy'
import { deployMockContract, MockContract } from 'ethereum-waffle'
import TrancheVaultJson from 'build/TrancheVault.json'
import { getTxTimestamp } from 'utils/timestamp'

const TRANCHES_COUNT = 3

describe('StructuredAssetVault.initialize', () => {
  const loadFixture = setupFixtureLoader()

  it('grants manager role to sender', async () => {
    const { assetVault, wallet } = await loadFixture(assetVaultFixture)
    const managerRole = await assetVault.MANAGER_ROLE()
    expect(await assetVault.hasRole(managerRole, wallet.address)).to.be.true
  })

  it('sets name', async () => {
    const {
      assetVault,
      assetVaultParams: { name },
    } = await loadFixture(assetVaultFixture)
    expect(await assetVault.name()).to.eq(name)
  })

  it('sets start deadline', async () => {
    const {
      assetVault,
      createAssetVaultTx,
      assetVaultParams: { capitalFormationPeriod },
    } = await loadFixture(assetVaultFixture)
    const createAssetVaultTimestamp = await getTxTimestamp(createAssetVaultTx)
    expect(await assetVault.startDeadline()).to.eq(createAssetVaultTimestamp + capitalFormationPeriod)
  })

  it('sets default status', async () => {
    const { assetVault, AssetVaultStatus } = await loadFixture(assetVaultFixture)
    expect(await assetVault.status()).to.eq(AssetVaultStatus.CapitalFormation)
  })

  it('sets protocol config', async () => {
    const { assetVault, protocolConfig } = await loadFixture(assetVaultFixture)
    expect(await assetVault.protocolConfig()).to.eq(protocolConfig.address)
  })

  it('sets startDeadline', async () => {
    const { assetVault, startDeadline } = await loadFixture(assetVaultFixture)
    expect(await assetVault.startDeadline()).to.eq(startDeadline)
  })

  it('grants manager role to sender', async () => {
    const { assetVault, wallet } = await loadFixture(assetVaultFixture)
    const managerRole = await assetVault.MANAGER_ROLE()
    expect(await assetVault.hasRole(managerRole, wallet.address)).to.be.true
  })

  it('sets tranches target apys', async () => {
    const { assetVault, tranchesData } = await loadFixture(assetVaultFixture)
    const expectedTargetApys = tranchesData.map(({ targetApy }) => targetApy)
    for (let trancheIdx = 0; trancheIdx < 3; trancheIdx++) {
      expect((await assetVault.tranchesData(trancheIdx)).targetApy).to.eq(expectedTargetApys[trancheIdx])
    }
  })

  it('sets tranches min subordinate ratios', async () => {
    const { assetVault, tranchesData } = await loadFixture(assetVaultFixture)
    const expectedRatios = tranchesData.map(({ minSubordinateRatio }) => minSubordinateRatio)
    for (let trancheIdx = 0; trancheIdx < 3; trancheIdx++) {
      expect((await assetVault.tranchesData(trancheIdx)).minSubordinateRatio).to.eq(expectedRatios[trancheIdx])
    }
  })

  it('duration cannot be zero', async () => {
    const { createAssetVault, assetVaultParams } = await loadFixture(assetVaultFactoryFixture)
    await expect(createAssetVault({ assetVaultParams: { ...assetVaultParams, duration: 0 } })).to.be.revertedWith(
      'SAV: Duration cannot be zero'
    )
  })

  it('reverts for non-zero equity target apy', async () => {
    const { createAssetVault, tranchesData } = await loadFixture(assetVaultFactoryFixture)
    const [equityTranche, ...otherTranches] = tranchesData
    const invalidTranchesData = [{ ...equityTranche, targetApy: 100 }, ...otherTranches]
    await expect(createAssetVault({ tranchesInitData: invalidTranchesData })).to.be.revertedWith(
      'SAV: Target APY in tranche 0'
    )
  })

  it('reverts for non-zero equity min subordinate ratio', async () => {
    const { createAssetVault, tranchesData } = await loadFixture(assetVaultFactoryFixture)
    const [equityTranche, ...otherTranches] = tranchesData
    const invalidTranchesData = [{ ...equityTranche, minSubordinateRatio: 10 }, ...otherTranches]
    await expect(createAssetVault({ tranchesInitData: invalidTranchesData })).to.be.revertedWith(
      'SAV: Min sub ratio in tranche 0'
    )
  })

  it('sets min and max value for equity tranche', async () => {
    const { assetVault, expectedEquityRate } = await loadFixture(assetVaultFixture)
    expect((await assetVault.expectedEquityRate()).from).to.eq(expectedEquityRate.from)
    expect((await assetVault.expectedEquityRate()).to).to.eq(expectedEquityRate.to)
  })

  describe('token and tranche decimals mismatch', () => {
    for (let trancheIdx = 0; trancheIdx < TRANCHES_COUNT; trancheIdx++) {
      it(`tranche: ${trancheIdx}`, async () => {
        const { wallet, tranchesData, assetVaultParams, protocolConfig } = await loadFixture(assetVaultFactoryFixture)

        const decimals = 8
        const invalidDecimals = 6
        const tranches: MockContract[] = []
        for (let i = 0; i < tranchesData.length; i++) {
          const tranche = await deployMockContract(wallet, TrancheVaultJson.abi)
          await tranche.mock.decimals.returns(i === trancheIdx ? invalidDecimals : decimals)
          await tranche.mock.setPortfolio.returns()
          tranches.push(tranche)
        }

        const tranchesInitData = []
        for (let i = 0; i < tranchesData.length; i++) {
          tranchesInitData.push({ ...tranchesData[i], tranche: tranches[i].address })
        }

        const assetVaultToken = await new MockToken__factory(wallet).deploy(decimals)

        await expect(
          deployBehindProxy(
            new StructuredAssetVault__factory(wallet),
            wallet.address,
            [],
            assetVaultToken.address,
            protocolConfig.address,
            assetVaultParams,
            tranchesInitData,
            { from: 0, to: 1 }
          )
        ).to.be.revertedWith('SAV: Decimals mismatched')
      })
    }
  })

  it('grants default admin role to protocol admin', async () => {
    const { createAssetVault, protocolConfig, other } = await loadFixture(assetVaultFactoryFixture)
    await protocolConfig.setProtocolAdmin(other.address)
    const { assetVault } = await createAssetVault()
    expect(await assetVault.hasRole(await assetVault.DEFAULT_ADMIN_ROLE(), other.address)).to.be.true
  })

  it('grants repayer role to manager', async () => {
    const { createAssetVault, wallet } = await loadFixture(assetVaultFactoryFixture)
    const { assetVault } = await createAssetVault()
    const repayerRole = await assetVault.REPAYER_ROLE()
    expect(await assetVault.hasRole(repayerRole, wallet.address)).to.be.true
  })

  it('sets repayer admin role to manager role', async () => {
    const { createAssetVault } = await loadFixture(assetVaultFactoryFixture)
    const { assetVault } = await createAssetVault()
    const repayerRole = await assetVault.REPAYER_ROLE()
    const managerRole = await assetVault.MANAGER_ROLE()
    expect(await assetVault.getRoleAdmin(repayerRole)).to.eq(managerRole)
  })

  it('grants borrower role to given addresses when onlyAllowedBorrowers set', async () => {
    const {
      wallet,
      other,
      createAssetVault,
      assetVaultFactory,
      protocolConfigParams: { protocolAdmin },
    } = await loadFixture(assetVaultFactoryFixture)
    await assetVaultFactory.connect(protocolAdmin).setAllowedBorrower(wallet.address, wallet.address, true)
    await assetVaultFactory.connect(protocolAdmin).setAllowedBorrower(wallet.address, other.address, true)

    const { assetVault } = await createAssetVault({ onlyAllowedBorrowers: true })

    const borrowerRole = await assetVault.BORROWER_ROLE()
    expect(await assetVault.hasRole(borrowerRole, wallet.address)).to.be.true
    expect(await assetVault.hasRole(borrowerRole, other.address)).to.be.true
  })

  it('does not grant borrower role to given addresses when onlyAllowedBorrowers is unset', async () => {
    const {
      wallet,
      other,
      createAssetVault,
      assetVaultFactory,
      protocolConfigParams: { protocolAdmin },
    } = await loadFixture(assetVaultFactoryFixture)
    await assetVaultFactory.connect(protocolAdmin).setAllowedBorrower(wallet.address, wallet.address, true)
    await assetVaultFactory.connect(protocolAdmin).setAllowedBorrower(wallet.address, other.address, true)

    const { assetVault } = await createAssetVault({ onlyAllowedBorrowers: false })

    const borrowerRole = await assetVault.BORROWER_ROLE()
    expect(await assetVault.hasRole(borrowerRole, wallet.address)).to.be.false
    expect(await assetVault.hasRole(borrowerRole, other.address)).to.be.false
  })

  describe('sets onlyAllowedBorrowers flag', () => {
    it('true', async () => {
      const { createAssetVault } = await loadFixture(assetVaultFactoryFixture)
      const { assetVault } = await createAssetVault({ onlyAllowedBorrowers: true })
      expect(await assetVault.onlyAllowedBorrowers()).to.be.true
    })

    it('false', async () => {
      const { createAssetVault } = await loadFixture(assetVaultFactoryFixture)
      const { assetVault } = await createAssetVault({ onlyAllowedBorrowers: false })
      expect(await assetVault.onlyAllowedBorrowers()).to.be.false
    })
  })
})
