# interfaces/IStructuredAssetVault API

## Status

<br />

```solidity
enum Status {
  CapitalFormation,
  Live,
  Closed
}
```
## DeficitCheckpoint

<br />

```solidity
struct DeficitCheckpoint {
  uint256 deficit;
  uint256 timestamp;
}
```
## TrancheData

<br />

```solidity
struct TrancheData {
  uint128 targetApy;
  uint128 minSubordinateRatio;
  uint256 distributedAssets;
  uint256 maxValueOnClose;
  struct DeficitCheckpoint deficitCheckpoint;
}
```
## TrancheInitData

<br />

```solidity
struct TrancheInitData {
  contract ITrancheVault tranche;
  uint128 targetApy;
  uint128 minSubordinateRatio;
}
```
## AssetVaultParams

<br />

```solidity
struct AssetVaultParams {
  string name;
  uint256 duration;
  uint256 capitalFormationPeriod;
  uint256 minimumSize;
}
```
## ExpectedEquityRate

<br />

```solidity
struct ExpectedEquityRate {
  uint256 from;
  uint256 to;
}
```
## IStructuredAssetVault

AssetVault consists of multiple tranches, each offering a different yield for the lender
based on the respective risk.

<br />

### AssetVaultInitialized

```solidity
event AssetVaultInitialized(contract ITrancheVault[] tranches)
```

Event emitted when assetVault is initialized

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| tranches | contract ITrancheVault[] | Array of tranches addresses |

<br />

### AssetVaultStatusChanged

```solidity
event AssetVaultStatusChanged(enum Status newStatus)
```

Event emitted when AssetVault status is changed

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| newStatus | enum Status | AssetVault status set |

<br />

### StateUpdated

```solidity
event StateUpdated(uint256 actionId, uint256 outstandingAssets, string assetReportId)
```

Event emitted on updateState function call

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| actionId | uint256 | Unique id among all action types (updateState, disburse, repay) |
| outstandingAssets | uint256 | New outstanding assets amount declared by SAV manager |
| assetReportId | string | IPFS CID under which asset report reflecting current SAV state is stored |

<br />

### Disburse

```solidity
event Disburse(uint256 actionId, address recipient, uint256 amount, uint256 outstandingAssets, string assetReportId)
```

Event emitted on disburse function call

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| actionId | uint256 | Unique id among all action types (updateState, disburse, repay) |
| recipient | address | Address to which funds are disbursed |
| amount | uint256 | Disbursed amount |
| outstandingAssets | uint256 | New outstanding assets amount declared by SAV manager |
| assetReportId | string | IPFS CID under which asset report reflecting current SAV state is stored |

<br />

### Repay

```solidity
event Repay(uint256 actionId, address caller, uint256 principalRepaid, uint256 interestRepaid, uint256 outstandingAssets, string assetReportId)
```

Event emitted on repay function call

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| actionId | uint256 | Unique id among all action types (updateState, disburse, repay) |
| caller | address | Address from which function was called |
| principalRepaid | uint256 | Principal part of outstanding assets declared to be repaid |
| interestRepaid | uint256 | Interest part of outstanding assets declared to be repaid |
| outstandingAssets | uint256 | New outstanding assets amount declared by SAV manager |
| assetReportId | string | IPFS CID under which asset report reflecting current SAV state is stored |

<br />

### CheckpointUpdated

```solidity
event CheckpointUpdated(uint256[] totalAssets, uint256[] protocolFeeRates)
```

Event emitted when tranches checkpoint is changed

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| totalAssets | uint256[] | New values of tranches |
| protocolFeeRates | uint256[] | New protocol fee rates for each tranche |

<br />

### MANAGER_ROLE

```solidity
function MANAGER_ROLE() external view returns (bytes32)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 | Access control role allowing access to contract management functions |

<br />

### REPAYER_ROLE

```solidity
function REPAYER_ROLE() external view returns (bytes32)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 | Access control role allowing to call repay function |

<br />

### BORROWER_ROLE

```solidity
function BORROWER_ROLE() external view returns (bytes32)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 | Access control role allowing to disburse money to address with it |

<br />

### name

```solidity
function name() external view returns (string)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | Name of the StructuredAssetVault |

<br />

### asset

```solidity
function asset() external view returns (contract IERC20WithDecimals)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IERC20WithDecimals | Address of asset which portfolio operates on |

<br />

### status

```solidity
function status() external view returns (enum Status)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | enum Status | Current AssetVault status |

<br />

### startDate

```solidity
function startDate() external view returns (uint256)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Timestamp of block in which StructuredAssetVault was switched to Live phase |

<br />

### endDate

```solidity
function endDate() external view returns (uint256)
```

Returns expected end date or actual end date if AssetVault was closed prematurely.

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The date by which the manager is supposed to close the AssetVault. |

<br />

### startDeadline

```solidity
function startDeadline() external view returns (uint256)
```

Timestamp after which anyone can close the AssetVault if it's in capital formation.

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The date by which the manager is supposed to launch the AssetVault. |

<br />

### minimumSize

```solidity
function minimumSize() external view returns (uint256)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Minimum sum of all tranches assets required to be met to switch StructuredAssetVault to Live phase |

<br />

### start

```solidity
function start() external
```

Launches the AssetVault making it possible to make disbursements.
@dev
- reverts if tranches ratios and AssetVault min size are not met,
- changes status to `Live`,
- sets `startDate` and `endDate`,
- transfers assets obtained in tranches to the AssetVault.

<br />

### close

```solidity
function close() external
```

Closes the AssetVault, making it possible to withdraw funds from tranche vaults.
@dev
- reverts if there are any active outstanding assets before the end date,
- changes status to `Closed`,
- calculates waterfall values for tranches and transfers the funds to the vaults,
- updates `endDate`.

<br />

### calculateWaterfall

```solidity
function calculateWaterfall() external view returns (uint256[])
```

Distributes AssetVault value among tranches respecting their target apys and fees.
Returns zeros for CapitalFormation and Closed AssetVault status.

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256[] | Array of current tranche values |

<br />

### calculateWaterfallWithoutFees

```solidity
function calculateWaterfallWithoutFees() external view returns (uint256[])
```

Distributes AssetVault value among tranches respecting their target apys, but not fees.
Returns zeros for CapitalFormation and Closed AssetVault status.

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256[] | Array of current tranche values (with pending fees not deducted) |

<br />

### calculateWaterfallForTranche

```solidity
function calculateWaterfallForTranche(uint256 trancheIndex) external view returns (uint256)
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| trancheIndex | uint256 | Index of tranche |

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Current value of tranche in Live status, 0 for other statuses |

<br />

### calculateWaterfallForTrancheWithoutFee

```solidity
function calculateWaterfallForTrancheWithoutFee(uint256 trancheIndex) external view returns (uint256)
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| trancheIndex | uint256 | Index of tranche |

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Current value of tranche (with pending fees not deducted) in Live status, 0 for other statuses |

<br />

### initialize

```solidity
function initialize(address manager, address[] allowedBorrowers, contract IERC20WithDecimals asset, contract IProtocolConfig protocolConfig, struct AssetVaultParams assetVaultParams, struct TrancheInitData[] tranchesInitData, struct ExpectedEquityRate expectedEquityRate) external
```

Setup contract with given params

Used by Initializable contract (can be called only once)

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address on which MANAGER_ROLE is granted |
| allowedBorrowers | address[] | List of addresses on which BORROWER_ROLE should be granted |
| asset | contract IERC20WithDecimals | Address of ERC20 token used by AssetVault |
| protocolConfig | contract IProtocolConfig | Address of ProtocolConfig contract |
| assetVaultParams | struct AssetVaultParams | Parameters to configure AssetVault |
| tranchesInitData | struct TrancheInitData[] | Parameters to configure tranches |
| expectedEquityRate | struct ExpectedEquityRate | APY range that is expected to be reached by Equity tranche |

<br />

### tranches

```solidity
function tranches(uint256 trancheIdx) external view returns (contract ITrancheVault tranche)
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| trancheIdx | uint256 | Index of tranche used for waterfall |

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| tranche | contract ITrancheVault | Address of tranche with given index |

<br />

### getTranches

```solidity
function getTranches() external view returns (contract ITrancheVault[] tranches)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| tranches | contract ITrancheVault[] | Array of AssetVault's tranches addresses |

<br />

### getTrancheData

```solidity
function getTrancheData(uint256 trancheIdx) external view returns (struct TrancheData trancheData)
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| trancheIdx | uint256 | Index of tranche used for waterfall |

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| trancheData | struct TrancheData | Struct of parameters describing tranche with given index |

<br />

### updateCheckpoints

```solidity
function updateCheckpoints() external
```

Updates checkpoints on each tranche and pay pending fees

Can be executed only in Live status

<br />

### totalAssets

```solidity
function totalAssets() external view returns (uint256)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Total value locked in the contract including yield from outstanding assets |

<br />

### liquidAssets

```solidity
function liquidAssets() external view returns (uint256)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Underlying token balance of AssetVault reduced by pending fees |

<br />

### totalPendingFees

```solidity
function totalPendingFees() external view returns (uint256)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Sum of all unsettled fees that tranches should pay |

<br />

### virtualTokenBalance

```solidity
function virtualTokenBalance() external view returns (uint256)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Asset balance of this contract |

<br />

### outstandingAssets

```solidity
function outstandingAssets() external view returns (uint256)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Amount of assets disbursed from vault including accrued yield |

<br />

### outstandingPrincipal

```solidity
function outstandingPrincipal() external view returns (uint256)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Amount of assets disbursed from vault |

<br />

### paidInterest

```solidity
function paidInterest() external view returns (uint256)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Sum of interest repaid to contract so far |

<br />

### latestAssetReportId

```solidity
function latestAssetReportId() external view returns (string)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | Last asset report id in asset report history |

<br />

### getAssetReportHistory

```solidity
function getAssetReportHistory() external view returns (string[])
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string[] | List of asset report ids in chronological order |

<br />

### increaseVirtualTokenBalance

```solidity
function increaseVirtualTokenBalance(uint256 delta) external
```

Increases virtual AssetVault value

Must be called by a tranche

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| delta | uint256 | Amount by which virtual token balance should be increased |

<br />

### decreaseVirtualTokenBalance

```solidity
function decreaseVirtualTokenBalance(uint256 delta) external
```

Decrease virtual AssetVault value

Must be called by a tranche

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| delta | uint256 | Amount by which virtual token balance should be decreased |

<br />

### checkTranchesRatios

```solidity
function checkTranchesRatios() external view
```

Reverts if minimum subordinate ratio on any tranche is broken

<br />

### checkTranchesRatiosFromTranche

```solidity
function checkTranchesRatiosFromTranche(uint256 newTotalAssets) external view
```

Reverts if tranche ratios are not met

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| newTotalAssets | uint256 | new total assets value of the tranche calling this function. Is ignored if not called by tranche |

<br />

### maxTrancheValueComplyingWithRatio

```solidity
function maxTrancheValueComplyingWithRatio(uint256 trancheIdx) external view returns (uint256 maxTrancheValue)
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| trancheIdx | uint256 | Index of tranche for which max value should be calculated |

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| maxTrancheValue | uint256 | Max tranche value that can be reached not to break minimum subordinate ratio of any tranche |

<br />

### minTrancheValueComplyingWithRatio

```solidity
function minTrancheValueComplyingWithRatio(uint256 trancheIdx) external view returns (uint256)
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| trancheIdx | uint256 | Index of tranche for which min value should be calculated |

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | minTrancheValue Min tranche value that can be reached not to break minimum subordinate ratio of any tranche |

<br />

### updateState

```solidity
function updateState(uint256 newOutstandingAssets, string assetReportId) external
```

@notice
- can be called only by address with MANAGER_ROLE granted
- reverts in Capital Formation

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| newOutstandingAssets | uint256 | Amount of outstanding assets declared by the manager |
| assetReportId | string | IPFS CID under which asset report reflecting current SAV state is stored |

<br />

### disburse

```solidity
function disburse(address recipient, uint256 amount, uint256 newOutstandingAssets, string assetReportId) external
```

@notice
- can be called only by address with MANAGER_ROLE granted
- reverts in Capital Formation and Closed
- when onlyAllowedBorrower is set reverts if recipient does not have BORROWER_ROLE

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | Address to which funds are disbursed |
| amount | uint256 | Disbursed amount |
| newOutstandingAssets | uint256 | New outstanding assets amount declared by SAV manager |
| assetReportId | string | IPFS CID under which asset report reflecting current SAV state is stored |

<br />

### repay

```solidity
function repay(uint256 principalRepaid, uint256 interestRepaid, uint256 newOutstandingAssets, string assetReportId) external
```

@notice
- can be called only by address with REPAYER_ROLE granted
- reverts in Capital Formation

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| principalRepaid | uint256 | Principal part of outstanding assets declared to be repaid |
| interestRepaid | uint256 | Interest part of outstanding assets declared to be repaid |
| newOutstandingAssets | uint256 | New outstanding assets amount declared by SAV manager |
| assetReportId | string | IPFS CID under which asset report reflecting current SAV state is stored |

<br />

