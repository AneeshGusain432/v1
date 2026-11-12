
import { Template, defaultBuildLogger } from 'e2b'
import { template as nextJSTemplate } from '@/sandbox-templates/nextjs/template'
import dotenv from 'dotenv'
dotenv.config()


Template.build(nextJSTemplate, "v1-build", {
    cpuCount: 4,
    memoryMB: 4096,
    onBuildLogs: defaultBuildLogger(),
    apiKey: process.env.E2B_API_KEY
})