#!/bin/bash
# Script para generar data de prueba en producción
# API: https://medicitas-api.onrender.com

API="https://medicitas-api.onrender.com"

echo "=== 1. Registrar paciente de prueba ==="
PATIENT=$(curl -s -X POST "$API/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "paciente.test99@medicitas.hn",
    "password": "Test123456",
    "accountType": "PATIENT",
    "bloodType": "O_POSITIVE",
    "person": {
      "firstName": "María",
      "lastName": "López",
      "birthDate": "1995-05-15",
      "dni": "0801199500199",
      "gender": "F",
      "countryId": "'$(curl -s "$API/api/v1/locations/countries" -H "Authorization: Bearer dummy" 2>/dev/null | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)'",
      "departmentId": "'$(curl -s "$API/api/v1/locations/departments" -H "Authorization: Bearer dummy" 2>/dev/null | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)'",
      "municipalityId": "'$(curl -s "$API/api/v1/locations/municipalities" -H "Authorization: Bearer dummy" 2>/dev/null | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)'"
    }
  }')
echo "$PATIENT" | python3 -m json.tool 2>/dev/null || echo "$PATIENT"

echo ""
echo "=== 2. Login del paciente ==="
PATIENT_TOKEN=$(curl -s -X POST "$API/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "paciente.test99@medicitas.hn", "password": "Test123456"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)
echo "Token: ${PATIENT_TOKEN:0:20}..."

echo ""
echo "=== 3. Verificar especialidades disponibles ==="
curl -s "$API/api/v1/specialties" \
  -H "Authorization: Bearer $PATIENT_TOKEN" | python3 -m json.tool 2>/dev/null

echo ""
echo "=== 4. Verificar doctores disponibles ==="
curl -s "$API/api/v1/doctors" \
  -H "Authorization: Bearer $PATIENT_TOKEN" | python3 -m json.tool 2>/dev/null

echo ""
echo "=== 5. Verificar horarios existentes ==="
curl -s "$API/api/v1/schedules" \
  -H "Authorization: Bearer $PATIENT_TOKEN" | python3 -m json.tool 2>/dev/null

echo ""
echo "=== Script completado ==="
echo "Paciente registrado: paciente.test99@medicitas.hn / Test123456"
echo "Ahora verifica en la UI: https://web-self-eight-c3lnokun26.vercel.app/citas/agendar"
