import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { nanoid } from "nanoid";
import { successResponse, errorResponse, parseRequestBody } from "../../../utils/http";
import { CreateDoctorDto } from "../../../domain/doctor.dto";
import { Doctor } from "../../../domain/doctor.model";

const dynamoClient = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.DOCTORS_TABLE_NAME || "Doctors";

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log("Create doctor request received");

  try {
    const dto = parseRequestBody<CreateDoctorDto>(event.body);

    if (!dto || !dto.name || dto.name.trim() === "") {
      return errorResponse("Missing required field: name", 400);
    }

    const doctor: Doctor = {
      doctorId: nanoid(4),
      name: dto.name.trim(),
      specialty: dto.specialty?.trim(),
      active: true,
      createdAt: new Date().toISOString(),
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: doctor,
      })
    );

    console.log("Doctor created:", doctor.doctorId);

    return successResponse(
      {
        message: "Doctor created successfully",
        doctor: {
          doctorId: doctor.doctorId,
          name: doctor.name,
          specialty: doctor.specialty,
          active: doctor.active,
        },
      },
      201
    );
  } catch (error: any) {
    console.error("Error creating doctor:", error);
    return errorResponse("Failed to create doctor", 500, error.message);
  }
}
