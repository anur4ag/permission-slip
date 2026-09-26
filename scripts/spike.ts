import {createClient} from '@sanity/client'
import {createEngine, ENGINE_API_VERSION, refDataset} from '@sanity/workflow-engine'
import {permissionSlip} from '../workflows/permission-slip.ts'

const client = createClient({projectId: '1l1i5rda', dataset: 'production', apiVersion: ENGINE_API_VERSION, token: process.env.PS_SANITY_DEV_TOKEN, useCdn: false})
const engine = createEngine({client, workflowResource: {type: 'dataset', id: '1l1i5rda.production'}, tag: 'spike'})

await client.createOrReplace({_id: 'slip-spike-1', _type: 'slip', title: 'Post a haiku to the field trip wall'})
console.log('deploy', JSON.stringify(await engine.deployDefinitions({expectedMinReaderModel: 10, definitions: [permissionSlip]})).slice(0, 200))
const {instance} = await engine.startInstance({definition: 'permission-slip', initialFields: [{type: 'subject', name: 'subject', value: refDataset({projectId: '1l1i5rda', dataset: 'production', documentId: 'slip-spike-1', type: 'slip'})}]})
const id = instance._id
const stage = async () => (await engine.getInstance({instanceId: id})).currentStage ?? JSON.stringify(Object.keys(await engine.getInstance({instanceId: id}))).slice(0, 200)
console.log('started', id, await stage())
await engine.fireAction({instanceId: id, activity: 'hall-monitor', action: 'pass'}); console.log('after pass:', await stage())
await engine.fireAction({instanceId: id, activity: 'guardian', action: 'sign'}); console.log('after sign:', await stage())
await engine.fireAction({instanceId: id, activity: 'field-trip', action: 'report', params: {outcome: 'posted'}}); console.log('after report:', await stage())
