import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {workflowDefaultDocumentNode, workflowStudioPlugin} from '@sanity/workflow-studio-plugin'
import {schemaTypes} from './sanity/schema.tsx'

export const TAG = 'prod'

export default defineConfig({
  name: 'default',
  title: 'Permission Slip',
  projectId: '1l1i5rda',
  dataset: 'production',
  plugins: [
    structureTool({defaultDocumentNode: workflowDefaultDocumentNode()}),
    workflowStudioPlugin({tag: TAG, mappings: [{docType: 'slip', definition: 'permission-slip', label: 'Permission slip'}]}),
  ],
  schema: {types: schemaTypes},
})
