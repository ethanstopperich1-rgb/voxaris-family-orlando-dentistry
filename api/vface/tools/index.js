/**
 * Vercel Serverless Function — V·FACE Tool Router
 *
 * POST /api/vface/tools
 *
 * Routes tool calls from the concierge frontend.
 * Body: { action: "check_availability" | "book_appointment" | "webhook", ...params }
 */

const fs = require("fs");
const path = require("path");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, ...params } = req.body || {};

  if (action === "check_availability") {
    return handleCheckAvailability(params, res);
  } else if (action === "book_appointment") {
    return handleBookAppointment(params, res);
  } else if (action === "webhook") {
    return handleWebhook(req.body, res);
  } else {
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }
};

// ── Check Availability ──────────────────────────────────────────────

function handleCheckAvailability({ date, service_type }, res) {
  if (!date) {
    return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
  }

  try {
    const requestedDate = new Date(date + "T00:00:00");
    const dayOfWeek = requestedDate.getUTCDay();

    if (dayOfWeek === 0 || dayOfWeek === 3 || dayOfWeek === 6) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return res.status(200).json({
        available: false,
        date,
        message: `The office is closed on ${dayNames[dayOfWeek]}s. We are open Monday, Tuesday, Thursday, and Friday from 9 AM to 5 PM.`,
        slots: [],
      });
    }

    const slots = [];
    const slotDuration = service_type === "Invisalign Consultation" || service_type === "Cosmetic Consultation" ? 60 : 30;

    for (let hour = 9; hour < 17; hour++) {
      for (let min = 0; min < 60; min += slotDuration) {
        if (hour === 16 && min + slotDuration > 60) continue;
        const timeStr = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
        const displayHour = hour > 12 ? hour - 12 : hour;
        const ampm = hour >= 12 ? "PM" : "AM";
        const displayMin = min.toString().padStart(2, "0");
        slots.push({
          time: timeStr,
          display: `${displayHour}:${displayMin} ${ampm}`,
          available: true,
        });
      }
    }

    return res.status(200).json({
      available: true,
      date,
      service_type: service_type || "General",
      message: `We have ${slots.length} available time slots on ${date}. Office hours are 9 AM to 5 PM.`,
      slots,
    });
  } catch (err) {
    console.error("[tools/check-availability] Error:", err.message);
    return res.status(500).json({ error: "Failed to check availability" });
  }
}

// ── Book Appointment ────────────────────────────────────────────────

function handleBookAppointment({ patient_name, phone_number, email, date, time, service_type }, res) {
  if (!patient_name || !phone_number || !date || !time || !service_type) {
    return res.status(400).json({
      error: "Missing required fields: patient_name, phone_number, date, time, service_type",
    });
  }

  try {
    const requestedDate = new Date(date + "T00:00:00");
    const dayOfWeek = requestedDate.getUTCDay();

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

    const durationMinutes =
      service_type === "Invisalign Consultation" || service_type === "Cosmetic Consultation"
        ? 60
        : 30;

    const displayHour = hours > 12 ? hours - 12 : hours;
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayTime = `${displayHour}:${minutes.toString().padStart(2, "0")} ${ampm}`;

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

    const logFile = path.join("/tmp", "appointments.jsonl");
    fs.appendFileSync(logFile, JSON.stringify(appointment) + "\n");

    console.log(`[tools/book-appointment] Booked: ${appointment.id} for ${patient_name} on ${date} at ${displayTime}`);

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
}

// ── Webhook ─────────────────────────────────────────────────────────

function handleWebhook(event, res) {
  const eventType = event.event_type || event.type || "unknown";
  console.log(`[vface/webhook] Event: ${eventType}`, JSON.stringify(event).slice(0, 500));

  try {
    const logFile = path.join("/tmp", "tavus-events.jsonl");
    fs.appendFileSync(logFile, JSON.stringify({ ...event, received_at: new Date().toISOString() }) + "\n");
  } catch {}

  return res.status(200).json({ received: true, event_type: eventType });
}
