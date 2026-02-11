#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { TurnosMvpStack } from "../lib/turnos-mvp-stack";
import { getEnvironmentConfig } from "../config/environment";

const app = new cdk.App();

const envConfig = getEnvironmentConfig();

new TurnosMvpStack(app, "TurnosMvpStack", {
  env: {
    account: envConfig.account || undefined,
    region: envConfig.region,
  },
});
