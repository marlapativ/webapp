import database from '../../src/config/database'
import { createDefaultUsers } from './user-utils'

export async function mochaGlobalSetup() {
  try {
    await database.getDatabaseConnection().sync()
    await createDefaultUsers()
  } catch {}
}
