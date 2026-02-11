import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export class TurnosMvpStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ═══════════════════════════════════════════════════════
    //  DYNAMODB TABLES
    // ═══════════════════════════════════════════════════════

    // ─── Tabla: Appointments ───
    const appointmentsTable = new dynamodb.Table(this, "AppointmentsTable", {
      tableName: "Appointments",
      partitionKey: { name: "appointmentId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expiresAt",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI para buscar turnos por status + startTime (usado por el reminder de WhatsApp)
    appointmentsTable.addGlobalSecondaryIndex({
      indexName: 'status-startTime-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'startTime', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ─── Tabla: Doctors ───
    const doctorsTable = new dynamodb.Table(this, "DoctorsTable", {
      tableName: "Doctors",
      partitionKey: { name: "doctorId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─── Tabla: Studies ───
    const studiesTable = new dynamodb.Table(this, 'StudiesTable', {
      tableName: 'TurnosMvp-Studies',
      partitionKey: { name: 'studyId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─── Tabla: ObrasSociales ───
    const obrasSocialesTable = new dynamodb.Table(this, 'ObrasSocialesTable', {
      tableName: 'TurnosMvp-ObrasSociales',
      partitionKey: { name: 'obraSocialId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─── Tabla: Tarifas ───
    const tarifasTable = new dynamodb.Table(this, 'TarifasTable', {
      tableName: 'TurnosMvp-Tarifas',
      partitionKey: { name: 'tarifaId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI para validar unicidad de estudioId + obraSocialId
    tarifasTable.addGlobalSecondaryIndex({
      indexName: 'estudioId-obraSocialId-index',
      partitionKey: { name: 'estudioId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'obraSocialId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ═══════════════════════════════════════════════════════
    //  LAMBDA FUNCTIONS – Appointments
    // ═══════════════════════════════════════════════════════

    const secretName = "google/calendar-service-account";

    // Lambda: Create Appointment
    const createAppointmentFn = new NodejsFunction(this, "CreateAppointmentFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/appointments/create/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      bundling: { forceDockerBundling: false },
      environment: {
        GOOGLE_SECRET_NAME: secretName,
        GOOGLE_CALENDAR_ID:
          process.env.GOOGLE_CALENDAR_ID ||
          "c_dbc5ed76ca1dd4e635ed63c55b8b9dcba68e4c9eb047af252e58577c744e4b66@group.calendar.google.com",
        GOOGLE_IMPERSONATE_USER: "administracion@quid-ar.com",
        APPOINTMENTS_TABLE_NAME: appointmentsTable.tableName,
      },
    });

    createAppointmentFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
        resources: ["*"],
      })
    );
    appointmentsTable.grantReadWriteData(createAppointmentFn);

    // Lambda: List Appointments
    const listAppointmentsFn = new NodejsFunction(this, "ListAppointmentsFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/appointments/list/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      bundling: { forceDockerBundling: false },
      environment: {
        APPOINTMENTS_TABLE_NAME: appointmentsTable.tableName,
      },
    });
    appointmentsTable.grantReadData(listAppointmentsFn);

    // Lambda: Delete Appointment
    const deleteAppointmentFn = new NodejsFunction(this, "DeleteAppointmentFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/appointments/delete/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      bundling: { forceDockerBundling: false },
      environment: {
        APPOINTMENTS_TABLE_NAME: appointmentsTable.tableName,
      },
    });
    appointmentsTable.grantReadWriteData(deleteAppointmentFn);

    // ═══════════════════════════════════════════════════════
    //  LAMBDA FUNCTIONS – Doctors
    // ═══════════════════════════════════════════════════════

    const listDoctorsFn = new NodejsFunction(this, "ListDoctorsFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/doctors/list/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      bundling: { forceDockerBundling: false },
      environment: {
        DOCTORS_TABLE_NAME: doctorsTable.tableName,
      },
    });
    doctorsTable.grantReadData(listDoctorsFn);

    const createDoctorFn = new NodejsFunction(this, "CreateDoctorFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/doctors/create/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      bundling: { forceDockerBundling: false },
      environment: {
        DOCTORS_TABLE_NAME: doctorsTable.tableName,
      },
    });
    doctorsTable.grantWriteData(createDoctorFn);

    const updateDoctorFn = new NodejsFunction(this, "UpdateDoctorFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/doctors/update/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      bundling: { forceDockerBundling: false },
      environment: {
        DOCTORS_TABLE_NAME: doctorsTable.tableName,
      },
    });
    doctorsTable.grantReadWriteData(updateDoctorFn);

    // Lambda: Delete Doctor
    const deleteDoctorFn = new NodejsFunction(this, "DeleteDoctorFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/doctors/delete/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      bundling: { forceDockerBundling: false },
      environment: {
        DOCTORS_TABLE_NAME: doctorsTable.tableName,
      },
    });
    doctorsTable.grantReadWriteData(deleteDoctorFn);

    // ═══════════════════════════════════════════════════════
    //  LAMBDA FUNCTIONS – Studies
    // ═══════════════════════════════════════════════════════

    const listStudiesFn = new NodejsFunction(this, "ListStudiesFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/studies/list/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      bundling: { forceDockerBundling: false },
      environment: {
        STUDIES_TABLE_NAME: studiesTable.tableName,
      },
    });
    studiesTable.grantReadData(listStudiesFn);

    const createStudyFn = new NodejsFunction(this, "CreateStudyFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/studies/create/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      bundling: { forceDockerBundling: false },
      environment: {
        STUDIES_TABLE_NAME: studiesTable.tableName,
      },
    });
    studiesTable.grantWriteData(createStudyFn);

    const updateStudyFn = new NodejsFunction(this, "UpdateStudyFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/studies/update/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      bundling: { forceDockerBundling: false },
      environment: {
        STUDIES_TABLE_NAME: studiesTable.tableName,
      },
    });
    studiesTable.grantReadWriteData(updateStudyFn);

    // Lambda: Delete Study
    const deleteStudyFn = new NodejsFunction(this, "DeleteStudyFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/studies/delete/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      bundling: { forceDockerBundling: false },
      environment: {
        STUDIES_TABLE_NAME: studiesTable.tableName,
      },
    });
    studiesTable.grantReadWriteData(deleteStudyFn);

    // ═══════════════════════════════════════════════════════
    //  LAMBDA FUNCTIONS – Obras Sociales & Tarifas
    // ═══════════════════════════════════════════════════════

    const obrasSocialesFn = new NodejsFunction(this, 'ObrasSocialesFn', {
      functionName: 'TurnosMvp-ObrasSociales',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '..', 'lambda', 'obras-sociales.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      bundling: { forceDockerBundling: false },
      environment: {
        TABLE_NAME: obrasSocialesTable.tableName,
      },
    });

    const tarifasFn = new NodejsFunction(this, 'TarifasFn', {
      functionName: 'TurnosMvp-Tarifas',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '..', 'lambda', 'tarifas.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      bundling: { forceDockerBundling: false },
      environment: {
        TABLE_NAME: tarifasTable.tableName,
        OBRAS_SOCIALES_TABLE: obrasSocialesTable.tableName,
        STUDIES_TABLE: studiesTable.tableName,
      },
    });

    obrasSocialesTable.grantReadWriteData(obrasSocialesFn);
    tarifasTable.grantReadWriteData(tarifasFn);
    obrasSocialesTable.grantReadData(tarifasFn);
    studiesTable.grantReadData(tarifasFn);

    // ═══════════════════════════════════════════════════════
    //  LAMBDA FUNCTIONS – WhatsApp Reminders
    // ═══════════════════════════════════════════════════════

    // Variables de configuración de WhatsApp (Meta Cloud API)
    const whatsappAccessToken = process.env.WHATSAPP_ACCESS_TOKEN || "PLACEHOLDER_SET_IN_SECRETS";
    const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "PLACEHOLDER_SET_IN_SECRETS";
    const whatsappVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "turnos-mvp-verify";
    const whatsappTemplateName = process.env.WHATSAPP_TEMPLATE_NAME || "appointment_reminder";

    // Lambda: Reminder Checker (ejecutada por EventBridge cada 30 min)
    const reminderCheckerFn = new NodejsFunction(this, "ReminderCheckerFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/appointments/reminder/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      bundling: { forceDockerBundling: false },
      environment: {
        APPOINTMENTS_TABLE_NAME: appointmentsTable.tableName,
        WHATSAPP_ACCESS_TOKEN: whatsappAccessToken,
        WHATSAPP_PHONE_NUMBER_ID: whatsappPhoneNumberId,
        WHATSAPP_TEMPLATE_NAME: whatsappTemplateName,
        WHATSAPP_TEMPLATE_LANG: "es_AR",
      },
    });
    appointmentsTable.grantReadWriteData(reminderCheckerFn);

    // EventBridge Rule: ejecutar ReminderChecker cada 30 minutos
    new events.Rule(this, "ReminderScheduleRule", {
      ruleName: "TurnosMvp-ReminderEvery30Min",
      schedule: events.Schedule.rate(cdk.Duration.minutes(30)),
      targets: [new targets.LambdaFunction(reminderCheckerFn)],
    });

    // Lambda: WhatsApp Webhook (recibe respuestas de pacientes)
    const whatsappWebhookFn = new NodejsFunction(this, "WhatsAppWebhookFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/appointments/whatsapp-webhook/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
      bundling: { forceDockerBundling: false },
      environment: {
        APPOINTMENTS_TABLE_NAME: appointmentsTable.tableName,
        WHATSAPP_ACCESS_TOKEN: whatsappAccessToken,
        WHATSAPP_PHONE_NUMBER_ID: whatsappPhoneNumberId,
        WHATSAPP_VERIFY_TOKEN: whatsappVerifyToken,
      },
    });
    appointmentsTable.grantReadWriteData(whatsappWebhookFn);

    // ═══════════════════════════════════════════════════════
    //  REST API GATEWAY (v1) – Todas las rutas
    // ═══════════════════════════════════════════════════════

    const restApi = new apigateway.RestApi(this, 'TurnosMvpApi', {
      restApiName: 'TurnosMvp API',
      description: 'API REST para turnos MVP',
      deployOptions: { stageName: 'v1' },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // /appointments
    const appointmentsResource = restApi.root.addResource('appointments');
    const appointmentIdResource = appointmentsResource.addResource('{appointmentId}');
    appointmentsResource.addMethod('GET', new apigateway.LambdaIntegration(listAppointmentsFn));
    appointmentsResource.addMethod('POST', new apigateway.LambdaIntegration(createAppointmentFn));
    appointmentIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteAppointmentFn));

    // /doctors
    const doctorsResource = restApi.root.addResource('doctors');
    const doctorIdResource = doctorsResource.addResource('{doctorId}');
    doctorsResource.addMethod('GET', new apigateway.LambdaIntegration(listDoctorsFn));
    doctorsResource.addMethod('POST', new apigateway.LambdaIntegration(createDoctorFn));
    doctorIdResource.addMethod('PUT', new apigateway.LambdaIntegration(updateDoctorFn));
    doctorIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteDoctorFn));

    // /studies
    const studiesResource = restApi.root.addResource('studies');
    const studyIdResource = studiesResource.addResource('{studyId}');
    studiesResource.addMethod('GET', new apigateway.LambdaIntegration(listStudiesFn));
    studiesResource.addMethod('POST', new apigateway.LambdaIntegration(createStudyFn));
    studyIdResource.addMethod('PUT', new apigateway.LambdaIntegration(updateStudyFn));
    studyIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteStudyFn));

    // /obras-sociales
    const obrasSocialesResource = restApi.root.addResource('obras-sociales');
    const obrasSocialesIdResource = obrasSocialesResource.addResource('{obraSocialId}');
    const obrasSocialesIntegration = new apigateway.LambdaIntegration(obrasSocialesFn);
    obrasSocialesResource.addMethod('GET', obrasSocialesIntegration);
    obrasSocialesResource.addMethod('POST', obrasSocialesIntegration);
    obrasSocialesIdResource.addMethod('PUT', obrasSocialesIntegration);
    obrasSocialesIdResource.addMethod('DELETE', obrasSocialesIntegration);

    // /tarifas
    const tarifasResource = restApi.root.addResource('tarifas');
    const tarifasIdResource = tarifasResource.addResource('{tarifaId}');
    const tarifasIntegration = new apigateway.LambdaIntegration(tarifasFn);
    tarifasResource.addMethod('GET', tarifasIntegration);
    tarifasResource.addMethod('POST', tarifasIntegration);
    tarifasIdResource.addMethod('PUT', tarifasIntegration);
    tarifasIdResource.addMethod('DELETE', tarifasIntegration);

    // /webhook/whatsapp – Endpoint para Meta WhatsApp Cloud API
    const webhookResource = restApi.root.addResource('webhook');
    const whatsappWebhookResource = webhookResource.addResource('whatsapp');
    const whatsappIntegration = new apigateway.LambdaIntegration(whatsappWebhookFn);
    whatsappWebhookResource.addMethod('GET', whatsappIntegration);   // Verificación
    whatsappWebhookResource.addMethod('POST', whatsappIntegration);  // Mensajes entrantes

    // ═══════════════════════════════════════════════════════
    //  OUTPUTS
    // ═══════════════════════════════════════════════════════

    new cdk.CfnOutput(this, 'RestApiUrl', {
      value: restApi.url,
      description: 'URL REST API',
    });
    new cdk.CfnOutput(this, "AppointmentsTableName", { value: appointmentsTable.tableName });
    new cdk.CfnOutput(this, "DoctorsTableName", { value: doctorsTable.tableName });
    new cdk.CfnOutput(this, "StudiesTableName", { value: studiesTable.tableName });
    new cdk.CfnOutput(this, 'ObrasSocialesTableName', { value: obrasSocialesTable.tableName });
    new cdk.CfnOutput(this, 'TarifasTableName', { value: tarifasTable.tableName });
    new cdk.CfnOutput(this, 'WhatsAppWebhookUrl', {
      value: `${restApi.url}webhook/whatsapp`,
      description: 'URL del webhook de WhatsApp (configurar en Meta Developer Console)',
    });
  }
}
