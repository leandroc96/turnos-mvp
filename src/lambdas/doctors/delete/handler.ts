import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { successResponse, errorResponse } from "../../../utils/http";

const dynamoClient = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.DOCTORS_TABLE_NAME || "Doctors";

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log("Delete doctor request received");

  try {
    const doctorId = event.pathParameters?.doctorId;

    if (!doctorId) {
      return errorResponse("Missing doctorId in path", 400);
    }

    // Verificar que existe
    const existing = await dynamoDb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { doctorId },
      })
    );

    if (!existing.Item) {
      return errorResponse("Doctor not found", 404);
    }

    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { doctorId },
      })
    );

    console.log("Doctor deleted:", doctorId);

    return successResponse({
      message: "Doctor deleted successfully",
      doctorId,
    });
  } catch (error: any) {
    console.error("Error deleting doctor:", error);
    return errorResponse("Failed to delete doctor", 500, error.message);
  }
}
