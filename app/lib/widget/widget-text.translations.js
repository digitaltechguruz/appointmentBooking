import { TRANSLATION_FIELDS } from "./widget-text.constants.js";

const sharedUi = {
  first_name_label: "Enter your first name *",
  first_name_placeholder: "Enter your first name",
  last_name_label: "Enter your last name *",
  last_name_placeholder: "Enter your last name",
  email_label: "Enter your email *",
  email_placeholder: "Enter your email",
  phone_label: "Phone Number / WhatsApp",
  country_region_label: "Country / region",
  phone_number_label: "Phone number",
  phone_placeholder: "555 123 4567",
  note_label: "Anything we should know? (optional)",
  note_placeholder:
    "Tell us about your idea, budget, or any questions you have in advance.",
  back_button: "Back",
  next_button: "Next",
  cancel_button: "Cancel",
  confirming_button: "Confirming…",
  available_times: "Available Times",
  timezone_hint: "Times shown in your timezone ({timezone})",
  select_date_first: "Select a date first",
  no_slots: "No available time slot",
  minutes_label: "minutes",
  loading_label: "Loading…",
  loading_availability: "Loading availability…",
  timezone_label: "Time zone",
  calendar_past_limit: "You can only book appointments from the current month onward.",
  calendar_future_limit: "Bookings can only be made up to {range} in advance.",
  calendar_future_limit_generic: "You have reached the furthest date available for booking.",
  calendar_no_dates: "No available dates this month. Try another month.",
  calendar_load_error: "Could not load availability. Please try again.",
  no_meeting_types:
    "No meeting options are available for this service. Choose a different service or ask the store to link meeting types.",
  book_another: "Book another appointment",
  previous_month: "Previous month",
  next_month: "Next month",
  stepper_aria_label: "Booking progress",
  country_code_aria: "Country code",
  popular_countries: "Popular",
  all_countries: "All countries",
  error_load_widget: "Failed to load booking widget",
  error_booking_failed: "Booking failed",
  error_empty_response: "Empty response from booking server",
  error_unexpected_page:
    "Booking server returned an unexpected page instead of JSON. Try again in a moment.",
  error_read_response:
    "Could not read the confirmation response. If you received an email, your booking was likely created.",
  error_incomplete_response: "Booking response was incomplete",
  error_request_failed: "Request failed",
  step_progress: "Step {step}/{total}",
  preview_banner: "Storefront preview — sample services shown for appearance only.",
  review_appointment_label: "Appointment",
  review_datetime_label: "Date and time",
  review_full_name_label: "Full Name",
  review_email_label: "Email address",
  review_note_label: "Note",
  stepper_services_title: "Services",
  stepper_services_subtitle: "Choose a service",
  stepper_meeting_title: "Meeting type",
  stepper_meeting_subtitle: "How to meet",
  stepper_calendar_title: "Date & time",
  stepper_calendar_subtitle: "Pick a slot",
  stepper_details_title: "Your details",
  stepper_details_subtitle: "Contact information",
  stepper_review_title: "Review",
  stepper_review_subtitle: "Confirm booking",
};

const en = {
  title: "Book an Appointment",
  subtitle: "Choose a service and pick a time that works for you",
  step1_title: "What brings you in?",
  step1_subtitle:
    "Select the type of appointment. Each visit is private and at our showroom.",
  step2_title: "How would you like to meet?",
  step2_subtitle: "Choose what works best for you. All options are free.",
  step3_intro:
    "In-store, video, or a quick call — choose whatever works for you. Our team will guide you through every option.",
  step3_title: "Choose a date and time",
  step3_subtitle: "Auto from working hours and closed dates",
  step4_title: "Your details",
  step4_subtitle:
    "We'll send a confirmation to your email. WhatsApp reminders available if you add your number.",
  step5_title: "Review your appointment",
  step5_subtitle:
    "Check the details below before confirming. You'll receive a confirmation email immediately.",
  primary_button_text: "Confirm appointment",
  confirmation_text: "Your appointment has been confirmed!",
  ...sharedUi,
};

const fr = {
  title: "Prendre rendez-vous",
  subtitle: "Choisissez un service et un créneau qui vous convient",
  step1_title: "Qu'est-ce qui vous amène ?",
  step1_subtitle:
    "Sélectionnez le type de rendez-vous. Chaque visite est privée dans notre showroom.",
  step2_title: "Comment souhaitez-vous nous rencontrer ?",
  step2_subtitle: "Choisissez ce qui vous convient. Toutes les options sont gratuites.",
  step3_intro:
    "En magasin, en visio ou par téléphone — choisissez ce qui vous convient. Notre équipe vous guidera.",
  step3_title: "Choisissez une date et une heure",
  step3_subtitle: "Automatique selon les horaires et jours fermés",
  step4_title: "Vos coordonnées",
  step4_subtitle:
    "Nous enverrons une confirmation à votre e-mail. Rappels WhatsApp si vous ajoutez votre numéro.",
  step5_title: "Vérifiez votre rendez-vous",
  step5_subtitle:
    "Vérifiez les détails ci-dessous avant de confirmer. Vous recevrez un e-mail de confirmation.",
  primary_button_text: "Confirmer le rendez-vous",
  confirmation_text: "Votre rendez-vous est confirmé !",
  first_name_label: "Entrez votre prénom *",
  first_name_placeholder: "Entrez votre prénom",
  last_name_label: "Entrez votre nom *",
  last_name_placeholder: "Entrez votre nom",
  email_label: "Entrez votre e-mail *",
  email_placeholder: "Entrez votre e-mail",
  phone_label: "Téléphone / WhatsApp",
  country_region_label: "Pays / région",
  phone_number_label: "Numéro de téléphone",
  phone_placeholder: "555 123 4567",
  note_label: "Une information à nous transmettre ? (facultatif)",
  note_placeholder: "Parlez-nous de votre projet, budget ou questions.",
  back_button: "Retour",
  next_button: "Suivant",
  cancel_button: "Annuler",
  confirming_button: "Confirmation…",
  available_times: "Créneaux disponibles",
  timezone_hint: "Heures affichées dans votre fuseau ({timezone})",
  select_date_first: "Sélectionnez d'abord une date",
  no_slots: "Aucun créneau disponible",
  minutes_label: "minutes",
  loading_label: "Chargement…",
  loading_availability: "Chargement des disponibilités…",
  timezone_label: "Fuseau horaire",
  calendar_past_limit: "Les rendez-vous ne peuvent être pris qu'à partir du mois en cours.",
  calendar_future_limit: "Les réservations ne peuvent être effectuées que jusqu'à {range} à l'avance.",
  calendar_future_limit_generic: "Vous avez atteint la date la plus éloignée disponible pour la réservation.",
  calendar_no_dates: "Aucune date disponible ce mois-ci. Essayez un autre mois.",
  calendar_load_error: "Impossible de charger les disponibilités. Veuillez réessayer.",
  no_meeting_types:
    "Aucune option de rendez-vous n'est disponible pour ce service. Choisissez un autre service ou demandez au magasin d'associer des types de rendez-vous.",
  book_another: "Prendre un autre rendez-vous",
  previous_month: "Mois précédent",
  next_month: "Mois suivant",
  stepper_aria_label: "Progression de la réservation",
  country_code_aria: "Indicatif pays",
  popular_countries: "Populaires",
  all_countries: "Tous les pays",
  error_load_widget: "Impossible de charger le widget de réservation",
  error_booking_failed: "La réservation a échoué",
  error_empty_response: "Réponse vide du serveur de réservation",
  error_unexpected_page:
    "Le serveur de réservation a renvoyé une page inattendue au lieu de JSON. Réessayez dans un instant.",
  error_read_response:
    "Impossible de lire la réponse de confirmation. Si vous avez reçu un e-mail, votre réservation a probablement été créée.",
  error_incomplete_response: "La réponse de réservation est incomplète",
  error_request_failed: "La requête a échoué",
  step_progress: "Étape {step}/{total}",
  preview_banner:
    "Aperçu boutique — services d'exemple affichés pour l'apparence uniquement.",
  review_appointment_label: "Rendez-vous",
  review_datetime_label: "Date et heure",
  review_full_name_label: "Nom complet",
  review_email_label: "Adresse e-mail",
  review_note_label: "Note",
  stepper_services_title: "Services",
  stepper_services_subtitle: "Choisir un service",
  stepper_meeting_title: "Type de rendez-vous",
  stepper_meeting_subtitle: "Comment nous rencontrer",
  stepper_calendar_title: "Date et heure",
  stepper_calendar_subtitle: "Choisir un créneau",
  stepper_details_title: "Vos coordonnées",
  stepper_details_subtitle: "Informations de contact",
  stepper_review_title: "Vérification",
  stepper_review_subtitle: "Confirmer la réservation",
};

const de = {
  title: "Termin buchen",
  subtitle: "Wählen Sie einen Service und eine passende Zeit",
  step1_title: "Womit können wir Ihnen helfen?",
  step1_subtitle:
    "Wählen Sie die Art des Termins. Jeder Besuch ist privat in unserem Showroom.",
  step2_title: "Wie möchten Sie uns treffen?",
  step2_subtitle: "Wählen Sie, was am besten passt. Alle Optionen sind kostenlos.",
  step3_intro:
    "Vor Ort, per Video oder telefonisch — wählen Sie, was für Sie passt. Unser Team begleitet Sie.",
  step3_title: "Datum und Uhrzeit wählen",
  step3_subtitle: "Automatisch aus Öffnungszeiten und Schließtagen",
  step4_title: "Ihre Angaben",
  step4_subtitle:
    "Wir senden eine Bestätigung an Ihre E-Mail. WhatsApp-Erinnerungen bei Angabe Ihrer Nummer.",
  step5_title: "Termin überprüfen",
  step5_subtitle:
    "Prüfen Sie die Angaben vor der Bestätigung. Sie erhalten sofort eine Bestätigungs-E-Mail.",
  primary_button_text: "Termin bestätigen",
  confirmation_text: "Ihr Termin wurde bestätigt!",
  ...sharedUi,
  back_button: "Zurück",
  next_button: "Weiter",
  cancel_button: "Abbrechen",
  confirming_button: "Wird bestätigt…",
  available_times: "Verfügbare Zeiten",
  timezone_hint: "Zeiten in Ihrer Zeitzone ({timezone})",
  select_date_first: "Wählen Sie zuerst ein Datum",
  no_slots: "Keine verfügbaren Zeitfenster",
  loading_label: "Laden…",
  loading_availability: "Verfügbarkeit wird geladen…",
  timezone_label: "Zeitzone",
  calendar_past_limit: "Termine können erst ab dem aktuellen Monat gebucht werden.",
  calendar_future_limit: "Buchungen sind nur bis zu {range} im Voraus möglich.",
  calendar_future_limit_generic: "Sie haben das weitest entfernte verfügbare Buchungsdatum erreicht.",
  calendar_no_dates: "Keine verfügbaren Termine in diesem Monat. Versuchen Sie einen anderen Monat.",
  calendar_load_error: "Verfügbarkeit konnte nicht geladen werden. Bitte versuchen Sie es erneut.",
  no_meeting_types:
    "Für diesen Service sind keine Terminoptionen verfügbar. Wählen Sie einen anderen Service oder bitten Sie den Shop, Terminarten zu verknüpfen.",
  book_another: "Weiteren Termin buchen",
  previous_month: "Vorheriger Monat",
  next_month: "Nächster Monat",
  stepper_aria_label: "Buchungsfortschritt",
  country_code_aria: "Ländercode",
  popular_countries: "Beliebt",
  all_countries: "Alle Länder",
  error_load_widget: "Buchungs-Widget konnte nicht geladen werden",
  error_booking_failed: "Buchung fehlgeschlagen",
  error_empty_response: "Leere Antwort vom Buchungsserver",
  error_unexpected_page:
    "Der Buchungsserver hat eine unerwartete Seite statt JSON zurückgegeben. Versuchen Sie es in Kürze erneut.",
  error_read_response:
    "Bestätigungsantwort konnte nicht gelesen werden. Wenn Sie eine E-Mail erhalten haben, wurde Ihre Buchung wahrscheinlich erstellt.",
  error_incomplete_response: "Buchungsantwort unvollständig",
  error_request_failed: "Anfrage fehlgeschlagen",
  step_progress: "Schritt {step}/{total}",
  preview_banner:
    "Shop-Vorschau — Beispieldienste nur zur Darstellung.",
};

const es = {
  title: "Reservar cita",
  subtitle: "Elige un servicio y una hora que te convenga",
  step1_title: "¿Qué te trae por aquí?",
  step1_subtitle:
    "Selecciona el tipo de cita. Cada visita es privada en nuestro showroom.",
  step2_title: "¿Cómo te gustaría reunirte?",
  step2_subtitle: "Elige lo que mejor te funcione. Todas las opciones son gratis.",
  step3_intro:
    "En tienda, por video o por teléfono — elige lo que prefieras. Nuestro equipo te guiará.",
  step3_title: "Elige fecha y hora",
  step3_subtitle: "Automático según horario y días cerrados",
  step4_title: "Tus datos",
  step4_subtitle:
    "Enviaremos una confirmación a tu correo. Recordatorios por WhatsApp si añades tu número.",
  step5_title: "Revisa tu cita",
  step5_subtitle:
    "Revisa los detalles antes de confirmar. Recibirás un correo de confirmación al instante.",
  primary_button_text: "Confirmar cita",
  confirmation_text: "¡Tu cita ha sido confirmada!",
  ...sharedUi,
  back_button: "Atrás",
  next_button: "Siguiente",
  cancel_button: "Cancelar",
  confirming_button: "Confirmando…",
  available_times: "Horarios disponibles",
  timezone_hint: "Horas en tu zona horaria ({timezone})",
  select_date_first: "Selecciona una fecha primero",
  no_slots: "No hay horarios disponibles",
  loading_label: "Cargando…",
  loading_availability: "Cargando disponibilidad…",
  timezone_label: "Zona horaria",
  calendar_past_limit: "Solo puedes reservar citas a partir del mes actual.",
  calendar_future_limit: "Las reservas solo se pueden hacer con hasta {range} de antelación.",
  calendar_future_limit_generic: "Has alcanzado la fecha más lejana disponible para reservar.",
  calendar_no_dates: "No hay fechas disponibles este mes. Prueba otro mes.",
  calendar_load_error: "No se pudo cargar la disponibilidad. Inténtalo de nuevo.",
  no_meeting_types:
    "No hay opciones de cita disponibles para este servicio. Elige otro servicio o pide a la tienda que vincule tipos de cita.",
  book_another: "Reservar otra cita",
  previous_month: "Mes anterior",
  next_month: "Mes siguiente",
  stepper_aria_label: "Progreso de la reserva",
  country_code_aria: "Código de país",
  popular_countries: "Populares",
  all_countries: "Todos los países",
  error_load_widget: "No se pudo cargar el widget de reservas",
  error_booking_failed: "La reserva falló",
  error_empty_response: "Respuesta vacía del servidor de reservas",
  error_unexpected_page:
    "El servidor de reservas devolvió una página inesperada en lugar de JSON. Inténtalo de nuevo en un momento.",
  error_read_response:
    "No se pudo leer la respuesta de confirmación. Si recibiste un correo, es probable que tu reserva se haya creado.",
  error_incomplete_response: "La respuesta de reserva está incompleta",
  error_request_failed: "La solicitud falló",
  step_progress: "Paso {step}/{total}",
  preview_banner:
    "Vista previa de la tienda — servicios de ejemplo solo para la apariencia.",
};

export const translations = {
  en,
  fr,
  de,
  es,
  nl: { ...en },
  it: { ...en },
  ru: { ...en },
  ar: { ...en },
};

export function getTranslations(language = "en") {
  return translations[language] || translations.en;
}

export function parseCustomTranslations(stored) {
  if (!stored) return {};
  if (typeof stored === "object") return stored;
  try {
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getDefaultTranslationValues(language = "en") {
  const strings = getTranslations(language);
  const values = {};
  for (const field of TRANSLATION_FIELDS) {
    values[field.key] = strings[field.key] || translations.en[field.key] || "";
  }
  return values;
}
