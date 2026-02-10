# Guía de Instalación - Turnos MVP

## Requisitos previos

### 1. Instalar Node.js (v22.x)

```bash
# Opción 1: Usando nvm (recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# Opción 2: Usando NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node --version  # Debe ser v22.x.x
npm --version
```

### 2. Instalar AWS CLI

```bash
# Descargar e instalar AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verificar instalación
aws --version
```

### 3. Instalar CDK CLI

```bash
npm install -g aws-cdk

# Verificar instalación
cdk --version
```

### 4. Instalar Docker (requerido para CDK Lambda)

```bash
# Instalar Docker
sudo apt-get update
sudo apt-get install -y docker.io

# Agregar usuario al grupo docker (para no usar sudo)
sudo usermod -aG docker $USER

# Iniciar Docker
sudo systemctl start docker
sudo systemctl enable docker

# Verificar (puede requerir logout/login)
docker --version
```

### 5. Configurar AWS Credentials

```bash
# Configurar credenciales de AWS
aws configure

# Ingresar:
# - AWS Access Key ID: [tu access key]
# - AWS Secret Access Key: [tu secret key]
# - Default region name: us-east-2
# - Default output format: json

# Verificar configuración
aws sts get-caller-identity
```

### 6. Clonar el repositorio

```bash
# Si tienes el repo en Git
git clone [url-del-repo]
cd turnos-mvp

# O si ya tienes los archivos, simplemente navega al directorio
cd turnos-mvp
```

### 7. Instalar dependencias del proyecto

```bash
npm install
```

### 8. Configurar archivo de environment

```bash
# Crear/editar config/environment.json
cat > config/environment.json << EOF
{
  "account": "138545360904",
  "region": "us-east-2"
}
EOF
```

### 9. Bootstrap CDK (solo la primera vez en la cuenta/región)

```bash
cdk bootstrap aws://138545360904/us-east-2
```

### 10. Verificar que todo funciona

```bash
# Compilar TypeScript
npm run build

# Verificar sintaxis CDK
cdk synth

# Ver diferencias con lo desplegado
cdk diff
```

## Comandos útiles

```bash
# Deploy
cdk deploy

# Ver logs de Lambda
aws logs tail /aws/lambda/CreateAppointmentFn --follow

# Ver recursos desplegados
aws cloudformation describe-stacks --stack-name AppointmentsStack --region us-east-2
```

## Notas importantes

- **Docker**: CDK usa Docker para construir las Lambdas. Asegúrate de que Docker esté corriendo.
- **AWS Credentials**: Necesitas tener permisos para crear recursos en AWS (Lambda, DynamoDB, API Gateway, etc.)
- **Secret de Google**: El secret `google/calendar-service-account` debe existir en Secrets Manager con el JSON del service account.
