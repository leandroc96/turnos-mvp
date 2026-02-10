import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({});

export async function loadServiceAccount(secretName: string) {
  const res = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );

  if (!res.SecretString) {
    throw new Error("Secret vacío o binario no soportado");
  }

  return JSON.parse(res.SecretString);
}
