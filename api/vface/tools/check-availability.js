/**
 * Vercel Serverless Function — Check Appointment Availability
 *
 * POST /api/vface/tools/check-availability
 *
 * Called by the concierge frontend when Tavus fires a check_availability tool call.
 * Returns available time slots for the requested date.
 *
 * Body: { date: "2026-03-14", service_type?: "General Checkup & Cleaning" }
 */

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { date, service_type } = req.body || {};

  if (!date) {
    return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
  }

  try {
    const requestedDate = new Date(date + "T00:00:00");
    const dayOfWeek = requestedDate.getUTCDay();

    // Office is closed Wed (3), Sat (6), Sun (0)
    if (dayOfWeek === 0 || dayOfWeek === 3 || dayOfWeek === 6) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return res.status(200).json({
        available: false,
        date,
        message: `The office is closed on ${dayNames[dayOfWeek]}s. We are open Monday, Tuesday, Thursday, and Friday from 9 AM to 5 PM.`,
        slots: [],
      });
    }

    // Generate available slots (office hours 9 AM - 5 PM, 30-min slots)
    // In production, this would check Google Calendar for conflicts
    const slots = [];
    const slotDuration = service_type === "Invisalign Consultation" || service_type === "Cosmetic Consultation" ? 60 : 30;

    for (let hour = 9; hour < 17; hour++) {
      for (let min = 0; min < 60; min += slotDuration) {
        if (hour === 16 && min + slotDuration > 60) continue; // Don't go past 5 PM
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
};
