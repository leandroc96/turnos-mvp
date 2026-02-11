import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { successResponse, errorResponse } from "../../../utils/http";

const dynamoClient = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.STUDIES_TABLE_NAME || "TurnosMvp-Studies";

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log("Delete study request received");

  try {
    const studyId = event.pathParameters?.studyId;

    if (!studyId) {
      return errorResponse("Missing studyId in path", 400);
    }

    // Verificar que existe
    const existing = await dynamoDb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { studyId },
      })
    );

    if (!existing.Item) {
      return errorResponse("Study not found", 404);
    }

    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { studyId },
      })
    );

    console.log("Study deleted:", studyId);

    return successResponse({
      message: "Study deleted successfully",
      studyId,
    });
  } catch (error: any) {
    console.error("Error deleting study:", error);
    return errorResponse("Failed to delete study", 500, error.message);
  }
}
