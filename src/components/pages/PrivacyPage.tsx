import LegalLayout from './LegalLayout';

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      lastUpdated="13 April 2026"
      otherPageLabel="Read our Terms of Service"
      otherPageHref="/?page=terms"
    >
      <p className="text-[16px] text-[var(--ink)] leading-[1.7] mb-10">
        This policy explains what personal data Nayba collects, why we collect it, and what rights you have under UK data protection law.
      </p>

      <Section n={1} title="Who's the data controller">
        <P>Nayba is operated by Jacob Cardy, a sole trader based at NM Business Suites, Abacus House, Station Yard, Needham Market, Ipswich IP6 8AS, United Kingdom. I'm the data controller for the personal data you share with Nayba. You can reach me at <a href="mailto:hello@nayba.app" className="text-[var(--terra)] hover:underline">hello@nayba.app</a> for any privacy-related questions or requests.</P>
      </Section>

      <Section n={2} title="What data we collect">
        <P>When you sign up as a creator, we collect:</P>
        <List items={[
          'Your email address and name',
          'Your Instagram handle',
          'Your approximate location (town/city, county)',
          'Optional: profile photo, bio, date of birth, follower count range, phone number',
        ]} />
        <P>When you sign up as a brand, we collect:</P>
        <List items={[
          'Business name, category, and region',
          'Owner email address',
          'Address where campaigns take place (if provided)',
          'Optional: logo, bio, Instagram handle',
        ]} />
        <P>When you use Nayba we automatically collect:</P>
        <List items={[
          'The campaigns you view and interact with',
          'Applications you submit and your status in each campaign',
          'Reels you submit and any metrics you share (reach, likes, comments)',
          "Basic analytics — page views and device type (via Vercel Analytics, which doesn't use cookies or track you across sites)",
          'Diagnostic logs (errors and timing) to help us keep the platform working',
        ]} />
        <P>We do not collect or store payment card details — no money changes hands through Nayba.</P>
      </Section>

      <Section n={3} title="Why we collect it (lawful basis under UK GDPR)">
        <List items={[
          'Contract performance: we need your email, name, Instagram handle, and campaign data to deliver the service you signed up for',
          'Legitimate interests: we use basic analytics and error logs to improve the platform; this is carefully balanced against your privacy and you can opt out at any time',
          'Consent: where we rely on consent (e.g. for optional profile fields), you can withdraw it by updating your profile or contacting us',
        ]} />
      </Section>

      <Section n={4} title="Who we share data with">
        <P>We use a small number of trusted third parties to run Nayba:</P>
        <List items={[
          'Supabase (database, authentication): EU-hosted. Stores your account and campaign data.',
          'Resend (transactional email): sends you emails like sign-up confirmation, campaign updates, and perk details.',
          'Vercel (hosting and analytics): hosts the Nayba web app and provides aggregated, cookieless analytics.',
          'Anthropic (AI-assisted campaign briefs for brands): we send campaign setup info (brand name, category, perk description) when a brand uses the AI assist. No creator data is sent.',
        ]} />
        <P>With brands, we share the profile details of creators who have registered interest in a campaign so the brand can review and select. This includes your display name, Instagram handle, level, approximate location, and pitch (if you wrote one). We don't share your email address with brands.</P>
        <P>With creators (selected for a campaign), we share the brand's name, campaign details, perk description, and the brand's address once you've confirmed your spot.</P>
        <P>We don't sell your data to advertisers, data brokers, or anyone else. We may disclose data if required by law (e.g. a lawful court order).</P>
      </Section>

      <Section n={5} title="How long we keep it">
        <List items={[
          'Account data: for as long as your account is active, plus 12 months after deletion for legal record-keeping',
          'Campaign and application data: up to 3 years after the campaign ends, so creators can build a track record and brands can reference past work',
          'Email logs: 90 days',
          'Analytics: aggregated and anonymised after 30 days',
        ]} />
        <P>You can ask us to delete your data earlier by contacting <a href="mailto:hello@nayba.app" className="text-[var(--terra)] hover:underline">hello@nayba.app</a> or using the delete-account option in the app.</P>
      </Section>

      <Section n={6} title="Your rights">
        <P>Under the UK Data Protection Act 2018 and UK GDPR, you have the right to:</P>
        <List items={[
          'Access the data we hold about you',
          'Correct inaccurate data',
          'Delete your data (right to erasure)',
          'Object to or restrict processing',
          'Data portability — get a copy of your data in a common format',
          'Withdraw consent at any time, where processing relies on consent',
        ]} />
        <P>To exercise any of these, email <a href="mailto:hello@nayba.app" className="text-[var(--terra)] hover:underline">hello@nayba.app</a>. We'll respond within 30 days.</P>
        <P>If you're unhappy with how we handle your data, you can complain to the UK Information Commissioner's Office (ICO) at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-[var(--terra)] hover:underline">ico.org.uk</a>.</P>
      </Section>

      <Section n={7} title="Cookies and similar tech">
        <P>Nayba doesn't use marketing or tracking cookies. We use browser localStorage to keep you signed in — this is essential for the service to work, so no consent banner is required under the Privacy and Electronic Communications Regulations (PECR).</P>
        <P>Vercel Analytics, which we use for basic page-view stats, is cookieless and doesn't track you across other sites.</P>
      </Section>

      <Section n={8} title="Children">
        <P>Nayba is only for people aged 18 or over. We don't knowingly collect data from anyone under 18. If you become aware that a child has created an account, please contact us and we'll delete it.</P>
      </Section>

      <Section n={9} title="Security">
        <P>Data is encrypted in transit (HTTPS) and at rest (via Supabase's managed Postgres). We use role-based access controls so that brands can't see creators' email addresses or private data, and we review permissions regularly. No system is perfectly secure — if we ever had a data breach, we'd notify affected users promptly and report to the ICO as required.</P>
      </Section>

      <Section n={10} title="Changes to this policy">
        <P>If we make meaningful changes to how we handle your data, we'll email you at the address on file at least 14 days before the changes take effect. The "Last updated" date at the top will also change.</P>
      </Section>

      <Section n={11} title="Contact">
        <P>Email <a href="mailto:hello@nayba.app" className="text-[var(--terra)] hover:underline">hello@nayba.app</a> for any privacy-related questions or to exercise your rights.</P>
        <P>UK Information Commissioner's Office:</P>
        <List items={[
          'Website: ico.org.uk',
          'Phone: 0303 123 1113',
        ]} />
      </Section>
    </LegalLayout>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-[20px] md:text-[22px] text-[var(--ink)] mb-3" style={{ fontFamily: "'Hornbill', Georgia, serif", fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.3 }}>
        {n}. {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-[var(--ink)] leading-[1.7]">{children}</p>;
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="text-[15px] text-[var(--ink)] leading-[1.7]">{item}</li>
      ))}
    </ul>
  );
}
