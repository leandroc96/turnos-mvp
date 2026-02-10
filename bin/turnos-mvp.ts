#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AppointmentsStack } from "../lib/turnos-mvp-stack";
import { getEnvironmentConfig } from "../config/environment";

const app = new cdk.App();

// Lee la configuración del ambiente desde config/environment.ts
const envConfig = getEnvironmentConfig();

new AppointmentsStack(app, "AppointmentsStack", {
  env: {
    account: envConfig.account || undefined, // undefined permite que CDK lo detecte automáticamente
    region: envConfig.region,
  },
});
