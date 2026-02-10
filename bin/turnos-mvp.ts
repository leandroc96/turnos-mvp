#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { TurnosMvpStack, AppointmentsStack } from "../lib/turnos-mvp-stack";
import { getEnvironmentConfig } from "../config/environment";

const app = new cdk.App();

// Lee la configuración del ambiente desde config/environment.ts
const envConfig = getEnvironmentConfig();

const envProps = {
  env: {
    account: envConfig.account || undefined, // undefined permite que CDK lo detecte automáticamente
    region: envConfig.region,
  },
};

// Stack de obras sociales y tarifas
new TurnosMvpStack(app, "TurnosMvpStack", envProps);

// Stack de turnos, doctores y estudios
new AppointmentsStack(app, "AppointmentsStack", envProps);
