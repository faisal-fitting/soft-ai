
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { businessAnalysisWorkflow } from './workflows/main-workflow';
import { cboAgent } from './agents/CBO-agent';
import { cboSynthesisAgent } from './agents/cbo-synthesis-agent';
import { semanticAnalysisAgent } from './agents/sematic-analysis';
import { socialEngagementAuditor } from './agents/social-engagement-auditor';
import { orchestratorAgent } from './agents/orchestrator-agent';
export const mastra = new Mastra({
  workflows: { businessAnalysisWorkflow },
  agents: { cboAgent, cboSynthesisAgent, semanticAnalysisAgent, socialEngagementAuditor,orchestratorAgent },
  storage: new LibSQLStore({
    id: "mastra-storage",
    // stores observability, scores, ... into persistent file storage
    url: "libsql://cob-ai-faisal-a.aws-ap-south-1.turso.io",
    authToken: process.env.LIBSQL_AUTH_TOKEN || "",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new DefaultExporter(), // Persists traces to storage for Mastra Studio
          new CloudExporter(), // Sends traces to Mastra Cloud (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  })
})