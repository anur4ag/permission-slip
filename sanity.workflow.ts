import {defineWorkflowConfig} from '@sanity/workflow-engine/define'
import {permissionSlip} from './workflows/permission-slip.ts'

export default defineWorkflowConfig({
  deployments: [
    {
      name: 'production',
      tag: 'prod',
      expectedMinReaderModel: 10,
      workflowResource: {type: 'dataset', id: '1l1i5rda.production'},
      definitions: [permissionSlip],
    },
  ],
})
