import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';

import { businessAnalysisWorkflow } from './workflows/main-workflow';

// Agents
import { cboAgent } from './agents/CBO-agent';
import { financialExpertAgent } from './agents/financial-expert-agent';
import { digitalExpertAgent } from './agents/digital-expert-agent';
import { marketExpertAgent } from './agents/market-expert-agent';

// Specialized tools/agents
import { semanticAnalysisAgent } from './agents/semantic-analysis';
import { socialEngagementAuditor } from './agents/social-engagement-auditor';

export const mastra = new Mastra({
  workflows: { businessAnalysisWorkflow },
  agents: {
    cboAgent,
    financialExpertAgent,
    digitalExpertAgent,
    marketExpertAgent,
    semanticAnalysisAgent,
    socialEngagementAuditor,
  },
  storage: new LibSQLStore({
    id: "mastra-storage",
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
          new DefaultExporter(),
          new CloudExporter(),
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(),
        ],
      },
    },
  })
});
