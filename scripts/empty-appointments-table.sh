#!/bin/bash
# Vacía la tabla Appointments (borra todos los ítems, no la tabla).
# Uso: ./scripts/empty-appointments-table.sh [region]
# Requiere: aws cli

TABLE_NAME="Appointments"
REGION="${1:-us-east-2}"

echo "Vaciando tabla $TABLE_NAME en región $REGION..."

aws dynamodb scan \
  --table-name "$TABLE_NAME" \
  --region "$REGION" \
  --projection-expression "appointmentId" \
  --query "Items[*].appointmentId.S" \
  --output text \
  | tr '\t' '\n' \
  | while read -r id; do
    [ -z "$id" ] && continue
    aws dynamodb delete-item \
      --table-name "$TABLE_NAME" \
      --region "$REGION" \
      --key "{\"appointmentId\": {\"S\": \"$id\"}}"
    echo "Eliminado: $id"
  done

echo "Listo."
