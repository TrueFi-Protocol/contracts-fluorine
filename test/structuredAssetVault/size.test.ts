import StructuredAssetVault from 'build/StructuredAssetVault.json'
import { expect } from 'chai'

const CONTRACT_SIZE = StructuredAssetVault.deployedBytecode.length / 2 - 1
const LIMIT = 24_576

describe(`StructuredAssetVault size (${CONTRACT_SIZE}B)`, () => {
  it(`fits max contract size: ${LIMIT}B`, () => {
    expect(CONTRACT_SIZE).to.be.lte(LIMIT)
  })
})
