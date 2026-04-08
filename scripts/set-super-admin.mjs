import { readFile } from 'node:fs/promises'
import process from 'node:process'
import admin from 'firebase-admin'

function printUsage() {
  console.log(`
Usage:
  node scripts/set-super-admin.mjs <email>
  node scripts/set-super-admin.mjs --remove <email>

Required env:
  FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json

Optional env:
  SUPER_ADMIN_CLAIM_KEY=platformRole
  SUPER_ADMIN_CLAIM_VALUE=super_admin
`.trim())
}

const args = process.argv.slice(2)
const shouldRemove = args.includes('--remove')
const email = args.find((arg) => !arg.startsWith('--'))
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
const claimKey = process.env.SUPER_ADMIN_CLAIM_KEY ?? 'platformRole'
const claimValue = process.env.SUPER_ADMIN_CLAIM_VALUE ?? 'super_admin'

if (!serviceAccountPath || !email) {
  printUsage()
  process.exit(1)
}

const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const user = await admin.auth().getUserByEmail(email)
const nextClaims = { ...(user.customClaims ?? {}) }

if (shouldRemove) {
  delete nextClaims[claimKey]
} else {
  nextClaims[claimKey] = claimValue
}

await admin.auth().setCustomUserClaims(user.uid, nextClaims)

console.log(
  JSON.stringify({
    email,
    uid: user.uid,
    action: shouldRemove ? 'removed' : 'set',
    claimKey,
    claimValue: shouldRemove ? null : claimValue,
    customClaims: nextClaims,
  }, null, 2),
)
