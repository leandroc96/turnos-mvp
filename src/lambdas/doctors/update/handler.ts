import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { successResponse, errorResponse, parseRequestBody } from "../../../utils/http";
import { UpdateDoctorDto } from "../../../domain/doctor.dto";

const dynamoClient = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.DOCTORS_TABLE_NAME || "Doctors";

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log("Update doctor request received");

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

    const dto = parseRequestBody<UpdateDoctorDto>(event.body);

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

    if (dto.specialty !== undefined) {
      updateExpressions.push("#specialty = :specialty");
      expressionAttributeNames["#specialty"] = "specialty";
      expressionAttributeValues[":specialty"] = dto.specialty.trim();
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
        Key: { doctorId },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      })
    );

    console.log("Doctor updated:", doctorId);

    return successResponse({
      message: "Doctor updated successfully",
      doctor: result.Attributes,
    });
  } catch (error: any) {
    console.error("Error updating doctor:", error);
    return errorResponse("Failed to update doctor", 500, error.message);
  }
}
