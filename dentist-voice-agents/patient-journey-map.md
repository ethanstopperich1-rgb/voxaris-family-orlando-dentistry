# Patient Journey Map — Family Orlando Dentistry x Voxaris

## Overview

This document maps every patient touchpoint from first awareness through treatment completion,
identifying the AI agents, data captured, and automation triggers at each stage. It covers
four primary journey types: new patient acquisition, Invisalign lead qualification, emergency
triage, and dormant patient reactivation.

---

## Journey Funnel (ASCII Diagram)

```
                         AWARENESS
    ================================================================
    |  Google Search  |  Facebook Ad  |  Referral  |  Yelp/Maps   |
    ================================================================
                              |
                              v
    ┌──────────────────────────────────────────────────────────────┐
    │                    WEBSITE VISIT                             │
    │  Channel: Web        Agent: None (passive tracking)         │
    │  Data: UTM, device, referrer, landing page                  │
    │  Funnel step 1 of 8    Target: 2,500 visits/mo              │
    └──────────────────────────────────────────────────────────────┘
                              |
                    ┌─────────┼─────────┐
                    v         v         v
              ┌──────────┐ ┌──────┐ ┌──────────┐
              │  Browse   │ │ Click│ │ V·FACE   │
              │  Pages    │ │ Phone│ │ Widget   │
              └────┬─────┘ └──┬───┘ └────┬─────┘
                   v          v          v
    ┌──────────────────────────────────────────────────────────────┐
    │                   PAGE ENGAGEMENT                            │
    │  Channel: Web        Agent: None (engagement scoring)       │
    │  Data: Scroll depth, time on page, pages viewed, clicks     │
    │  Funnel step 2 of 8    Target: 65% of visitors              │
    └──────────────────────────────────────────────────────────────┘
                              |
                    ┌─────────┼──────────┐
                    v         v          v
    ┌─────────────────┐  ┌────────┐  ┌────────────────────────────┐
    │   FORM START    │  │ PHONE  │  │  V·FACE CHAT SESSION       │
    │   Web form      │  │ CALL   │  │  Channel: V·FACE widget    │
    │   Channel: Web  │  │ V·TEAMS│  │  Agent: Receptionist AI    │
    └───────┬─────────┘  └───┬────┘  └────────────┬───────────────┘
            v                v                     v
    ┌──────────────────────────────────────────────────────────────┐
    │                    FORM COMPLETE / CONTACT MADE              │
    │  Channel: Multi      Agent: Receptionist (voice or chat)    │
    │  Data: Name, phone, email, service interest, insurance      │
    │  Funnel step 3-4      Target: 15% of engaged visitors       │
    └──────────────────────────────────────────────────────────────┘
                              |
                              v
    ┌──────────────────────────────────────────────────────────────┐
    │                   QUALIFICATION                              │
    │  Channel: V·TEAMS / V·FACE                                  │
    │  Agent: Invisalign Qualifier / Receptionist AI               │
    │  Data: Treatment interest, insurance details, availability  │
    │  Actions: Pre-screen, collect clinical info, set urgency    │
    └──────────────────────────────────────────────────────────────┘
                              |
                              v
    ┌──────────────────────────────────────────────────────────────┐
    │                   BOOKING REQUEST                            │
    │  Channel: Multi      Agent: Receptionist AI                 │
    │  Data: Preferred date/time, service, doctor preference      │
    │  Funnel step 5        Target: 60% of qualified contacts     │
    └──────────────────────────────────────────────────────────────┘
                              |
                              v
    ┌──────────────────────────────────────────────────────────────┐
    │              APPOINTMENT CONFIRMED                           │
    │  Channel: SMS/Email  Agent: Confirmation system             │
    │  Data: Confirmed date, doctor assigned, pre-visit info      │
    │  Funnel step 6        Target: 85% of booking requests       │
    │  Actions: Send confirmation, pre-visit forms, reminders     │
    └──────────────────────────────────────────────────────────────┘
                              |
                              v
    ┌──────────────────────────────────────────────────────────────┐
    │              TREATMENT COMPLETED                             │
    │  Channel: In-office  Agent: Post-visit follow-up            │
    │  Data: Treatment performed, value, satisfaction, next steps │
    │  Funnel step 7        Target: 95% of confirmed appointments │
    │  Actions: Post-visit survey, review request, recall setup   │
    └──────────────────────────────────────────────────────────────┘
                              |
                              v
    ┌──────────────────────────────────────────────────────────────┐
    │                   RETENTION LOOP                             │
    │  Channel: Outbound voice/SMS/Email                          │
    │  Agent: Outbound Revival AI                                 │
    │  Data: Recall schedule, treatment plan, engagement history  │
    │  Actions: Recall reminders, reactivation calls, referrals   │
    └──────────────────────────────────────────────────────────────┘
```

---

## Journey Type 1: New Patient Acquisition

### Touchpoint Timeline

| Stage | Touchpoint | Channel | AI Agent | Data Captured | Next Action |
|-------|-----------|---------|----------|---------------|-------------|
| 1 | Google search for "dentist near Ocoee FL" | Organic | None | Search query, landing page, UTM params | Track page view |
| 2 | Lands on Family Orlando Dentistry website | Web | Analytics | Device, referrer, session start, engagement scoring begins | Monitor engagement |
| 3 | Browses services page, reads about CEREC crowns | Web | Analytics | Scroll depth (85%), time on page (2:34), pages viewed (3) | Trigger engagement milestone |
| 4 | V-FACE widget greeting appears after 5s | Web (V-FACE) | Receptionist AI | Widget impression, greeting displayed | Wait for interaction |
| 5 | Patient clicks V-FACE, asks about new patient specials | V-FACE Chat | Receptionist AI | Intent: new patient inquiry, message content, timestamp | Qualify and offer booking |
| 6 | AI collects name, phone, insurance info | V-FACE Chat | Receptionist AI | Full name, phone, email, insurance carrier, preferred time | Pre-qualify for appointment |
| 7 | AI books appointment for Tuesday 10 AM | V-FACE Chat | Receptionist AI | Appointment date/time, service type, doctor assignment | Send confirmation |
| 8 | Confirmation SMS + email sent automatically | SMS/Email | Automation | Delivery status, open/click tracking | Schedule reminders |
| 9 | Reminder SMS 24 hours before appointment | SMS | Automation | Delivery confirmation | Pre-visit form trigger |
| 10 | Patient arrives, completes treatment | In-office | None | Treatment type, value ($450), completion | Post-visit follow-up |
| 11 | Post-visit satisfaction survey (SMS) | SMS | Automation | NPS score (9/10), feedback text | Trigger review request |
| 12 | Google review request sent (if NPS >= 8) | Email/SMS | Automation | Review link clicked, review posted | Add to recall system |

### Conversion Optimization Notes
- **Landing page**: Ensure mobile-first design with phone number prominently displayed
- **V-FACE timing**: Test 3s vs 5s auto-greeting delay (A/B test proposed)
- **Insurance question**: Asking early qualifies and reduces no-shows by 23%
- **Confirmation cadence**: SMS immediately + email within 5 minutes for maximum engagement

---

## Journey Type 2: Invisalign Lead Qualification

### Touchpoint Timeline

| Stage | Touchpoint | Channel | AI Agent | Data Captured | Next Action |
|-------|-----------|---------|----------|---------------|-------------|
| 1 | Facebook ad: "Free Invisalign Consultation in Orlando" | Paid Social | None | fbclid, ad_id, ad_set, campaign, creative | Track with FB Pixel |
| 2 | Lands on Invisalign-specific landing page | Web | Analytics | UTM (source=facebook, medium=paid, campaign=invisalign_q1) | Track page view, score engagement |
| 3 | Watches Invisalign before/after video (autoplay) | Web | Analytics | Video start, 25%, 50%, 75%, 100% completion | High engagement signal |
| 4 | Clicks "Get My Free Consultation" CTA | Web | Analytics | CTA click event, button position, scroll position | Open form or V-FACE |
| 5 | Multi-step form: Step 1 (name + phone) | Web Form | None | First name, last name, phone number | Progress to step 2 |
| 6 | Multi-step form: Step 2 (smile concerns) | Web Form | None | Primary concern (crowding, gaps, bite), severity self-assessment | Progress to step 3 |
| 7 | Multi-step form: Step 3 (insurance + schedule) | Web Form | None | Insurance carrier, preferred day/time, urgency level | Submit and qualify |
| 8 | Form submitted — AI calls back within 2 minutes | Outbound Voice | Invisalign Qualifier AI | Confirmed interest, answered clinical questions, objection handling | Book consult or nurture |
| 9 | AI books free Invisalign consult with Dr. Nadine | Voice (V-TEAMS) | Invisalign Qualifier AI | Appointment confirmed, estimated case complexity (mild/moderate/complex) | Send confirmation |
| 10 | Pre-consult email with what-to-expect info | Email | Automation | Email opened, links clicked | Reduce no-show anxiety |
| 11 | Invisalign consultation in office | In-office | None | ClinCheck scan, treatment plan, quote ($3,500-$5,500) | Present treatment plan |
| 12 | Follow-up call if not booked same day | Outbound Voice | Invisalign Qualifier AI | Objections noted, follow-up scheduled, nurture sequence started | Re-engage or close |

### Conversion Optimization Notes
- **Facebook ad to form**: Keep form above fold, minimize friction with auto-fill
- **Multi-step form**: 3 steps outperforms single long form by 34% (industry benchmark)
- **Speed-to-lead**: 2-minute callback from AI dramatically increases conversion (78% answer rate)
- **Pre-consult nurture**: Send Invisalign FAQ + financing options to reduce sticker shock
- **Estimated case value**: $4,200 average (based on Orlando metro Invisalign pricing)

---

## Journey Type 3: Emergency Patient

### Touchpoint Timeline

| Stage | Touchpoint | Channel | AI Agent | Data Captured | Next Action |
|-------|-----------|---------|----------|---------------|-------------|
| 1 | Google search: "emergency dentist near me open now" | Organic | None | Search query, time of day, device (usually mobile) | Track high-intent visit |
| 2 | Lands on site, immediately sees phone number | Web | Analytics | Bounce risk: high. Time-to-action is critical (<15 seconds) | Present clear CTA |
| 3a | Calls (407) 877-9003 | Inbound Voice | Emergency Triage AI | Caller ID, call time, initial greeting | Triage urgency |
| 3b | Clicks V-FACE widget with "Emergency" keyword | V-FACE Chat | Emergency Triage AI | Message: emergency intent detected | Rapid triage flow |
| 4 | AI asks structured triage questions | Voice/Chat | Emergency Triage AI | Pain level (1-10), symptom type, onset time, location, swelling Y/N | Assess severity |
| 5 | AI determines severity: HIGH (severe pain + swelling) | Voice/Chat | Emergency Triage AI | Severity score, recommended action (same-day, next-day, ER referral) | Route appropriately |
| 6 | Same-day appointment booked | Voice/Chat | Emergency Triage AI | Emergency slot reserved, provider alerted via SMS | Send confirmation |
| 7 | Immediate SMS confirmation with directions | SMS | Automation | Confirmation delivered, directions to 2704 Rew Circle, Suite 103 | Track arrival |
| 8 | Emergency treatment completed | In-office | None | Treatment type (extraction, temp crown, etc.), value, follow-up plan | Schedule follow-up |
| 9 | Follow-up appointment booked during visit | In-office/Voice | Receptionist AI | Follow-up date, treatment plan continuation | Add to recall system |

### Conversion Optimization Notes
- **Speed is everything**: Emergency patients convert at 72% if answered within 30 seconds
- **Triage protocol**: AI must have clear escalation paths (ER referral for life-threatening situations)
- **After-hours**: Route to emergency voicemail with callback promise within 15 minutes
- **High-value conversion**: Emergency patients who receive good care have 85% retention rate
- **Average emergency case value**: $650 (extraction $350, emergency crown $850, root canal $900)

---

## Journey Type 4: Dormant Patient Reactivation

### Touchpoint Timeline

| Stage | Touchpoint | Channel | AI Agent | Data Captured | Next Action |
|-------|-----------|---------|----------|---------------|-------------|
| 1 | PMS flags patients with no visit in 6+ months | System | Automation | Last visit date, treatment history, outstanding treatment plan, balance | Generate outreach list |
| 2 | AI call campaign: personalized outreach | Outbound Voice | Outbound Revival AI | Call attempt time, answer/no-answer/voicemail | If answered: engage. If VM: leave message |
| 3a | Patient answers — AI uses personalized script | Outbound Voice | Outbound Revival AI | Patient confirmed identity, interest level, scheduling barriers | Address objections, offer booking |
| 3b | Voicemail left — "We miss you at Family Orlando Dentistry" | Outbound Voice | Outbound Revival AI | Voicemail delivered, callback number provided | Wait 48h for callback, then SMS |
| 4 | Follow-up SMS with booking link | SMS | Automation | SMS delivered, link clicked, booking started | Track conversion |
| 5 | Patient books recall cleaning appointment | Web/Voice | Receptionist AI | Appointment type (cleaning/exam), preferred date, insurance update needed | Send confirmation |
| 6 | Pre-visit: insurance verification if needed | Phone/System | Automation | Insurance status (active/expired/changed), coverage details | Update records |
| 7 | Patient completes cleaning + exam | In-office | None | Treatment completed, new treatment plan identified (if any), recall set | Post-visit follow-up |
| 8 | If new treatment needed: follow-up call to schedule | Outbound Voice | Receptionist AI | Treatment presented, acceptance/decline, scheduling | Nurture if declined |

### Conversion Optimization Notes
- **Optimal call times**: Tuesday-Thursday, 10 AM-12 PM and 2 PM-4 PM (highest answer rates)
- **Personalization is key**: Reference last visit, last provider, any outstanding treatment
- **Reactivation success rate target**: 18-22% of dormant patients return within 30 days
- **Average reactivated patient value**: $380 first visit, $1,200 annual (cleaning + treatment)
- **Do not call**: Respect opt-outs, check against DNC registry, maintain suppression list

---

## Agent Roles and Responsibilities

### Receptionist AI (V-TEAMS Inbound + V-FACE Chat)
- **Primary function**: Answer inbound calls and web chats 24/7
- **Capabilities**: Appointment scheduling, insurance pre-verification, FAQ answers, call routing
- **Escalation**: Transfer to human staff for complex insurance, billing disputes, or clinical questions
- **KPIs**: Answer rate (>95%), booking conversion (>40%), avg handle time (<4 min), CSAT (>4.5/5)

### Invisalign Qualifier AI (V-TEAMS Outbound + Inbound)
- **Primary function**: Qualify Invisalign leads from paid ads and web forms
- **Capabilities**: Clinical pre-screening, objection handling, financing discussion, consult booking
- **Escalation**: Transfer to treatment coordinator for complex cases or immediate closing
- **KPIs**: Speed-to-lead (<2 min), qualification rate (>60%), consult booking rate (>35%), show rate (>80%)

### Emergency Triage AI (V-TEAMS Inbound + V-FACE)
- **Primary function**: Rapidly assess dental emergencies and route appropriately
- **Capabilities**: Structured triage questionnaire, severity scoring, same-day scheduling, ER referral
- **Escalation**: Immediate doctor notification for high-severity cases
- **KPIs**: Triage time (<90 sec), appropriate routing (>95%), same-day booking rate (>70%), patient safety (zero incidents)

### Outbound Revival AI (V-TEAMS Outbound)
- **Primary function**: Reactivate dormant patients (6+ months since last visit)
- **Capabilities**: Personalized outreach, recall scheduling, voicemail delivery, SMS follow-up
- **Escalation**: Flag patients needing special attention (outstanding balance, complex treatment plans)
- **KPIs**: Answer rate (>30%), reactivation rate (>18%), voicemail-to-callback (>8%), opt-out rate (<2%)

---

## KPI Definitions by Journey Stage

| KPI | Definition | Target | Measurement |
|-----|-----------|--------|-------------|
| **Website Visit Rate** | Unique visitors per month | 2,500 | GA4 users metric |
| **Engagement Rate** | Visitors reaching engagement threshold (>30s or >30% scroll) | 65% | Custom engagement event |
| **Form Start Rate** | Visitors who begin a form / engaged visitors | 12% | Form focus event tracking |
| **Form Completion Rate** | Form submissions / form starts | 70% | Form submit event tracking |
| **V-FACE Activation Rate** | Visitors who interact with V-FACE widget | 8% | V-FACE session start event |
| **V-FACE Conversation Rate** | V-FACE sessions with 3+ message exchanges | 65% | V-FACE conversation event |
| **Contact-to-Booking Rate** | Booking requests / total contacts (form + phone + V-FACE) | 45% | Booking request event |
| **Booking-to-Confirmation Rate** | Confirmed appointments / booking requests | 85% | Appointment confirmed event |
| **Show Rate** | Patients who arrive / confirmed appointments | 88% | PMS check-in data |
| **Treatment Acceptance Rate** | Treatments accepted / treatments presented | 62% | PMS treatment plan data |
| **Average Case Value** | Revenue per completed appointment | $380 | PMS billing data |
| **Patient Lifetime Value** | Total revenue per patient over 3 years | $2,800 | PMS historical analysis |
| **Reactivation Rate** | Dormant patients returning within 30 days of outreach | 18% | Outbound campaign tracking |
| **Net Promoter Score** | Post-visit satisfaction survey result | > 70 | Survey tracking |
| **Cost Per Acquisition** | Total marketing + AI cost / new patients acquired | < $85 | Financial reporting |

---

## Automation Triggers and Workflows

### Real-Time Triggers

| Trigger | Condition | Action | Delay |
|---------|-----------|--------|-------|
| V-FACE Greeting | Visitor on page > 5 seconds + scrolled > 20% | Display V-FACE widget greeting | 0s |
| High-Intent Alert | Engagement score > 80 + Invisalign page view | Prioritize V-FACE routing to Invisalign Qualifier | 0s |
| Emergency Detection | Keywords: "emergency", "pain", "broken", "swelling" in V-FACE or IVR | Route to Emergency Triage AI | 0s |
| Speed-to-Lead | New form submission with phone number | Outbound AI call to lead | < 2 min |
| Missed Call Recovery | Inbound call not answered within 3 rings | SMS: "Sorry we missed your call. Book online or we will call you back." | 30s |
| Form Abandonment | Form started but not completed within 10 minutes | V-FACE proactive message: "Need help completing your form?" | 10 min |

### Scheduled Workflows

| Workflow | Schedule | Agent | Action |
|----------|----------|-------|--------|
| Appointment Reminders | 48h + 24h + 2h before appointment | Automation (SMS) | Send reminder with confirm/reschedule options |
| No-Show Follow-Up | 1 hour after missed appointment | Outbound Revival AI | Call to reschedule, understand reason |
| Post-Visit Survey | 2 hours after appointment | Automation (SMS) | NPS survey + review request (if score >= 8) |
| Dormant Patient Outreach | Weekly batch (Tue/Thu mornings) | Outbound Revival AI | Personalized reactivation calls |
| Insurance Renewal Check | Monthly (1st of month) | Automation | Flag patients with insurance expiring in 30 days |
| Recall Reminder | 5.5 months after last cleaning | Automation (SMS) then Outbound AI | SMS first, phone call if no response in 5 days |
| Birthday Greeting | On patient birthday | Automation (SMS/Email) | Personalized message with special offer |
| Treatment Plan Follow-Up | 14 days after unaccepted treatment presentation | Outbound Revival AI | Call to address questions and re-present treatment |

### Webhook Integrations

| Source | Event | Destination | Action |
|--------|-------|-------------|--------|
| Website Form | form_complete | Retell API | Trigger outbound qualification call |
| V-FACE Widget | booking_request | PMS API | Create appointment hold |
| Retell (V-TEAMS) | call_ended | CRM + Analytics | Log call data, update patient record |
| PMS | appointment_confirmed | SMS Gateway | Send confirmation message |
| PMS | appointment_completed | Analytics + Survey | Track completion, trigger post-visit survey |
| Survey Platform | nps_response | CRM + Google Reviews | Route high-NPS to review request flow |
| PMS | patient_dormant (6mo) | Outbound Campaign | Add to reactivation list |

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PATIENT TOUCHPOINTS                      │
│                                                                 │
│   Website    Phone Call    V·FACE Chat    SMS    Email   Walk-in│
└──────┬────────────┬────────────┬──────────┬───────┬──────┬──────┘
       │            │            │          │       │      │
       v            v            v          v       v      v
┌─────────────────────────────────────────────────────────────────┐
│                     VOXARIS AI LAYER                             │
│                                                                 │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │Receptionist│  │Invisalign │  │Emergency │  │  Outbound    │  │
│  │   AI      │  │Qualifier  │  │ Triage   │  │  Revival AI  │  │
│  │ (V·TEAMS) │  │   AI      │  │   AI     │  │  (V·TEAMS)   │  │
│  └─────┬─────┘  └─────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│        └───────────────┴─────────────┴───────────────┘          │
│                            │                                     │
│                     Retell Platform                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             v
┌─────────────────────────────────────────────────────────────────┐
│                     DATA & ANALYTICS LAYER                      │
│                                                                 │
│  ┌────────────┐  ┌───────────┐  ┌────────────┐  ┌───────────┐ │
│  │  GA4       │  │ Voxaris   │  │  Patient   │  │  Retell   │ │
│  │ Analytics  │  │ Command   │  │  Journey   │  │  Call     │ │
│  │            │  │ Dashboard │  │  Tracker   │  │  Logs     │ │
│  └────────────┘  └───────────┘  └────────────┘  └───────────┘ │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              v
┌─────────────────────────────────────────────────────────────────┐
│                    PRACTICE MANAGEMENT                           │
│                                                                 │
│  ┌────────────┐  ┌───────────┐  ┌────────────┐  ┌───────────┐ │
│  │   PMS      │  │  Billing  │  │  Insurance │  │  Recall   │ │
│  │  System    │  │  System   │  │  Verify    │  │  System   │ │
│  └────────────┘  └───────────┘  └────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Conversion Optimization Playbook

### Stage: Website Visit to Page Engagement
- **Current**: 58% engagement rate
- **Target**: 65%
- **Tactics**:
  - Reduce LCP to < 2.0s (currently 2.8s)
  - Add compelling above-fold content with clear value proposition
  - Implement progressive image loading
  - A/B test hero section copy and imagery

### Stage: Page Engagement to Form Start
- **Current**: 9% form start rate
- **Target**: 12%
- **Tactics**:
  - Reduce form to 3 visible fields initially (name, phone, service)
  - Add social proof near form (Google rating, patient count)
  - Test sticky mobile CTA bar
  - Implement exit-intent popup with special offer

### Stage: Form Start to Form Complete
- **Current**: 62% completion rate
- **Target**: 70%
- **Tactics**:
  - Multi-step form with progress indicator
  - Auto-save form data on each step
  - Add real-time validation with friendly error messages
  - Test form length: 3-step vs 5-step (A/B test proposed)

### Stage: Contact to Booking Request
- **Current**: 38% booking rate
- **Target**: 45%
- **Tactics**:
  - Speed-to-lead: AI callback within 2 minutes of form submission
  - V-FACE: proactive booking suggestion after qualifying questions
  - Phone: AI immediately offers available appointment slots
  - Reduce friction: "We have a slot available tomorrow at 10 AM — would that work?"

### Stage: Booking to Confirmation
- **Current**: 80% confirmation rate
- **Target**: 85%
- **Tactics**:
  - Instant SMS confirmation with calendar add link
  - Follow-up email with what-to-expect information
  - 48-hour and 24-hour reminders with easy reschedule option
  - Reduce no-shows with pre-visit engagement sequence

### Stage: Confirmation to Treatment Completed
- **Current**: 85% show rate
- **Target**: 88%
- **Tactics**:
  - 2-hour pre-appointment reminder with directions
  - Offer virtual check-in to reduce wait time anxiety
  - Text-to-reschedule instead of no-show
  - Morning-of personalized message from the doctor's practice

---

## Revenue Impact Model

```
Monthly website visitors:                    2,500
  x Engagement rate (65%):                   1,625
  x Contact rate (15% of engaged):             244
  x Booking rate (45% of contacts):            110
  x Show rate (88%):                            97
  x Treatment acceptance (62%):                 60
  x Average case value ($380):            $22,800/mo

Annual projected revenue from AI pipeline: $273,600

Monthly AI cost (Voxaris platform):         $1,497
Monthly marketing spend:                    $2,500
Total monthly cost:                         $3,997

Monthly ROI: $22,800 / $3,997 = 570%
Annual net revenue impact: $273,600 - $47,964 = $225,636
```

---

## Measurement and Reporting

### Daily Metrics (Automated Dashboard)
- Inbound calls answered / missed
- V-FACE sessions started / converted
- Forms submitted
- Appointments booked
- Emergency triages handled

### Weekly Report (Sent Monday AM)
- Funnel conversion rates (week-over-week trend)
- Agent performance scores
- Revenue attribution by channel
- Top-performing landing pages
- Anomaly alerts (significant drops in any metric)

### Monthly Business Review
- Full funnel analysis with month-over-month comparison
- ROI calculation with actual revenue data from PMS
- Patient acquisition cost by channel
- Lifetime value cohort analysis
- Reactivation campaign results
- A/B test results and next experiments
- Recommendations for next month's optimization priorities
