import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: any) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  };

  try {
    const method = event.httpMethod;
    const obraSocialId = event.pathParameters?.obraSocialId;

    // ─── GET /obras-sociales ───
    if (method === 'GET') {
      const result = await dynamo.send(new ScanCommand({ TableName: TABLE_NAME }));
      const obrasSociales = result.Items ?? [];
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ obrasSociales, count: obrasSociales.length }),
      };
    }

    // ─── POST /obras-sociales ───
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');

      if (!body.nombre) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'El campo "nombre" es obligatorio' }),
        };
      }

      const obraSocial = {
        obraSocialId: randomUUID(),
        nombre: body.nombre,
        codigo: body.codigo ?? null,
        activa: body.activa !== undefined ? body.activa : true,
      };

      await dynamo.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: obraSocial,
        })
      );

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          message: 'Obra social creada correctamente',
          obraSocial,
        }),
      };
    }

    // ─── PUT /obras-sociales/:obraSocialId ───
    if (method === 'PUT' && obraSocialId) {
      const body = JSON.parse(event.body || '{}');

      const expressionParts: string[] = [];
      const expressionValues: Record<string, any> = {};
      const expressionNames: Record<string, string> = {};

      if (body.nombre !== undefined) {
        expressionParts.push('#nombre = :nombre');
        expressionValues[':nombre'] = body.nombre;
        expressionNames['#nombre'] = 'nombre';
      }
      if (body.codigo !== undefined) {
        expressionParts.push('#codigo = :codigo');
        expressionValues[':codigo'] = body.codigo;
        expressionNames['#codigo'] = 'codigo';
      }
      if (body.activa !== undefined) {
        expressionParts.push('#activa = :activa');
        expressionValues[':activa'] = body.activa;
        expressionNames['#activa'] = 'activa';
      }

      if (expressionParts.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'No se proporcionaron campos para actualizar' }),
        };
      }

      const result = await dynamo.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { obraSocialId },
          UpdateExpression: `SET ${expressionParts.join(', ')}`,
          ExpressionAttributeValues: expressionValues,
          ExpressionAttributeNames: expressionNames,
          ReturnValues: 'ALL_NEW',
        })
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Obra social actualizada correctamente',
          obraSocial: result.Attributes,
        }),
      };
    }

    // ─── DELETE /obras-sociales/:obraSocialId ───
    if (method === 'DELETE' && obraSocialId) {
      await dynamo.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { obraSocialId },
        })
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Obra social eliminada correctamente' }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: 'Método no soportado' }),
    };
  } catch (error: any) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Error interno del servidor', error: error.message }),
    };
  }
};
