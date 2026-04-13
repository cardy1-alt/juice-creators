import LegalLayout from './LegalLayout';

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      lastUpdated="13 April 2026"
      otherPageLabel="Read our Privacy Policy"
      otherPageHref="/?page=privacy"
    >
      <Intro />
      <Section n={1} title="Who can use Nayba">
        <P>You must be 18 or over and resident in the United Kingdom to use Nayba. If you're signing up on behalf of a business, you confirm you have the authority to bind that business to these terms.</P>
        <P>We reserve the right to refuse or remove any account at our discretion, particularly where we believe an account is being used to mislead creators, brands, or their audiences.</P>
      </Section>

      <Section n={2} title="Accounts">
        <P>You're responsible for keeping your login credentials secure. You must provide accurate information when signing up, including your email address, name, and (for creators) your Instagram handle. If anything changes, please update your profile.</P>
        <P>You may have one account per person (creators) or per business (brands). Creating multiple accounts to circumvent selection processes, access limits, or our decisions is prohibited and may result in removal from the platform.</P>
      </Section>

      <Section n={3} title="What Nayba does">
        <P>Nayba is a marketplace — we connect creators with brands for campaign opportunities. We don't employ creators, and we're not a party to the relationship between a creator and a brand once a campaign is underway.</P>
        <P>For creators, we:</P>
        <List items={[
          'Show you campaigns from local businesses',
          "Let you register interest in campaigns you'd like to join",
          'Notify you when a brand selects you',
          'Track your participation so you can build a profile over time',
        ]} />
        <P>For brands, we:</P>
        <List items={[
          'Let you create campaigns',
          'Review interested creators and select the ones you want to work with',
          'Track submissions and campaign performance',
        ]} />
      </Section>

      <Section n={4} title="Campaigns and perks">
        <P>When a creator is selected for a campaign and confirms their spot, they agree to deliver the content described in the campaign brief (typically an Instagram Reel) within the deadlines shown in the app.</P>
        <P>Creators receive perks — experiences, products, or services provided by the brand — in exchange for their content. Perks are not monetary compensation. We do not handle payment between creators and brands, and we do not guarantee the value, quality, or availability of any perk. Any issues with a perk should be raised with the brand directly; we're happy to help mediate where reasonable.</P>
        <P>Brands are responsible for:</P>
        <List items={[
          'Delivering the perk as described',
          'Providing accurate campaign information',
          'Honouring the commitments they make in their brief',
        ]} />
        <P>Creators are responsible for:</P>
        <List items={[
          'Posting content as described within deadlines',
          'Tagging the brand and using any hashtags specified',
          'Disclosing the relationship clearly in their content, in line with UK Advertising Standards Authority (ASA) guidance (e.g. using "#ad" or "Paid partnership" labels where appropriate)',
          'Keeping content live for at least 30 days unless otherwise agreed',
          "Not posting content that is misleading, illegal, or contrary to Instagram's terms",
        ]} />
        <P>If a creator fails to deliver within the agreed deadlines, we may mark the campaign as overdue and limit their access to future campaigns.</P>
      </Section>

      <Section n={5} title="Content and intellectual property">
        <P>You keep ownership of any content you create for a Nayba campaign. By posting it publicly on your social channels as part of a campaign, you grant the brand a non-exclusive, royalty-free licence to reshare the content on their own social channels and website for up to 12 months, crediting you as the creator.</P>
        <P>Nayba may feature campaign content in marketing materials (e.g. case studies, our own social media) with credit to the creator and the brand, unless you tell us not to.</P>
        <P>You must own the rights to everything you submit, including music, images, and any talent depicted. Don't use anyone else's copyrighted material without permission.</P>
      </Section>

      <Section n={6} title="Acceptable use">
        <P>Don't use Nayba to:</P>
        <List items={[
          'Mislead brands or other creators about who you are or what you can deliver',
          'Artificially inflate engagement metrics or follower counts',
          'Post content that is defamatory, discriminatory, sexually explicit, or promotes illegal activity',
          'Scrape, reverse-engineer, or misuse the platform',
          'Harass or abuse other users, brands, or our team',
        ]} />
        <P>We take these seriously. Breach may result in removal without refund or further explanation.</P>
      </Section>

      <Section n={7} title="Data and privacy">
        <P>We process your personal data as described in our <a href="/?page=privacy" className="text-[var(--terra)] hover:underline">Privacy Policy</a>, which forms part of these terms. By using Nayba, you consent to that processing.</P>
      </Section>

      <Section n={8} title="Liability">
        <P>Nayba is provided "as is". We work hard to keep the platform useful and available but we can't guarantee uninterrupted access, and we're not liable for any loss resulting from:</P>
        <List items={[
          'Temporary outages or bugs',
          "Disputes between creators and brands (although we'll help where we reasonably can)",
          "Perks that are delayed, defective, or not as described — this is the brand's responsibility",
          "Content posted by users that we didn't author",
        ]} />
        <P>To the extent permitted by UK law, our total liability to you in any 12-month period is limited to £100. Nothing in these terms excludes liability for fraud, death or personal injury caused by negligence, or anything else that can't legally be excluded.</P>
      </Section>

      <Section n={9} title="Termination">
        <P>You can stop using Nayba at any time by deleting your account from within the app (Settings → Delete account). We can suspend or terminate your account if you breach these terms or if we believe it's necessary to protect the platform, its users, or us.</P>
        <P>If your account is terminated, you may lose access to campaign history, level progress, and in-flight participations. We'll try to honour any perk you've already been confirmed for.</P>
      </Section>

      <Section n={10} title="Changes to these terms">
        <P>We may update these terms as Nayba evolves. If we make meaningful changes, we'll email you at the address on file at least 14 days before the changes take effect. Continuing to use Nayba after that date counts as accepting the new terms.</P>
      </Section>

      <Section n={11} title="Governing law">
        <P>These terms are governed by the laws of England and Wales. Any disputes will be resolved by the courts of England and Wales.</P>
      </Section>

      <Section n={12} title="Contact">
        <P>Questions about these terms? Email <a href="mailto:hello@nayba.app" className="text-[var(--terra)] hover:underline">hello@nayba.app</a>.</P>
      </Section>
    </LegalLayout>
  );
}

function Intro() {
  return (
    <>
      <p className="text-[16px] text-[var(--ink)] leading-[1.7] mb-4">
        These terms govern your use of Nayba, a platform connecting local creators with local businesses for sponsored content campaigns. By using Nayba, you agree to these terms.
      </p>
      <p className="text-[16px] text-[var(--ink)] leading-[1.7] mb-10">
        Nayba is operated by Jacob Cardy, trading as Nayba, a sole trader based in the United Kingdom (NM Business Suites, Abacus House, Station Yard, Needham Market, Ipswich IP6 8AS). Throughout these terms, "we", "us", and "Nayba" refer to this sole trader. "You" refers to the person using the platform — either as a creator or as a brand.
      </p>
    </>
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
