/**
 * FAQ content for /help.
 *
 * Source of truth: docs/USER_JOURNEY.md and IMPLEMENTATION_PLAN.md Task 5.5.
 *
 * Pricing placeholders match `for-coaching-centres/page.tsx` (₹149 / ₹299 per
 * student / month). Update both files together when final pricing lands.
 */

export type FaqTopic =
  | "Signup"
  | "Batches"
  | "Assignments"
  | "Billing"
  | "Parent reports"
  | "Team management"
  | "White-label"
  | "Mobile OTP";

export type FaqEntry = {
  id: string;
  topic: FaqTopic;
  question: string;
  answer: string;
};

export const FAQ_TOPICS: FaqTopic[] = [
  "Signup",
  "Batches",
  "Assignments",
  "Billing",
  "Parent reports",
  "Team management",
  "White-label",
  "Mobile OTP",
];

export const FAQ_ENTRIES: FaqEntry[] = [
  // Signup
  {
    id: "signup-trial-length",
    topic: "Signup",
    question: "How long is the free trial?",
    answer:
      "Every new coaching centre gets a 14-day trial with full access to the Growth plan — every feature, no card required. You can invite real students, run real assignments, and decide later whether to upgrade.",
  },
  {
    id: "signup-after-trial",
    topic: "Signup",
    question: "What happens when my trial ends?",
    answer:
      "Your centre moves into a 7-day grace period. Teachers can still log in and view existing data, but you can't create new batches or assignments until you pick a plan. After 7 grace days the account becomes read-only — nothing is deleted.",
  },
  {
    id: "signup-mobile-only",
    topic: "Signup",
    question: "Can I sign up with just a mobile number?",
    answer:
      "Centre owners need email + password at /coaching/signup so we can send billing receipts. Once you're signed up, you and your team can sign in with mobile OTP at /coaching/login. Students can join with mobile OTP too.",
  },
  {
    id: "signup-multiple-centres",
    topic: "Signup",
    question: "Can one email run multiple coaching centres?",
    answer:
      "Yes. Sign up each centre separately and use the same email — when you log in we'll ask which centre you want to open. Billing and student data stay completely separate.",
  },

  // Batches
  {
    id: "batches-add-students",
    topic: "Batches",
    question: "How do I add students to a batch?",
    answer:
      "Open the batch and pick one of two flows. Share the join link (or QR) so students can sign up themselves, or paste a roster of names + emails/mobiles and we'll send invites for you. Both options live on the setup wizard and on every batch detail page.",
  },
  {
    id: "batches-student-multiple",
    topic: "Batches",
    question: "Can a student be in more than one batch?",
    answer:
      "Yes. Add them to as many batches as you like — assignments, scores, and parent reports are tracked per batch so nothing gets mixed up.",
  },
  {
    id: "batches-limit",
    topic: "Batches",
    question: "How many batches can I create?",
    answer:
      "Starter allows 1 batch, Growth and Pro allow unlimited batches. The student-seat count on your plan is what actually caps growth — batches themselves are free.",
  },
  {
    id: "batches-remove-student",
    topic: "Batches",
    question: "What happens when I remove a student from a batch?",
    answer:
      "Their attempt history stays in the batch reports for your records, but they stop receiving new assignments and lose access to upcoming tests. Their personal Testquest account is untouched.",
  },

  // Assignments
  {
    id: "assignments-retake",
    topic: "Assignments",
    question: "Can students retake an assignment?",
    answer:
      "It depends on the test's retake setting. By default students get one attempt; you can allow multiple attempts with an optional cooldown (e.g. 24 hours) on the test settings screen.",
  },
  {
    id: "assignments-who-hasnt-started",
    topic: "Assignments",
    question: "Can I see who hasn't started an assignment?",
    answer:
      "Yes. The batch monitor page shows Not started / In progress / Submitted columns in real time, and you can nudge any student from there with a one-tap reminder.",
  },
  {
    id: "assignments-due-date",
    topic: "Assignments",
    question: "Can I extend the due date for one student?",
    answer:
      "Yes — open the batch monitor, click the student's row, and pick \"Extend deadline\". The new date applies only to that student, and parents see the updated date on their next report.",
  },

  // Billing
  {
    id: "billing-plans",
    topic: "Billing",
    question: "Which plans are available?",
    answer:
      "Starter is free for up to 50 students and 1 batch. Growth is ₹149 per student per month (billed annually) and adds unlimited batches, co-teachers, and branded reports. Pro is ₹299 per student per month and unlocks white-label, full mobile parent app, and priority support.",
  },
  {
    id: "billing-switch",
    topic: "Billing",
    question: "Can I switch plans later?",
    answer:
      "Yes, any time from /coaching/billing. Upgrades take effect immediately; downgrades take effect at the next renewal so you don't lose paid-for days.",
  },
  {
    id: "billing-payment-methods",
    topic: "Billing",
    question: "What payment methods do you accept?",
    answer:
      "We use Razorpay, which means UPI, debit/credit cards, netbanking, and most popular wallets. We don't store your card details — Razorpay handles all of that.",
  },
  {
    id: "billing-invoice",
    topic: "Billing",
    question: "Do you provide GST invoices?",
    answer:
      "Yes. Add your GSTIN under /coaching/settings/billing once and every invoice we issue will include it. Invoices are downloadable as PDF from the billing history page.",
  },

  // Parent reports
  {
    id: "parent-reports-schedule",
    topic: "Parent reports",
    question: "When do parents get reports?",
    answer:
      "Automatic weekly summaries go out every Sunday at 9am IST covering the previous week's assignments, scores, and topic-wise progress. Teachers can also send an on-demand report any time from the batch page.",
  },
  {
    id: "parent-reports-contact",
    topic: "Parent reports",
    question: "Who counts as the parent contact?",
    answer:
      "Right now we send reports to the email/mobile the student signed up with — most parents register the student themselves, so this works in practice. Dedicated parent contact records (with separate phone/email) are a Phase 4 feature.",
  },
  {
    id: "parent-reports-stop",
    topic: "Parent reports",
    question: "Can a parent unsubscribe from reports?",
    answer:
      "Yes. Every parent email and WhatsApp message has an unsubscribe link. Unsubscribed contacts still get billing / safety messages but no weekly recap.",
  },

  // Team management
  {
    id: "team-invite-teacher",
    topic: "Team management",
    question: "How do I invite a teacher?",
    answer:
      "Go to /coaching/team and click Invite. Enter their email and pick a role — we send a magic link that's valid for 7 days. If they miss it, just send another.",
  },
  {
    id: "team-roles",
    topic: "Team management",
    question: "What can teachers, admins, and the owner each do?",
    answer:
      "Owners control billing, branding, and can delete the centre. Admins do everything except billing and ownership transfer. Teachers create assignments and view their assigned batches, but can't invite team members or change settings.",
  },
  {
    id: "team-transfer-ownership",
    topic: "Team management",
    question: "Can I transfer ownership to someone else?",
    answer:
      "Yes. From /coaching/team open the admin you want to promote and choose \"Transfer ownership\". You'll be downgraded to admin and they'll take over billing — we'll email both of you to confirm.",
  },

  // White-label
  {
    id: "whitelabel-availability",
    topic: "White-label",
    question: "When can I customize the look of Testquest for my centre?",
    answer:
      "White-label is on for Growth and Pro plans. Trial centres get a preview so you can see how it'll look — your branding shows up in the app but \"Powered by Testquest\" stays visible until you upgrade.",
  },
  {
    id: "whitelabel-where",
    topic: "White-label",
    question: "Where do students see my branding?",
    answer:
      "Your logo replaces the Testquest mark in the student header, your primary color is used for buttons and highlights, and parent-report PDFs and weekly emails carry your name and logo at the top.",
  },
  {
    id: "whitelabel-domain",
    topic: "White-label",
    question: "Can I use my own domain?",
    answer:
      "Custom domains (like learn.yourcentre.in) are a Pro-only add-on. Reach out at hello@testquest.in and we'll help you set up the DNS — it usually takes a working day.",
  },

  // Mobile OTP
  {
    id: "otp-no-mobile",
    topic: "Mobile OTP",
    question: "I don't have a mobile number registered — how do I sign in?",
    answer:
      "Use email + password at /login (student) or /coaching/login (teacher). The mobile OTP option is just an alternative — every account also has an email password.",
  },
  {
    id: "otp-not-arriving",
    topic: "Mobile OTP",
    question: "I'm not getting the OTP. What do I do?",
    answer:
      "Wait 30 seconds and hit Resend — SMS sometimes takes a moment. Check that your phone has signal and that DND for promotional SMS is off. Still stuck? Use the \"Sign in with email\" option below the OTP box.",
  },
  {
    id: "otp-change-number",
    topic: "Mobile OTP",
    question: "How do I change the mobile number on my account?",
    answer:
      "Open your profile, tap the mobile field, and enter the new number. We'll send an OTP to the new number to confirm — once verified the old number stops working immediately.",
  },
];
