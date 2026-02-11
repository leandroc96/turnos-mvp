import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { successResponse, errorResponse } from "../../../utils/http";
import { Study } from "../../../domain/study.model";

const dynamoClient = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.STUDIES_TABLE_NAME || "Studies";

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log("List studies request received");

  try {
    // Por defecto solo traemos los activos, salvo que pidan todos
    const includeInactive = event.queryStringParameters?.includeInactive === "true";

    const scanParams: any = {
      TableName: TABLE_NAME,
    };

    if (!includeInactive) {
      scanParams.FilterExpression = "active = :active";
      scanParams.ExpressionAttributeValues = { ":active": true };
    }

    const result = await dynamoDb.send(new ScanCommand(scanParams));
    const studies = (result.Items || []) as Study[];

    // Ordenar por nombre
    studies.sort((a, b) => a.name.localeCompare(b.name));

    return successResponse({
      studies,
      count: studies.length,
    });
  } catch (error: any) {
    console.error("Error listing studies:", error);
    return errorResponse("Failed to list studies", 500, error.message);
  }
}
