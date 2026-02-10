/**
 * Google Apps Script para integrar Google Form con Turnos MVP API
 * 
 * Instrucciones:
 * 1. Crea un Google Form con los campos necesarios
 * 2. Abre el formulario → ⋮ → Scripts
 * 3. Pega este código
 * 4. Configura el trigger: onFormSubmit → On form submit
 * 5. Actualiza API_URL con tu endpoint de API Gateway
 */

// ===== CONFIGURACIÓN =====
const API_URL = 'https://iggymlf34d.execute-api.us-east-2.amazonaws.com/appointments';
const TIMEZONE = 'America/Argentina/Buenos_Aires';

// ===== FUNCIÓN PRINCIPAL =====
/**
 * Se ejecuta automáticamente cuando se envía el formulario
 */
function onFormSubmit(e) {
  try {
    Logger.log('Formulario enviado, procesando...');
    
    // Obtener los valores del formulario
    const formResponse = e.response;
    const itemResponses = formResponse.getItemResponses();
    
    // Mapear las respuestas según el orden de las preguntas
    // Ajusta estos índices según el orden de tus campos en el formulario
    const patientName = itemResponses[0].getResponse(); // Primera pregunta: Nombre
    const phone = itemResponses[1].getResponse(); // Segunda pregunta: Teléfono
    const email = itemResponses[2].getResponse(); // Tercera pregunta: Email
    const study = itemResponses[3].getResponse(); // Cuarta pregunta: Estudio
    const insurance = itemResponses[4].getResponse(); // Quinta pregunta: Obra social
    const doctorId = itemResponses[5].getResponse(); // Sexta pregunta: Doctor ID
    const date = itemResponses[6].getResponse(); // Séptima pregunta: Fecha
    const time = itemResponses[7].getResponse(); // Octava pregunta: Hora
    
    Logger.log('Datos extraídos:', {
      patientName,
      phone,
      email,
      study,
      insurance,
      doctorId,
      date,
      time
    });
    
    // Preparar el payload para la API (formato Google Form)
    const payload = {
      patientName: patientName,
      phone: phone,
      email: email,
      study: study,
      insurance: insurance,
      doctorId: doctorId,
      date: formatDate(date), // Formato YYYY-MM-DD
      time: formatTime(time), // Formato HH:mm
      source: "google_form"
    };
    
    Logger.log('Payload a enviar:', JSON.stringify(payload));
    
    // Llamar a la API
    const response = callAPI(payload);
    
    Logger.log('Respuesta de la API:', response);
    
    // Opcional: Enviar email de confirmación o actualizar una hoja de cálculo
    // sendConfirmationEmail(patientName, response);
    
  } catch (error) {
    Logger.log('Error al procesar el formulario:', error);
    // Opcional: Enviar email de error
    // sendErrorEmail(error);
  }
}

// ===== FUNCIONES AUXILIARES =====

/**
 * Formatea una fecha a YYYY-MM-DD
 */
function formatDate(dateValue) {
  let date;
  if (typeof dateValue === 'string') {
    date = new Date(dateValue);
  } else {
    date = dateValue;
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Formatea una hora a HH:mm
 */
function formatTime(timeValue) {
  let date;
  if (typeof timeValue === 'string') {
    date = new Date(timeValue);
  } else {
    date = timeValue;
  }
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

/**
 * Llama a la API de Turnos MVP
 */
function callAPI(payload) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true // Para capturar errores HTTP
  };
  
  try {
    const response = UrlFetchApp.fetch(API_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log('Response Code:', responseCode);
    Logger.log('Response Text:', responseText);
    
    if (responseCode >= 200 && responseCode < 300) {
      return JSON.parse(responseText);
    } else {
      throw new Error(`API Error ${responseCode}: ${responseText}`);
    }
  } catch (error) {
    Logger.log('Error en la llamada a la API:', error);
    throw error;
  }
}

/**
 * Función de prueba (opcional)
 * Ejecuta esta función manualmente para probar la integración
 */
function testIntegration() {
  const testPayload = {
    patientName: 'Test desde Google Form',
    phone: '+5491123456789',
    email: 'test@example.com',
    study: 'Ecografía',
    insurance: 'OSDE',
    doctorId: 'DOC001',
    date: '2024-02-15',
    time: '10:00',
    source: 'google_form'
  };
  
  Logger.log('Probando integración con:', testPayload);
  const response = callAPI(testPayload);
  Logger.log('Respuesta:', response);
}
