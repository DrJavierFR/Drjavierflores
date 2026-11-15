/* =====================================================================
   CONFIGURACIÓN DEL SITIO — Dr. Javier Flores
   Este es el ÚNICO archivo que necesitas editar (Guía, parte 3, paso 9).
   ===================================================================== */
window.JF_CONFIG = {
  // Pega aquí la URL de tu servidor gratuito de Google (termina en /exec).
  // Mientras esté vacía, la agenda y los expedientes funcionan solo en el dispositivo.
  API_URL: "",

  // SHA-256 de la contraseña del médico (contraseña actual: la que te dio la guía).
  DOCTOR_PASSWORD_HASH: "a5f008644ebf6b1a3719c9a7d0f345d7df9f080b17f9543282a1bc2c368aa26b",

  WHATSAPP: "525640100596",          // 52 + 10 dígitos, sin espacios
  TELEFONO_VISIBLE: "56 4010 0596",
  INSTAGRAM: "https://www.instagram.com/dr_javierflores/",
  INSTAGRAM_USUARIO: "@dr_javierflores",

  // Agenda (si cambias el horario, cámbialo también en Code.gs)
  DIAS_LABORALES: [1, 2, 3, 4, 5, 6], // 0=domingo, 1=lunes … 6=sábado
  HORA_INICIO: 8,
  HORA_FIN: 18,
  MINUTOS_POR_CITA: 60,
  DIAS_ADELANTE: 90,

  // Modelos de IA (gratis: análisis con Gemini; imagen con Cloudflare)
  MODELO_TEXTO: "gemini-flash-latest",
  MODELO_IMAGEN_GEMINI: "gemini-3.1-flash-image"
};
