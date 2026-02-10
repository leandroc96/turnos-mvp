# Integración con Google Form

## Configuración

### 1. Crear el Google Form

1. Ve a [Google Forms](https://forms.google.com)
2. Crea un nuevo formulario
3. Agrega los campos necesarios (en este orden):
   - **Nombre del paciente** (texto corto)
   - **Teléfono del paciente** (texto corto)
   - **Email del paciente** (texto corto)
   - **Estudio** (texto corto)
   - **Obra social** (texto corto)
   - **Doctor ID** (texto corto)
   - **Fecha** (fecha)
   - **Hora** (hora)

### 2. Configurar Google Apps Script

1. En el formulario, haz clic en los 3 puntos (⋮) → **Scripts**
2. O ve a [script.google.com](https://script.google.com) y crea un nuevo proyecto
3. Pega el código del archivo `form-submit-handler.gs`
4. Configura las variables:
   - `API_URL`: URL de tu API Gateway
   - Ajusta los nombres de los campos según tu formulario

### 3. Configurar el Trigger

1. En Apps Script, ve a **Triggers** (reloj ⏰)
2. Haz clic en **Add Trigger**
3. Configura:
   - **Function**: `onFormSubmit`
   - **Event source**: **From form**
   - **Event type**: **On form submit**
   - **Failure notification settings**: Diario

### 4. Autorizar el Script

1. La primera vez que se ejecute, te pedirá autorización
2. Acepta los permisos necesarios

## Estructura del Formulario

El formulario debe tener estos campos (en este orden exacto):
1. **Nombre del paciente** (texto corto)
2. **Teléfono del paciente** (texto corto)
3. **Email del paciente** (texto corto)
4. **Estudio** (texto corto) - Ej: "Ecografía", "Radiografía", etc.
5. **Obra social** (texto corto) - Ej: "OSDE", "Swiss Medical", etc.
6. **Doctor ID** (texto corto) - ID del doctor
7. **Fecha** (fecha) - Solo fecha
8. **Hora** (hora) - Solo hora

## Formato de Datos

- **Fecha**: Se convierte automáticamente a formato `YYYY-MM-DD`
- **Hora**: Se convierte automáticamente a formato `HH:mm`
- **Duración del turno**: Se asume 30 minutos por defecto (calculado automáticamente)
- **Timezone**: `America/Argentina/Buenos_Aires` (UTC-3)

## Payload Enviado

El script envía este payload a la API:
```json
{
  "patientName": "...",
  "phone": "...",
  "email": "...",
  "study": "...",
  "insurance": "...",
  "doctorId": "...",
  "date": "2024-02-15",
  "time": "10:00",
  "source": "google_form"
}
```
