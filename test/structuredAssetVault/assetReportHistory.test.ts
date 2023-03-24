import { expect } from 'chai'
import { assetVaultLiveFixture } from 'fixtures/assetVaultFixture'
import { setupFixtureLoader } from 'test/setup'

describe('StructuredAssetVault.getAssetReportHistory', () => {
  const loadFixture = setupFixtureLoader()

  it('returns empty array for no reports', async () => {
    const { assetVault } = await loadFixture(assetVaultLiveFixture)
    expect(await assetVault.getAssetReportHistory()).to.deep.eq([])
  })

  it('returns asset report ids array if reports exist', async () => {
    const { assetVault, updateState } = await loadFixture(assetVaultLiveFixture)
    const newAssetReportIds = ['totallyPossibleAssetReportId0', 'totallyPossibleAssetReportId1']
    await updateState(1234, { newAssetReportId: newAssetReportIds[0] })
    await updateState(1234, { newAssetReportId: newAssetReportIds[1] })
    expect(await assetVault.getAssetReportHistory()).to.deep.eq(newAssetReportIds)
  })
})
