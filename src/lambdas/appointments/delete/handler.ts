import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { successResponse, errorResponse } from "../../../utils/http";

const dynamoClient = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.APPOINTMENTS_TABLE_NAME || "Appointments";

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log("Delete appointment request received");

  try {
    const appointmentId = event.pathParameters?.appointmentId;

    if (!appointmentId) {
      return errorResponse("Missing appointmentId in path", 400);
    }

    // Verificar que existe
    const existing = await dynamoDb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { appointmentId },
      })
    );

    if (!existing.Item) {
      return errorResponse("Appointment not found", 404);
    }

    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { appointmentId },
      })
    );

    console.log("Appointment deleted:", appointmentId);

    return successResponse({
      message: "Appointment deleted successfully",
      appointmentId,
    });
  } catch (error: any) {
    console.error("Error deleting appointment:", error);
    return errorResponse("Failed to delete appointment", 500, error.message);
  }
}
