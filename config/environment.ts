/**
 * Configuración del ambiente de despliegue
 * 
 * Prioridad de lectura:
 * 1. Archivo config/environment.json (más fácil de editar)
 * 2. Variables de entorno (CDK_DEFAULT_ACCOUNT, CDK_DEFAULT_REGION)
 * 3. Valores por defecto
 */

import * as fs from "fs";
import * as path from "path";

export interface EnvironmentConfig {
  account: string;
  region: string;
}

/**
 * Lee la configuración del ambiente
 * Primero intenta leer desde config/environment.json
 * Si no existe o está vacío, usa variables de entorno
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const configPath = path.join(__dirname, "environment.json");
  let config: Partial<EnvironmentConfig> = {};

  // Intenta leer desde el archivo JSON
  try {
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, "utf-8");
      config = JSON.parse(fileContent);
    }
  } catch (error) {
    console.warn(`⚠️  No se pudo leer ${configPath}, usando variables de entorno`);
  }

  // Prioridad: archivo JSON > variables de entorno > valores por defecto
  const account =
    config.account ||
    process.env.CDK_DEFAULT_ACCOUNT ||
    process.env.AWS_ACCOUNT_ID ||
    "";

  const region =
    config.region ||
    process.env.CDK_DEFAULT_REGION ||
    process.env.AWS_REGION ||
    "us-east-1";

  if (!account) {
    console.warn(
      "⚠️  No se encontró account ID. CDK intentará detectarlo automáticamente al hacer deploy."
    );
  }

  return {
    account,
    region,
  };
}
