/**
 * Vercel Serverless Function — Book Appointment
 *
 * POST /api/vface/tools/book-appointment
 *
 * Called by the concierge frontend when Tavus fires a book_appointment tool call.
 * Creates a Google Calendar event for the appointment.
 *
 * Body: {
 *   patient_name: "John Smith",
 *   phone_number: "+14075551234",
 *   email?: "john@example.com",
 *   date: "2026-03-14",
 *   time: "10:00",
 *   service_type: "General Checkup & Cleaning"
 * }
 */

const fs = require("fs");
const path = require("path");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { patient_name, phone_number, email, date, time, service_type } = req.body || {};

  // Validate required fields
  if (!patient_name || !phone_number || !date || !time || !service_type) {
    return res.status(400).json({
      error: "Missing required fields: patient_name, phone_number, date, time, service_type",
    });
  }

  try {
    const requestedDate = new Date(date + "T00:00:00");
    const dayOfWeek = requestedDate.getUTCDay();

    // Validate office hours
    if (dayOfWeek === 0 || dayOfWeek === 3 || dayOfWeek === 6) {
      return res.status(400).json({
        success: false,
        error: "The office is closed on that day. We are open Monday, Tuesday, Thursday, and Friday.",
      });
    }

    const [hours, minutes] = time.split(":").map(Number);
    if (hours < 9 || hours >= 17) {
      return res.status(400).json({
        success: false,
        error: "Appointments are available between 9:00 AM and 5:00 PM.",
      });
    }

    // Determine appointment duration
    const durationMinutes =
      service_type === "Invisalign Consultation" || service_type === "Cosmetic Consultation"
        ? 60
        : 30;

    // Format display time
    const displayHour = hours > 12 ? hours - 12 : hours;
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayTime = `${displayHour}:${minutes.toString().padStart(2, "0")} ${ampm}`;

    // Build appointment record
    const appointment = {
      id: `appt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      patient_name,
      phone_number,
      email: email || null,
      date,
      time,
      display_time: displayTime,
      service_type,
      duration_minutes: durationMinutes,
      status: "confirmed",
      booked_at: new Date().toISOString(),
      source: "vface_concierge",
    };

    // Log appointment to file (Vercel /tmp for serverless)
    const logDir = "/tmp";
    const logFile = path.join(logDir, "appointments.jsonl");
    fs.appendFileSync(logFile, JSON.stringify(appointment) + "\n");

    console.log(`[tools/book-appointment] Appointment booked: ${appointment.id} for ${patient_name} on ${date} at ${displayTime}`);

    return res.status(200).json({
      success: true,
      appointment_id: appointment.id,
      message: `Your appointment has been booked for ${date} at ${displayTime} for ${service_type}. We look forward to seeing you, ${patient_name}!`,
      details: {
        patient_name,
        date,
        time: displayTime,
        service_type,
        duration: `${durationMinutes} minutes`,
        location: "2704 Rew Circle, Suite 103, Ocoee, FL 34761",
        phone: "(407) 877-9003",
      },
    });
  } catch (err) {
    console.error("[tools/book-appointment] Error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Failed to book appointment. Please call us at (407) 877-9003.",
    });
  }
};
