# Turnos MVP - Backend

Backend serverless (Lambda + API Gateway + DynamoDB + Google Calendar) para gestión de turnos.

## Comandos útiles

* `npm run build`   compilar TypeScript
* `npm run test`    tests con Jest
* `npx cdk deploy`  desplegar el stack
* `npx cdk diff`    ver diferencias con lo desplegado
* `npx cdk synth`   generar CloudFormation

## Limpiar DynamoDB

**Opción 1 – Vaciar la tabla (solo datos, la tabla sigue existiendo)**

```bash
chmod +x scripts/empty-appointments-table.sh
./scripts/empty-appointments-table.sh
# con otra región: ./scripts/empty-appointments-table.sh us-east-2
```

O desde consola AWS: DynamoDB → Tablas → Appointments → Explorar elementos → borrar ítems.

**Opción 2 – Borrar todo y que el deploy recree**

No borres solo la tabla a mano: CloudFormation puede fallar en el próximo deploy. Para empezar de cero:

1. `npx cdk destroy` (borra stack completo: tabla, Lambdas, API)
2. `npx cdk deploy` (crea todo de nuevo, tabla vacía)
