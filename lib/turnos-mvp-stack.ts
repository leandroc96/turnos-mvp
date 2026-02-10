import * as cdk from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class AppointmentsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB table para persistir turnos
    const appointmentsTable = new dynamodb.Table(this, "AppointmentsTable", {
      tableName: "Appointments",
      partitionKey: { name: "appointmentId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expiresAt",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // MVP: fácil de limpiar
    });

    // DynamoDB table para médicos
    const doctorsTable = new dynamodb.Table(this, "DoctorsTable", {
      tableName: "Doctors",
      partitionKey: { name: "doctorId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // DynamoDB table para estudios
    const studiesTable = new dynamodb.Table(this, "StudiesTable", {
      tableName: "Studies",
      partitionKey: { name: "studyId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Secret de Google Service Account
    // TEMPORAL: Comentado para evitar validación temprana de CloudFormation
    // Agregaremos los permisos después del deploy inicial
    const secretName = "google/calendar-service-account";
    // const googleSecret = secretsmanager.Secret.fromSecretNameV2(
    //   this,
    //   "GoogleCalendarSecret",
    //   secretName
    // );

    // Lambda: Create Appointment
    const createAppointmentFn = new NodejsFunction(this, "CreateAppointmentFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/appointments/create/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(30), // Timeout de 30 segundos
      memorySize: 256, // Más memoria para mejor performance
      environment: {
        GOOGLE_SECRET_NAME: secretName,
        GOOGLE_CALENDAR_ID:
          process.env.GOOGLE_CALENDAR_ID ||
          "c_dbc5ed76ca1dd4e635ed63c55b8b9dcba68e4c9eb047af252e58577c744e4b66@group.calendar.google.com", // Default, puede sobrescribirse con env var
        GOOGLE_IMPERSONATE_USER: "administracion@quid-ar.com",
        APPOINTMENTS_TABLE_NAME: appointmentsTable.tableName,
      },
    });

    // Permisos: TEMPORALMENTE comentado - agregaremos después del deploy
    // googleSecret.grantRead(createAppointmentFn);
    
    // Permisos temporales más amplios (sin validación temprana)
    createAppointmentFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
        resources: ["*"], // Permiso amplio temporal - restringir después
      })
    );
    appointmentsTable.grantReadWriteData(createAppointmentFn);

    // Lambda: List Appointments (GET por rango de fechas)
    const listAppointmentsFn = new NodejsFunction(this, "ListAppointmentsFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/appointments/list/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        APPOINTMENTS_TABLE_NAME: appointmentsTable.tableName,
      },
    });
    appointmentsTable.grantReadData(listAppointmentsFn);

    // ============== DOCTORS ==============
    // Lambda: List Doctors
    const listDoctorsFn = new NodejsFunction(this, "ListDoctorsFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/doctors/list/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        DOCTORS_TABLE_NAME: doctorsTable.tableName,
      },
    });
    doctorsTable.grantReadData(listDoctorsFn);

    // Lambda: Create Doctor
    const createDoctorFn = new NodejsFunction(this, "CreateDoctorFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/doctors/create/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        DOCTORS_TABLE_NAME: doctorsTable.tableName,
      },
    });
    doctorsTable.grantWriteData(createDoctorFn);

    // Lambda: Update Doctor
    const updateDoctorFn = new NodejsFunction(this, "UpdateDoctorFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/doctors/update/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        DOCTORS_TABLE_NAME: doctorsTable.tableName,
      },
    });
    doctorsTable.grantReadWriteData(updateDoctorFn);

    // ============== STUDIES ==============
    // Lambda: List Studies
    const listStudiesFn = new NodejsFunction(this, "ListStudiesFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/studies/list/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        STUDIES_TABLE_NAME: studiesTable.tableName,
      },
    });
    studiesTable.grantReadData(listStudiesFn);

    // Lambda: Create Study
    const createStudyFn = new NodejsFunction(this, "CreateStudyFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/studies/create/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        STUDIES_TABLE_NAME: studiesTable.tableName,
      },
    });
    studiesTable.grantWriteData(createStudyFn);

    // Lambda: Update Study
    const updateStudyFn = new NodejsFunction(this, "UpdateStudyFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "src/lambdas/studies/update/handler.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        STUDIES_TABLE_NAME: studiesTable.tableName,
      },
    });
    studiesTable.grantReadWriteData(updateStudyFn);

    // HTTP API Gateway con CORS para llamadas desde el navegador / Google Apps Script
    const httpApi = new apigwv2.HttpApi(this, "TurnosHttpApi", {
      apiName: "turnos-mvp-api",
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    // Ruta: POST /appointments
    httpApi.addRoutes({
      path: "/appointments",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "CreateAppointmentIntegration",
        createAppointmentFn
      ),
    });

    // Ruta: GET /appointments?from=YYYY-MM-DD&to=YYYY-MM-DD
    httpApi.addRoutes({
      path: "/appointments",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "ListAppointmentsIntegration",
        listAppointmentsFn
      ),
    });

    // ============== DOCTORS ROUTES ==============
    // GET /doctors - listar médicos
    httpApi.addRoutes({
      path: "/doctors",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "ListDoctorsIntegration",
        listDoctorsFn
      ),
    });

    // POST /doctors - crear médico
    httpApi.addRoutes({
      path: "/doctors",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "CreateDoctorIntegration",
        createDoctorFn
      ),
    });

    // PUT /doctors/{doctorId} - actualizar médico
    httpApi.addRoutes({
      path: "/doctors/{doctorId}",
      methods: [apigwv2.HttpMethod.PUT],
      integration: new integrations.HttpLambdaIntegration(
        "UpdateDoctorIntegration",
        updateDoctorFn
      ),
    });

    // ============== STUDIES ROUTES ==============
    // GET /studies - listar estudios
    httpApi.addRoutes({
      path: "/studies",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "ListStudiesIntegration",
        listStudiesFn
      ),
    });

    // POST /studies - crear estudio
    httpApi.addRoutes({
      path: "/studies",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "CreateStudyIntegration",
        createStudyFn
      ),
    });

    // PUT /studies/{studyId} - actualizar estudio
    httpApi.addRoutes({
      path: "/studies/{studyId}",
      methods: [apigwv2.HttpMethod.PUT],
      integration: new integrations.HttpLambdaIntegration(
        "UpdateStudyIntegration",
        updateStudyFn
      ),
    });

    // Outputs
    new cdk.CfnOutput(this, "HttpApiUrl", {
      value: httpApi.url ?? "NO_URL",
    });
    new cdk.CfnOutput(this, "AppointmentsTableName", {
      value: appointmentsTable.tableName,
    });
    new cdk.CfnOutput(this, "DoctorsTableName", {
      value: doctorsTable.tableName,
    });
    new cdk.CfnOutput(this, "StudiesTableName", {
      value: studiesTable.tableName,
    });
  }
}
