import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { successResponse, errorResponse, parseRequestBody } from "../../../utils/http";
import { UpdateStudyDto } from "../../../domain/study.dto";

const dynamoClient = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.STUDIES_TABLE_NAME || "TurnosMvp-Studies";

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log("Update study request received");

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

    const dto = parseRequestBody<UpdateStudyDto>(event.body);

    if (!dto) {
      return errorResponse("Missing request body", 400);
    }

    // Construir update expression dinámicamente
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    if (dto.name !== undefined) {
      updateExpressions.push("#name = :name");
      expressionAttributeNames["#name"] = "name";
      expressionAttributeValues[":name"] = dto.name.trim();
    }

    if (dto.description !== undefined) {
      updateExpressions.push("#description = :description");
      expressionAttributeNames["#description"] = "description";
      expressionAttributeValues[":description"] = dto.description.trim();
    }

    if (dto.durationMinutes !== undefined) {
      updateExpressions.push("#durationMinutes = :durationMinutes");
      expressionAttributeNames["#durationMinutes"] = "durationMinutes";
      expressionAttributeValues[":durationMinutes"] = dto.durationMinutes;
    }

    if (dto.honorario !== undefined) {
      updateExpressions.push("#honorario = :honorario");
      expressionAttributeNames["#honorario"] = "honorario";
      expressionAttributeValues[":honorario"] = dto.honorario;
    }

    if (dto.active !== undefined) {
      updateExpressions.push("#active = :active");
      expressionAttributeNames["#active"] = "active";
      expressionAttributeValues[":active"] = dto.active;
    }

    if (updateExpressions.length === 0) {
      return errorResponse("No fields to update", 400);
    }

    // Agregar updatedAt
    updateExpressions.push("#updatedAt = :updatedAt");
    expressionAttributeNames["#updatedAt"] = "updatedAt";
    expressionAttributeValues[":updatedAt"] = new Date().toISOString();

    const result = await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { studyId },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      })
    );

    console.log("Study updated:", studyId);

    return successResponse({
      message: "Study updated successfully",
      study: result.Attributes,
    });
  } catch (error: any) {
    console.error("Error updating study:", error);
    return errorResponse("Failed to update study", 500, error.message);
  }
}
