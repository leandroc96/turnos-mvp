/**
 * Utilidades para respuestas HTTP en Lambda (API Gateway v2)
 */

import { APIGatewayProxyResult } from "aws-lambda";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

export function successResponse(data: any, statusCode: number = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

export function errorResponse(
  message: string,
  statusCode: number = 500,
  error?: any
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: message,
      ...(error && { details: error }),
    }),
  };
}

export function parseRequestBody<T = any>(body: string | null | undefined): T {
  if (!body) {
    throw new Error("Request body is required");
  }
  try {
    return JSON.parse(body) as T;
  } catch (error) {
    throw new Error("Invalid JSON in request body");
  }
}
