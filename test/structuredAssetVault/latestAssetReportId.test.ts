import { expect } from 'chai'
import { assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'

describe('StructuredAssetVault.latestAssetReportId', () => {
  const loadFixture = setupFixtureLoader()

  it('returns last asset report id', async () => {
    const { assetVault, updateState } = await loadFixture(assetVaultLiveFixture)
    const newAssetReportIds = ['totallyPossibleAssetReportId', 'somethingElse']

    await updateState(1234, { newAssetReportId: newAssetReportIds[0] })
    expect(await assetVault.latestAssetReportId()).to.eq(newAssetReportIds[0])

    await updateState(1234, { newAssetReportId: newAssetReportIds[1] })
    expect(await assetVault.latestAssetReportId()).to.eq(newAssetReportIds[1])
  })

  it('returns empty string if there were no reports', async () => {
    const { assetVault } = await loadFixture(assetVaultLiveFixture)
    expect(await assetVault.latestAssetReportId()).to.be.eq('')
  })
})
