
import { Template, defaultBuildLogger } from 'e2b'
import { template as nextJSTemplate } from '@/sandbox-templates/nextjs/template'
import dotenv from 'dotenv'
dotenv.config()


Template.build(nextJSTemplate, "v1-build", {
    cpuCount: 4,
    memoryMB: 4096,
    onBuildLogs: defaultBuildLogger(),
    apiKey: "e2b_ec5b5fda0f7bf73c14b9daa6f46dad917e1ea8b9"
})