import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export class TurnosMvpStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ═══════════════════════════════════════════════════════
    //  DYNAMODB TABLES
    // ═══════════════════════════════════════════════════════

    // ─── Tabla: Studies (referenciada por Tarifas) ───
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
    //  LAMBDA FUNCTIONS
    // ═══════════════════════════════════════════════════════

    // ─── Lambda: Obras Sociales ───
    const obrasSocialesFn = new NodejsFunction(this, 'ObrasSocialesFn', {
      functionName: 'TurnosMvp-ObrasSociales',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '..', 'lambda', 'obras-sociales.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        TABLE_NAME: obrasSocialesTable.tableName,
      },
    });

    // ─── Lambda: Tarifas ───
    const tarifasFn = new NodejsFunction(this, 'TarifasFn', {
      functionName: 'TurnosMvp-Tarifas',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '..', 'lambda', 'tarifas.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        TABLE_NAME: tarifasTable.tableName,
        OBRAS_SOCIALES_TABLE: obrasSocialesTable.tableName,
        STUDIES_TABLE: studiesTable.tableName,
      },
    });

    // ─── Permisos DynamoDB ───
    obrasSocialesTable.grantReadWriteData(obrasSocialesFn);
    tarifasTable.grantReadWriteData(tarifasFn);
    obrasSocialesTable.grantReadData(tarifasFn); // Para enriquecer tarifas con nombre OS
    studiesTable.grantReadData(tarifasFn);        // Para enriquecer tarifas con nombre estudio

    // ═══════════════════════════════════════════════════════
    //  API GATEWAY
    // ═══════════════════════════════════════════════════════

    const api = new apigateway.RestApi(this, 'TurnosMvpApi', {
      restApiName: 'TurnosMvp API',
      description: 'API REST para el sistema de turnos MVP',
      deployOptions: {
        stageName: 'v1',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // ─── Recurso: /obras-sociales ───
    const obrasSocialesResource = api.root.addResource('obras-sociales');
    const obrasSocialesIdResource = obrasSocialesResource.addResource('{obraSocialId}');

    const obrasSocialesIntegration = new apigateway.LambdaIntegration(obrasSocialesFn);

    obrasSocialesResource.addMethod('GET', obrasSocialesIntegration);    // GET /obras-sociales
    obrasSocialesResource.addMethod('POST', obrasSocialesIntegration);   // POST /obras-sociales
    obrasSocialesIdResource.addMethod('PUT', obrasSocialesIntegration);  // PUT /obras-sociales/:id
    obrasSocialesIdResource.addMethod('DELETE', obrasSocialesIntegration); // DELETE /obras-sociales/:id

    // ─── Recurso: /tarifas ───
    const tarifasResource = api.root.addResource('tarifas');
    const tarifasIdResource = tarifasResource.addResource('{tarifaId}');

    const tarifasIntegration = new apigateway.LambdaIntegration(tarifasFn);

    tarifasResource.addMethod('GET', tarifasIntegration);     // GET /tarifas
    tarifasResource.addMethod('POST', tarifasIntegration);    // POST /tarifas
    tarifasIdResource.addMethod('PUT', tarifasIntegration);   // PUT /tarifas/:id
    tarifasIdResource.addMethod('DELETE', tarifasIntegration); // DELETE /tarifas/:id

    // ═══════════════════════════════════════════════════════
    //  OUTPUTS
    // ═══════════════════════════════════════════════════════

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'URL base de la API REST',
    });

    new cdk.CfnOutput(this, 'ObrasSocialesTableName', {
      value: obrasSocialesTable.tableName,
      description: 'Nombre de la tabla DynamoDB de Obras Sociales',
    });

    new cdk.CfnOutput(this, 'TarifasTableName', {
      value: tarifasTable.tableName,
      description: 'Nombre de la tabla DynamoDB de Tarifas',
    });
  }
}
