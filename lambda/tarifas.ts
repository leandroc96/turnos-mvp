import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME!;
const OBRAS_SOCIALES_TABLE = process.env.OBRAS_SOCIALES_TABLE!;
const STUDIES_TABLE = process.env.STUDIES_TABLE!;

export const handler = async (event: any) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  };

  try {
    const method = event.httpMethod;
    const tarifaId = event.pathParameters?.tarifaId;

    // ─── GET /tarifas ───
    if (method === 'GET') {
      const result = await dynamo.send(new ScanCommand({ TableName: TABLE_NAME }));
      const tarifas = result.Items ?? [];

      // Enriquecer con nombres de estudio y obra social
      const enrichedTarifas = await Promise.all(
        tarifas.map(async (tarifa) => {
          let nombreEstudio: string | null = null;
          let nombreObraSocial: string | null = null;

          try {
            if (tarifa.estudioId) {
              const estudio = await dynamo.send(
                new GetCommand({
                  TableName: STUDIES_TABLE,
                  Key: { studyId: tarifa.estudioId },
                })
              );
              nombreEstudio = estudio.Item?.nombre ?? estudio.Item?.name ?? null;
            }
          } catch {
            // Si la tabla de estudios no existe o falla, continuamos sin el nombre
          }

          try {
            if (tarifa.obraSocialId) {
              const obraSocial = await dynamo.send(
                new GetCommand({
                  TableName: OBRAS_SOCIALES_TABLE,
                  Key: { obraSocialId: tarifa.obraSocialId },
                })
              );
              nombreObraSocial = obraSocial.Item?.nombre ?? null;
            }
          } catch {
            // Si falla, continuamos sin el nombre
          }

          return {
            ...tarifa,
            nombreEstudio,
            nombreObraSocial,
          };
        })
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ tarifas: enrichedTarifas, count: enrichedTarifas.length }),
      };
    }

    // ─── POST /tarifas ───
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');

      if (!body.estudioId || !body.obraSocialId || body.precio === undefined) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            message: 'Los campos "estudioId", "obraSocialId" y "precio" son obligatorios',
          }),
        };
      }

      // Validar unicidad: no puede haber dos tarifas con el mismo estudioId + obraSocialId
      const existing = await dynamo.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'estudioId-obraSocialId-index',
          KeyConditionExpression: 'estudioId = :estudioId AND obraSocialId = :obraSocialId',
          ExpressionAttributeValues: {
            ':estudioId': body.estudioId,
            ':obraSocialId': body.obraSocialId,
          },
        })
      );

      if (existing.Items && existing.Items.length > 0) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({
            message: 'Ya existe una tarifa para esta combinación de estudio y obra social',
            tarifaExistente: existing.Items[0],
          }),
        };
      }

      const tarifa = {
        tarifaId: randomUUID(),
        estudioId: body.estudioId,
        obraSocialId: body.obraSocialId,
        precio: body.precio,
      };

      await dynamo.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: tarifa,
        })
      );

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          message: 'Tarifa creada correctamente',
          tarifa,
        }),
      };
    }

    // ─── PUT /tarifas/:tarifaId ───
    if (method === 'PUT' && tarifaId) {
      const body = JSON.parse(event.body || '{}');

      const expressionParts: string[] = [];
      const expressionValues: Record<string, any> = {};
      const expressionNames: Record<string, string> = {};

      if (body.estudioId !== undefined) {
        expressionParts.push('#estudioId = :estudioId');
        expressionValues[':estudioId'] = body.estudioId;
        expressionNames['#estudioId'] = 'estudioId';
      }
      if (body.obraSocialId !== undefined) {
        expressionParts.push('#obraSocialId = :obraSocialId');
        expressionValues[':obraSocialId'] = body.obraSocialId;
        expressionNames['#obraSocialId'] = 'obraSocialId';
      }
      if (body.precio !== undefined) {
        expressionParts.push('#precio = :precio');
        expressionValues[':precio'] = body.precio;
        expressionNames['#precio'] = 'precio';
      }

      if (expressionParts.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'No se proporcionaron campos para actualizar' }),
        };
      }

      // Si se están cambiando estudioId u obraSocialId, validar unicidad
      if (body.estudioId !== undefined || body.obraSocialId !== undefined) {
        // Obtener la tarifa actual para tener los valores completos
        const current = await dynamo.send(
          new GetCommand({ TableName: TABLE_NAME, Key: { tarifaId } })
        );

        if (!current.Item) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ message: 'Tarifa no encontrada' }),
          };
        }

        const newEstudioId = body.estudioId ?? current.Item.estudioId;
        const newObraSocialId = body.obraSocialId ?? current.Item.obraSocialId;

        const existing = await dynamo.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'estudioId-obraSocialId-index',
            KeyConditionExpression: 'estudioId = :estudioId AND obraSocialId = :obraSocialId',
            ExpressionAttributeValues: {
              ':estudioId': newEstudioId,
              ':obraSocialId': newObraSocialId,
            },
          })
        );

        const conflict = existing.Items?.find((item) => item.tarifaId !== tarifaId);
        if (conflict) {
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({
              message: 'Ya existe otra tarifa para esta combinación de estudio y obra social',
            }),
          };
        }
      }

      const result = await dynamo.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { tarifaId },
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
          message: 'Tarifa actualizada correctamente',
          tarifa: result.Attributes,
        }),
      };
    }

    // ─── DELETE /tarifas/:tarifaId ───
    if (method === 'DELETE' && tarifaId) {
      await dynamo.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { tarifaId },
        })
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Tarifa eliminada correctamente' }),
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
