import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config.js';

/** OTA F4: the server tests that parse client schemas, recording each payload (tools/n1-contract.mjs). The base config's strict lists come along. */
export default mergeConfig(base, defineConfig({ test: { setupFiles: ['test/n1/record.setup.ts'] } }));
