import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { successResponse, errorResponse } from "../../../utils/http";
import { Appointment } from "../../../domain/appointment";

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.APPOINTMENTS_TABLE_NAME!;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIMEZONE_SUFFIX = "-03:00";

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const from = event.queryStringParameters?.from;
    const to = event.queryStringParameters?.to;
    const doctorId = event.queryStringParameters?.doctorId;

    if (!from || !to) {
      return errorResponse(
        "Query params 'from' y 'to' son requeridos (formato YYYY-MM-DD). Ej: /appointments?from=2024-02-01&to=2024-02-28&doctorId=abc1",
        400
      );
    }

    if (!DATE_REGEX.test(from) || !DATE_REGEX.test(to)) {
      return errorResponse("'from' y 'to' deben tener formato YYYY-MM-DD", 400);
    }

    const fromDate = new Date(`${from}T00:00:00${TIMEZONE_SUFFIX}`);
    const toDate = new Date(`${to}T23:59:59${TIMEZONE_SUFFIX}`);

    if (fromDate.getTime() > toDate.getTime()) {
      return errorResponse("'from' no puede ser mayor que 'to'", 400);
    }

    const fromISO = `${from}T00:00:00${TIMEZONE_SUFFIX}`;
    const toISO = `${to}T23:59:59${TIMEZONE_SUFFIX}`;

    // Construir filtro dinámicamente
    let filterExpression = "startTime >= :from AND startTime <= :to";
    const expressionAttributeValues: Record<string, any> = {
      ":from": fromISO,
      ":to": toISO,
    };

    // Agregar filtro por doctorId si se proporciona
    if (doctorId) {
      filterExpression += " AND doctorId = :doctorId";
      expressionAttributeValues[":doctorId"] = doctorId;
    }

    const result = await dynamoClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );

    const appointments = (result.Items ?? []) as Appointment[];

    // Ordenar por startTime
    appointments.sort((a, b) => a.startTime.localeCompare(b.startTime));

    return successResponse({
      appointments,
      count: appointments.length,
      filters: {
        from,
        to,
        ...(doctorId && { doctorId }),
      },
    });
  } catch (error: unknown) {
    console.error("Error listing appointments:", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return errorResponse("Error al listar turnos", 500, message);
  }
};
