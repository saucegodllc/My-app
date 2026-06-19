import type { LegalDocument } from "@/components/LegalDocumentScreen";

const CONTACT_EMAIL = "support@connectsphere.app";
const PRIVACY_EMAIL = "privacy@connectsphere.app";
const COMPANY_NAME = "ConnectSphere, Inc.";

export const privacyPolicyDocument: LegalDocument = {
  title: "Privacy Policy",
  effectiveLabel: "Effective: June 1, 2026",
  intro:
    "Your privacy matters. This policy explains what data ConnectSphere collects, why we collect it, and how we keep it safe.",
  sections: [
    {
      heading: "1. Information We Collect",
      body: `When you create a ConnectSphere account and use our service, we collect:

Profile information - your name, date of birth, gender, photos, bio, and optional fields you fill in, such as interests, prompts, profession, and connection intent.

Location data - with your permission, we collect location information to show you nearby people and plans. You can choose approximate or precise location controls in Settings and can disable location access in device settings.

Photos and media - photos you upload to your profile or send in chat. Photos are stored securely and are never sold to third parties.

Usage data - app interactions such as swipes, matches, messages, plan activity, reports, blocks, session duration, and feature usage so we can operate and improve the service.

Device data - device type, operating system, push notification token, app version, API errors, and crash logs for support, reliability, and abuse prevention.

Communications - messages, plan invites, reports, and support requests you send through ConnectSphere. We do not review private messages except as needed for safety investigations, support, or legal compliance.`,
    },
    {
      heading: "2. How We Use Your Information",
      body: `We use your information to:

- Provide and improve ConnectSphere, including profiles, matching, chat, plans, friend requests, double-date experiences, notifications, and account settings.
- Detect and prevent fraud, spam, harassment, unsafe conduct, account misuse, and attempts to evade blocks or moderation.
- Process optional premium subscriptions and purchase status through supported app-store payment systems.
- Respond to support, privacy, deletion, and data export requests.
- Comply with legal obligations and enforce our Terms of Service.

We do not sell your personal information. We do not use your data to serve third-party advertising.`,
    },
    {
      heading: "3. Matching and Discovery",
      body: `ConnectSphere may use profile fields, preferences, location settings, connection intent, activity signals, compatibility signals, and safety signals to recommend people, matches, and plans.

Reported, blocked, suspended, or restricted accounts may be removed from discovery or deprioritized for safety. The service does not use race, religion, national origin, or other legally protected characteristics as matching inputs.`,
    },
    {
      heading: "4. Photos and Media",
      body: `Profile photos are visible to other ConnectSphere users according to the product surfaces where your profile appears. We may use automated and manual review to detect inappropriate, unsafe, or policy-violating content.

Private chat media is visible to the recipient and may be reviewed if reported or required for safety or legal reasons. We do not use your photos to train AI models or sell them to any third party.

You can delete profile photos from your profile settings. Deleted media is removed or anonymized where supported, subject to backup, safety, legal, and fraud-prevention retention needs.`,
    },
    {
      heading: "5. In-App Purchases",
      body: `ConnectSphere may offer optional premium subscriptions and consumable purchases. Payment processing is handled by Apple, Google, RevenueCat, or other supported app-store payment systems.

We do not store your payment card number. We may store subscription status, receipt metadata, and purchase history for entitlement, customer support, tax, fraud-prevention, and dispute purposes.`,
    },
    {
      heading: "6. Information Sharing",
      body: `We share information only with:

Service providers - companies that help us operate ConnectSphere, such as cloud hosting, push notifications, crash reporting, analytics after consent, payments, and customer support. These providers are expected to protect your data.

Law enforcement or legal recipients - when required by valid legal process or when we believe in good faith that disclosure is necessary to protect someone's safety, investigate abuse, or comply with law.

Business transfers - if ConnectSphere merges, is acquired, raises financing, sells assets, or reorganizes, user information may be transferred as part of that transaction. We will notify users if information becomes subject to a materially different privacy policy.

We do not share your data with data brokers or third-party advertising networks.`,
    },
    {
      heading: "7. Data Retention",
      body: `Active accounts - we keep account information while your account is active or as needed to operate the service.

Deleted accounts - when you delete your account, we remove or anonymize profile data, photos, messages, plans, push tokens, and sessions where supported. Some records may be retained for safety investigations, fraud prevention, disputes, tax, legal compliance, or platform obligations.

Backups - deleted data may remain in encrypted backups for a limited period before being overwritten through normal backup cycles.`,
    },
    {
      heading: "8. Your Rights and Choices",
      body: `Depending on your location, you may have the right to access, correct, delete, export, or object to certain uses of your personal information.

You can request account deletion and data export from Settings under Privacy & Safety. You can also adjust analytics consent, push notifications, location precision, blocked users, and discovery preferences from Settings.

To exercise privacy rights or ask questions, contact ${PRIVACY_EMAIL}. We will respond within a reasonable period and within legally required timelines when applicable.`,
    },
    {
      heading: "9. Children's Privacy",
      body: `ConnectSphere is intended for users 18 and older. We do not knowingly collect personal information from anyone under 18. If we learn that a minor has created an account, we will delete or restrict it promptly. If you believe a minor is using ConnectSphere, contact ${CONTACT_EMAIL}.`,
    },
    {
      heading: "10. Security",
      body: `We use safeguards designed to protect your information, including encryption in transit, access controls, secure storage practices, monitoring, and moderation tooling.

No online service is 100% secure. Use a strong, unique password and contact us immediately if you suspect unauthorized access to your account.`,
    },
    {
      heading: "11. Changes to This Policy",
      body:
        "We may update this Privacy Policy from time to time. When we make material changes, we will update the effective date and may notify you in-app or by other appropriate means. Continued use of ConnectSphere after a change takes effect means you accept the revised policy.",
    },
    {
      heading: "12. Contact Us",
      body: `If you have questions or concerns about this Privacy Policy or our data practices, contact:

${COMPANY_NAME}
${PRIVACY_EMAIL}

For safety and general support requests, contact ${CONTACT_EMAIL}.`,
    },
  ],
};

export const termsOfServiceDocument: LegalDocument = {
  title: "Terms of Service",
  effectiveLabel: "Effective: June 1, 2026",
  intro:
    "These Terms explain the rules for using ConnectSphere. By creating an account, signing in, or using the app, you agree to these Terms.",
  sections: [
    {
      heading: "1. Eligibility",
      body:
        "You must be 18 years or older and legally able to agree to these Terms to use ConnectSphere. You may not use the service if we previously removed or suspended your account unless we give you written permission.",
    },
    {
      heading: "2. Your Account",
      body: `You agree to provide truthful account information and keep your login credentials secure. You are responsible for activity under your account.

Do not create fake profiles, impersonate another person, misrepresent your identity or intentions, share an account, or create accounts to evade blocks, reports, restrictions, or enforcement actions.`,
    },
    {
      heading: "3. Acceptable Use",
      body: `You agree to use ConnectSphere respectfully and responsibly. You may not:

- Harass, threaten, stalk, shame, coerce, exploit, or abuse another person.
- Upload illegal, hateful, sexualized minor, non-consensual, scam, spam, or misleading content.
- Scrape, copy, automate, reverse engineer, attack, overload, or bypass app systems.
- Evade blocks or encourage others to contact someone who blocked you.
- Abuse reports, invites, plans, chat, matching, or safety tools.
- Use ConnectSphere for illegal activity or unsafe meetups.`,
    },
    {
      heading: "4. User Content",
      body: `You keep ownership of the photos, profile text, messages, and other content you submit. You grant ConnectSphere permission to host, display, transmit, moderate, and process that content as needed to operate, improve, protect, and support the service.

You are responsible for content you share. We may remove content or restrict accounts when content violates these Terms, our Community Guidelines, law, platform policy, or service integrity rules.`,
    },
    {
      heading: "5. Safety and Enforcement",
      body: `ConnectSphere may review reports, block abusive behavior, limit reach, remove content, preserve relevant records, suspend accounts, or terminate accounts when needed for safety, legal compliance, abuse prevention, platform policy, or service integrity.

We may make enforcement decisions using automated signals, manual review, user reports, and operational records. We are not required to disclose moderation methods when doing so could create safety or abuse risks.`,
    },
    {
      heading: "6. Plans, Chats, and Meetups",
      body: `ConnectSphere helps users connect, chat, and make plans, but users are responsible for their own decisions and in-person interactions.

Meet in public first, tell someone where you are going, keep your own transportation options, and leave any situation that feels unsafe. For urgent danger, contact local emergency services first.`,
    },
    {
      heading: "7. Premium Features and Payments",
      body: `ConnectSphere may offer subscriptions, boosts, or other optional purchases. Purchases may be billed through Apple, Google, RevenueCat, or supported app-store payment systems.

Store cancellation, renewal, refund, and billing rules apply. We may change, add, or remove premium features as the product evolves, subject to applicable law and platform rules.`,
    },
    {
      heading: "8. Privacy",
      body:
        "Our Privacy Policy explains what information we collect, how we use it, and what choices you have. By using ConnectSphere, you also agree to the practices described in the Privacy Policy.",
    },
    {
      heading: "9. Service Changes",
      body:
        "We may update, pause, restrict, or discontinue parts of ConnectSphere at any time. We may also change these Terms. If changes are material, we will take reasonable steps to notify users. Continued use after changes take effect means you accept the updated Terms.",
    },
    {
      heading: "10. Disclaimers",
      body:
        "ConnectSphere is provided as is and as available. We do not promise that the service will be uninterrupted, error-free, or that any match, connection, chat, plan, or meetup will meet your expectations. To the fullest extent allowed by law, we disclaim implied warranties.",
    },
    {
      heading: "11. Limitation of Liability",
      body:
        "To the fullest extent allowed by law, ConnectSphere is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost data, personal disputes, user conduct, or offline interactions arising from use of the service.",
    },
    {
      heading: "12. Contact",
      body: `Questions about these Terms, safety, or support can be sent to:

${COMPANY_NAME}
${CONTACT_EMAIL}`,
    },
  ],
};
