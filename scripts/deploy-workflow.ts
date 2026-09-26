// Deploy the workflow definition (same as `npx sanity-workflows deploy` with sanity.workflow.ts).
import {engine} from '../lib/engine.ts'
import {permissionSlip} from '../workflows/permission-slip.ts'

console.log(JSON.stringify(await engine.deployDefinitions({expectedMinReaderModel: 10, definitions: [permissionSlip]})))
