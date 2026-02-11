import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { successResponse, errorResponse } from "../../../utils/http";
import { Doctor } from "../../../domain/doctor.model";

const dynamoClient = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.DOCTORS_TABLE_NAME || "Doctors";

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log("List doctors request received");

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
    const doctors = (result.Items || []) as Doctor[];

    // Ordenar por nombre
    doctors.sort((a, b) => a.name.localeCompare(b.name));

    return successResponse({
      doctors,
      count: doctors.length,
    });
  } catch (error: any) {
    console.error("Error listing doctors:", error);
    return errorResponse("Failed to list doctors", 500, error.message);
  }
}
