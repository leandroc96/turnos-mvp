import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { nanoid } from "nanoid";
import { successResponse, errorResponse, parseRequestBody } from "../../../utils/http";
import { CreateStudyDto } from "../../../domain/study.dto";
import { Study } from "../../../domain/study.model";

const dynamoClient = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.STUDIES_TABLE_NAME || "TurnosMvp-Studies";
const DEFAULT_DURATION_MINUTES = 30;

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log("Create study request received");

  try {
    const dto = parseRequestBody<CreateStudyDto>(event.body);

    if (!dto || !dto.name || dto.name.trim() === "") {
      return errorResponse("Missing required field: name", 400);
    }

    const study: Study = {
      studyId: nanoid(4),
      name: dto.name.trim(),
      description: dto.description?.trim(),
      durationMinutes: dto.durationMinutes || DEFAULT_DURATION_MINUTES,
      active: true,
      createdAt: new Date().toISOString(),
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: study,
      })
    );

    console.log("Study created:", study.studyId);

    return successResponse(
      {
        message: "Study created successfully",
        study: {
          studyId: study.studyId,
          name: study.name,
          description: study.description,
          durationMinutes: study.durationMinutes,
          active: study.active,
        },
      },
      201
    );
  } catch (error: any) {
    console.error("Error creating study:", error);
    return errorResponse("Failed to create study", 500, error.message);
  }
}
