/**
 * ============================================================================
 * Voxaris Analytics Snippet — Family Orlando Dentistry
 * ============================================================================
 * Comprehensive analytics tracking for patient journey, funnel conversion,
 * engagement scoring, and multi-channel attribution.
 *
 * Usage: Include this script on every page of the dental practice website.
 *   <script src="analytics-snippet.js"></script>
 *
 * Configuration:
 *   - Set GA4_MEASUREMENT_ID to your Google Analytics 4 property ID
 *   - Set FB_PIXEL_ID to your Facebook Pixel ID
 *   - Set DEMO_MODE to false in production
 * ============================================================================
 */

(function () {
  'use strict';

  // ─── Configuration ─────────────────────────────────────────────────────────
  const CONFIG = {
    GA4_MEASUREMENT_ID: 'G-XXXXXXXXXX',
    FB_PIXEL_ID: 'XXXXXXXXXXXXXXX',
    DEMO_MODE: true,
    DEBUG: true,
    SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
    ENGAGEMENT_THRESHOLDS: {
      LOW: 20,
      MEDIUM: 50,
      HIGH: 80,
    },
    SCROLL_DEPTH_INTERVALS: [25, 50, 75, 90, 100],
    STORAGE_PREFIX: 'vox_fod_',
  };

  // ─── Utility Helpers ───────────────────────────────────────────────────────
  function log(category, message, data) {
    if (!CONFIG.DEBUG && !CONFIG.DEMO_MODE) return;
    const timestamp = new Date().toISOString().slice(11, 23);
    const style = 'color:#d4a843;font-weight:bold;';
    console.log(
      `%c[Voxaris Analytics ${timestamp}]%c [${category}] ${message}`,
      style,
      'color:inherit;',
      data || ''
    );
  }

  function generateId() {
    return 'vox_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function getStorage(key) {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setStorage(key, value) {
    try {
      localStorage.setItem(CONFIG.STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      log('Storage', 'Failed to write', { key, error: e.message });
    }
  }

  function removeStorage(key) {
    try {
      localStorage.removeItem(CONFIG.STORAGE_PREFIX + key);
    } catch (e) {}
  }

  // ─── UTM Parameter Parsing ─────────────────────────────────────────────────
  const UTM = (function () {
    const PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    const EXTRA_PARAMS = ['gclid', 'fbclid', 'msclkid', 'ref'];

    function parse() {
      const url = new URL(window.location.href);
      const utmData = {};
      let hasUtm = false;

      PARAMS.concat(EXTRA_PARAMS).forEach(function (param) {
        const val = url.searchParams.get(param);
        if (val) {
          utmData[param] = val;
          hasUtm = true;
        }
      });

      if (hasUtm) {
        utmData._captured_at = new Date().toISOString();
        utmData._landing_page = window.location.pathname;
        setStorage('utm', utmData);
        log('UTM', 'Parameters captured', utmData);
      }

      return utmData;
    }

    function get() {
      return getStorage('utm') || {};
    }

    function getSource() {
      const utm = get();
      if (utm.gclid) return 'google_ads';
      if (utm.fbclid) return 'facebook_ads';
      if (utm.msclkid) return 'microsoft_ads';
      if (utm.utm_source) return utm.utm_source;
      const ref = document.referrer;
      if (!ref) return 'direct';
      if (ref.includes('google.com')) return 'organic_google';
      if (ref.includes('bing.com')) return 'organic_bing';
      if (ref.includes('facebook.com')) return 'social_facebook';
      if (ref.includes('instagram.com')) return 'social_instagram';
      if (ref.includes('yelp.com')) return 'referral_yelp';
      if (ref.includes('healthgrades.com')) return 'referral_healthgrades';
      return 'referral_other';
    }

    return { parse: parse, get: get, getSource: getSource };
  })();

  // ─── Session Management ────────────────────────────────────────────────────
  const Session = (function () {
    function getCurrent() {
      const session = getStorage('session');
      if (session && Date.now() - session.last_active < CONFIG.SESSION_TIMEOUT_MS) {
        return session;
      }
      return createNew();
    }

    function createNew() {
      const visitorId = getStorage('visitor_id') || generateId();
      setStorage('visitor_id', visitorId);

      const sessionCount = (getStorage('session_count') || 0) + 1;
      setStorage('session_count', sessionCount);

      const session = {
        session_id: generateId(),
        visitor_id: visitorId,
        session_number: sessionCount,
        started_at: new Date().toISOString(),
        last_active: Date.now(),
        page_views: 0,
        events: [],
        engagement_score: 0,
        source: UTM.getSource(),
        utm: UTM.get(),
        referrer: document.referrer || 'direct',
        device: detectDevice(),
        funnel_steps: [],
      };

      setStorage('session', session);
      log('Session', 'New session started', { id: session.session_id, number: sessionCount });
      return session;
    }

    function update(updates) {
      const session = getCurrent();
      Object.assign(session, updates, { last_active: Date.now() });
      setStorage('session', session);
      return session;
    }

    function addEvent(eventName, data) {
      const session = getCurrent();
      session.events.push({
        event: eventName,
        data: data,
        timestamp: new Date().toISOString(),
      });
      session.last_active = Date.now();
      setStorage('session', session);
    }

    function addFunnelStep(step) {
      const session = getCurrent();
      if (!session.funnel_steps.includes(step)) {
        session.funnel_steps.push(step);
        session.last_active = Date.now();
        setStorage('session', session);
        log('Funnel', 'Step completed: ' + step, { steps: session.funnel_steps });
      }
    }

    function detectDevice() {
      const ua = navigator.userAgent;
      if (/Mobi|Android/i.test(ua)) return 'mobile';
      if (/Tablet|iPad/i.test(ua)) return 'tablet';
      return 'desktop';
    }

    return {
      getCurrent: getCurrent,
      update: update,
      addEvent: addEvent,
      addFunnelStep: addFunnelStep,
    };
  })();

  // ─── Engagement Scoring ────────────────────────────────────────────────────
  const Engagement = (function () {
    let score = 0;
    let maxScrollDepth = 0;
    let timeOnPage = 0;
    let interactions = 0;
    let startTime = Date.now();
    let scrollDepthsReported = new Set();

    const SCORING = {
      page_view: 5,
      scroll_25: 3,
      scroll_50: 5,
      scroll_75: 8,
      scroll_90: 10,
      scroll_100: 12,
      time_30s: 5,
      time_60s: 8,
      time_120s: 12,
      time_300s: 15,
      click_cta: 15,
      click_phone: 20,
      form_start: 20,
      form_complete: 30,
      vface_start: 25,
      vface_conversation: 35,
      booking_request: 40,
    };

    function addPoints(action) {
      const pts = SCORING[action] || 0;
      if (pts > 0) {
        score += pts;
        Session.update({ engagement_score: score });
        log('Engagement', `+${pts} pts for ${action}`, { total: score, level: getLevel() });
      }
    }

    function getLevel() {
      if (score >= CONFIG.ENGAGEMENT_THRESHOLDS.HIGH) return 'high';
      if (score >= CONFIG.ENGAGEMENT_THRESHOLDS.MEDIUM) return 'medium';
      if (score >= CONFIG.ENGAGEMENT_THRESHOLDS.LOW) return 'low';
      return 'minimal';
    }

    function getScore() {
      return { score: score, level: getLevel(), time_on_page: timeOnPage, max_scroll: maxScrollDepth, interactions: interactions };
    }

    // Track scroll depth
    function initScrollTracking() {
      let ticking = false;
      window.addEventListener('scroll', function () {
        if (!ticking) {
          requestAnimationFrame(function () {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (docHeight > 0) {
              const percent = Math.round((scrollTop / docHeight) * 100);
              if (percent > maxScrollDepth) {
                maxScrollDepth = percent;
              }
              CONFIG.SCROLL_DEPTH_INTERVALS.forEach(function (threshold) {
                if (percent >= threshold && !scrollDepthsReported.has(threshold)) {
                  scrollDepthsReported.add(threshold);
                  addPoints('scroll_' + threshold);
                  trackEvent('scroll_depth', { depth: threshold, page: window.location.pathname });
                }
              });
            }
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    }

    // Track time on page
    function initTimeTracking() {
      const TIME_MILESTONES = [30, 60, 120, 300];
      const reported = new Set();
      setInterval(function () {
        timeOnPage = Math.round((Date.now() - startTime) / 1000);
        TIME_MILESTONES.forEach(function (sec) {
          if (timeOnPage >= sec && !reported.has(sec)) {
            reported.add(sec);
            addPoints('time_' + sec + 's');
            trackEvent('time_on_page', { seconds: sec, page: window.location.pathname });
          }
        });
      }, 5000);
    }

    // Track user interactions (clicks)
    function initInteractionTracking() {
      document.addEventListener('click', function (e) {
        interactions++;
        const target = e.target.closest('a, button, [role="button"], input[type="submit"]');
        if (!target) return;

        // Phone click
        const href = target.getAttribute('href') || '';
        if (href.startsWith('tel:')) {
          addPoints('click_phone');
          trackEvent('phone_call_click', {
            phone_number: href.replace('tel:', ''),
            element: target.textContent.trim().slice(0, 50),
          });
          Session.addFunnelStep('phone_call_click');
        }

        // CTA buttons
        const text = (target.textContent || '').toLowerCase().trim();
        const ctaKeywords = ['book', 'schedule', 'appointment', 'consult', 'call', 'get started', 'free'];
        if (ctaKeywords.some(function (kw) { return text.includes(kw); })) {
          addPoints('click_cta');
          trackEvent('cta_click', {
            text: target.textContent.trim().slice(0, 50),
            href: href.slice(0, 200),
            page: window.location.pathname,
          });
        }
      });
    }

    return {
      addPoints: addPoints,
      getLevel: getLevel,
      getScore: getScore,
      initScrollTracking: initScrollTracking,
      initTimeTracking: initTimeTracking,
      initInteractionTracking: initInteractionTracking,
    };
  })();

  // ─── Funnel Definitions ────────────────────────────────────────────────────
  const FUNNEL_STEPS = [
    'website_visit',
    'page_engagement',
    'form_start',
    'form_complete',
    'vface_session_start',
    'vface_conversation',
    'booking_request',
    'appointment_confirmed',
    'treatment_completed',
  ];

  // ─── GA4 Integration ───────────────────────────────────────────────────────
  function initGA4() {
    if (CONFIG.DEMO_MODE) {
      log('GA4', 'Demo mode active — GA4 script not loaded');
      return;
    }

    // Load gtag.js
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + CONFIG.GA4_MEASUREMENT_ID;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', CONFIG.GA4_MEASUREMENT_ID, {
      send_page_view: true,
      cookie_flags: 'SameSite=None;Secure',
      custom_map: {
        dimension1: 'engagement_level',
        dimension2: 'traffic_source',
        dimension3: 'funnel_step',
        dimension4: 'agent_type',
      },
    });

    // Define conversion events
    var conversionEvents = [
      'form_complete',
      'vface_session_start',
      'booking_request',
      'appointment_confirmed',
      'phone_call_click',
    ];
    conversionEvents.forEach(function (evt) {
      log('GA4', 'Conversion event registered: ' + evt);
    });

    log('GA4', 'Initialized with ID ' + CONFIG.GA4_MEASUREMENT_ID);
  }

  // ─── Facebook Pixel Integration ────────────────────────────────────────────
  function initFBPixel() {
    if (CONFIG.DEMO_MODE) {
      log('Facebook Pixel', 'Demo mode active — Pixel not loaded');
      return;
    }

    /* eslint-disable */
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */

    window.fbq('init', CONFIG.FB_PIXEL_ID);
    window.fbq('track', 'PageView');

    log('Facebook Pixel', 'Initialized with ID ' + CONFIG.FB_PIXEL_ID);
  }

  // ─── Core Event Tracking ───────────────────────────────────────────────────
  function trackEvent(eventName, eventData) {
    const session = Session.getCurrent();
    const enrichedData = Object.assign({}, eventData || {}, {
      session_id: session.session_id,
      visitor_id: session.visitor_id,
      session_number: session.session_number,
      engagement_level: Engagement.getLevel(),
      traffic_source: session.source,
      device: session.device,
      page_url: window.location.href,
      page_path: window.location.pathname,
      timestamp: new Date().toISOString(),
    });

    // UTM enrichment
    var utm = UTM.get();
    if (utm.utm_source) {
      enrichedData.utm_source = utm.utm_source;
      enrichedData.utm_medium = utm.utm_medium;
      enrichedData.utm_campaign = utm.utm_campaign;
    }

    // Send to GA4
    if (window.gtag && !CONFIG.DEMO_MODE) {
      window.gtag('event', eventName, enrichedData);
    }

    // Send to Facebook Pixel (map to FB standard events)
    if (window.fbq && !CONFIG.DEMO_MODE) {
      var fbEventMap = {
        form_complete: 'Lead',
        booking_request: 'Schedule',
        appointment_confirmed: 'CompleteRegistration',
        phone_call_click: 'Contact',
        vface_session_start: 'ViewContent',
      };
      if (fbEventMap[eventName]) {
        window.fbq('track', fbEventMap[eventName], enrichedData);
      } else {
        window.fbq('trackCustom', eventName, enrichedData);
      }
    }

    // Session tracking
    Session.addEvent(eventName, eventData);

    // Funnel step tracking
    if (FUNNEL_STEPS.includes(eventName)) {
      Session.addFunnelStep(eventName);
    }

    // Console logging for demo / debug
    log('Event', eventName, enrichedData);

    return enrichedData;
  }

  // ─── Public API: Track Functions ───────────────────────────────────────────

  /**
   * Track a standard page view. Called automatically on load.
   */
  function trackPageView(pageData) {
    var session = Session.getCurrent();
    session.page_views = (session.page_views || 0) + 1;
    Session.update({ page_views: session.page_views });
    Session.addFunnelStep('website_visit');
    Engagement.addPoints('page_view');

    return trackEvent('page_view', Object.assign({
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname,
      page_referrer: document.referrer,
      session_page_views: session.page_views,
    }, pageData));
  }

  /**
   * Track when a user begins filling out a form.
   */
  function trackFormStart(formData) {
    Session.addFunnelStep('form_start');
    Engagement.addPoints('form_start');

    return trackEvent('form_start', Object.assign({
      form_id: 'unknown',
      form_name: 'contact_form',
      form_type: 'general',
    }, formData));
  }

  /**
   * Track when a user completes and submits a form.
   */
  function trackFormComplete(formData) {
    Session.addFunnelStep('form_complete');
    Engagement.addPoints('form_complete');

    return trackEvent('form_complete', Object.assign({
      form_id: 'unknown',
      form_name: 'contact_form',
      form_type: 'general',
      conversion_value: 50,
    }, formData));
  }

  /**
   * Track when a V-FACE chat session begins.
   */
  function trackVFaceSessionStart(data) {
    Session.addFunnelStep('vface_session_start');
    Engagement.addPoints('vface_start');

    return trackEvent('vface_session_start', Object.assign({
      agent_type: 'receptionist',
      trigger: 'user_initiated',
    }, data));
  }

  /**
   * Track an active V-FACE conversation exchange.
   */
  function trackVFaceConversation(data) {
    Session.addFunnelStep('vface_conversation');
    Engagement.addPoints('vface_conversation');

    return trackEvent('vface_conversation', Object.assign({
      agent_type: 'receptionist',
      message_count: 0,
      duration_seconds: 0,
      intent_detected: 'unknown',
    }, data));
  }

  /**
   * Track a booking/appointment request.
   */
  function trackBookingRequest(data) {
    Session.addFunnelStep('booking_request');
    Engagement.addPoints('booking_request');

    return trackEvent('booking_request', Object.assign({
      service_type: 'general',
      preferred_date: '',
      preferred_time: '',
      source_agent: 'web_form',
      estimated_value: 250,
    }, data));
  }

  /**
   * Track a phone call click (tel: link).
   */
  function trackPhoneCallClick(data) {
    Session.addFunnelStep('phone_call_click');

    return trackEvent('phone_call_click', Object.assign({
      phone_number: '(407) 877-9003',
      call_source: 'website',
      page: window.location.pathname,
    }, data));
  }

  /**
   * Track an emergency triage interaction.
   */
  function trackEmergencyTriage(data) {
    return trackEvent('emergency_triage', Object.assign({
      severity: 'unknown',
      symptom: '',
      recommended_action: '',
      agent_type: 'emergency_triage',
    }, data));
  }

  /**
   * Track appointment confirmation (from backend callback or webhook).
   */
  function trackAppointmentConfirmed(data) {
    Session.addFunnelStep('appointment_confirmed');

    return trackEvent('appointment_confirmed', Object.assign({
      appointment_type: 'general',
      doctor: '',
      estimated_value: 250,
    }, data));
  }

  /**
   * Track treatment completion (from backend callback or webhook).
   */
  function trackTreatmentCompleted(data) {
    Session.addFunnelStep('treatment_completed');

    return trackEvent('treatment_completed', Object.assign({
      treatment_type: 'general',
      actual_value: 0,
      doctor: '',
      satisfaction_score: null,
    }, data));
  }

  // ─── Auto-detect Form Interactions ─────────────────────────────────────────
  function initFormTracking() {
    var formStarted = new Set();

    document.addEventListener('focusin', function (e) {
      var form = e.target.closest('form');
      if (form && !formStarted.has(form)) {
        formStarted.add(form);
        trackFormStart({
          form_id: form.id || form.getAttribute('data-form-id') || 'auto_detected',
          form_name: form.getAttribute('name') || form.getAttribute('data-form-name') || 'unknown',
        });
      }
    });

    document.addEventListener('submit', function (e) {
      var form = e.target.closest('form');
      if (form) {
        trackFormComplete({
          form_id: form.id || form.getAttribute('data-form-id') || 'auto_detected',
          form_name: form.getAttribute('name') || form.getAttribute('data-form-name') || 'unknown',
        });
      }
    });

    log('FormTracking', 'Auto-detection initialized');
  }

  // ─── Page Engagement Tracking ──────────────────────────────────────────────
  function initPageEngagement() {
    var engagementTimer;
    var engaged = false;

    function markEngaged() {
      if (!engaged) {
        engaged = true;
        Session.addFunnelStep('page_engagement');
        trackEvent('page_engagement', {
          time_to_engage: Math.round((Date.now() - pageLoadTime) / 1000),
          page: window.location.pathname,
        });
      }
    }

    var pageLoadTime = Date.now();

    // Engaged after 10 seconds active on page
    engagementTimer = setTimeout(markEngaged, 10000);

    // Or after significant scroll
    var scrollEngaged = false;
    window.addEventListener('scroll', function () {
      if (!scrollEngaged) {
        var scrollPercent = (window.pageYOffset / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
        if (scrollPercent > 30) {
          scrollEngaged = true;
          markEngaged();
        }
      }
    }, { passive: true });
  }

  // ─── Expose Public API ─────────────────────────────────────────────────────
  window.VoxarisAnalytics = {
    // Tracking functions
    trackPageView: trackPageView,
    trackFormStart: trackFormStart,
    trackFormComplete: trackFormComplete,
    trackVFaceSessionStart: trackVFaceSessionStart,
    trackVFaceConversation: trackVFaceConversation,
    trackBookingRequest: trackBookingRequest,
    trackPhoneCallClick: trackPhoneCallClick,
    trackEmergencyTriage: trackEmergencyTriage,
    trackAppointmentConfirmed: trackAppointmentConfirmed,
    trackTreatmentCompleted: trackTreatmentCompleted,
    trackEvent: trackEvent,

    // Session and engagement
    getSession: Session.getCurrent,
    getEngagement: Engagement.getScore,

    // UTM
    getUTM: UTM.get,
    getSource: UTM.getSource,

    // Funnel
    FUNNEL_STEPS: FUNNEL_STEPS,

    // Configuration
    CONFIG: CONFIG,
  };

  // ─── Initialize ────────────────────────────────────────────────────────────
  function init() {
    log('Init', 'Voxaris Analytics initializing...');

    // Parse UTMs first
    UTM.parse();

    // Initialize session
    Session.getCurrent();

    // Initialize GA4 and Facebook Pixel
    initGA4();
    initFBPixel();

    // Start engagement tracking
    Engagement.initScrollTracking();
    Engagement.initTimeTracking();
    Engagement.initInteractionTracking();

    // Start form tracking
    initFormTracking();

    // Start page engagement tracking
    initPageEngagement();

    // Track initial page view
    trackPageView();

    log('Init', 'Voxaris Analytics ready', {
      session: Session.getCurrent().session_id,
      source: UTM.getSource(),
      device: Session.getCurrent().device,
      demo_mode: CONFIG.DEMO_MODE,
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
