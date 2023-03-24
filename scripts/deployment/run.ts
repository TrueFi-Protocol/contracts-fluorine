import { deploy } from 'ethereum-mars'
import { deployFluorine } from './deployFluorine'

deploy({ verify: true }, deployFluorine)
