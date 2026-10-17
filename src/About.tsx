import { useState } from 'react';

type MainView = 'about' | 'standards';
type StandardDoc = 'privacy' | 'community';

function Mark({ type }: { type: 'identity' | 'apps' | 'shield' | 'device' | 'people' | 'data' | 'check' }) {
  const paths: Record<string, string> = {
    identity: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
    apps: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    shield: 'M12 3 19 6v5c0 4.5-3 7.8-7 10-4-2.2-7-5.5-7-10V6zM9 12l2 2 4-4',
    device: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM10 18h4',
    people: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6',
    data: 'M4 5h16v14H4zM4 9h16M9 9v10M15 9v10',
    check: 'm5 12 4 4L19 6'
  };
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={paths[type]} /></svg>;
}

function InfoCard({ icon, label, title, children }: { icon: 'identity' | 'apps' | 'shield' | 'device' | 'people' | 'data'; label: string; title: string; children: string }) {
  return <article className="kh-about-info-card"><span className="kh-about-icon"><Mark type={icon} /></span><span className="kh-about-card-kicker">{label}</span><h3>{title}</h3><p>{children}</p></article>;
}

export default function AboutPage() {
  const [view, setView] = useState<MainView>('about');
  const [document, setDocument] = useState<StandardDoc>('privacy');

  return <section className="kh-about-page" aria-labelledby="kh-about-title">
    <header className="kh-about-heading">
      <span className="eyebrow"><span className="eyebrow-line" />THE KINGSHALL SYSTEM</span>
      <h1 id="kh-about-title">{view === 'about' ? <>About <em>KingsHall.</em></> : <>Our <em>standards.</em></>}</h1>
      <p>{view === 'about' ? 'The story, purpose, and operating principles behind your central identity and connected digital ecosystem.' : 'Clear expectations for how information is handled and how people should treat one another across KingsHall experiences.'}</p>
    </header>

    <div className="kh-about-switcher" role="tablist" aria-label="About and standards">
      <button type="button" role="tab" aria-selected={view === 'about'} className={view === 'about' ? 'is-active' : ''} onClick={() => setView('about')}><Mark type="identity" /><span><strong>About</strong><small>System & purpose</small></span></button>
      <button type="button" role="tab" aria-selected={view === 'standards'} className={view === 'standards' ? 'is-active' : ''} onClick={() => setView('standards')}><Mark type="shield" /><span><strong>Standards</strong><small>Privacy & conduct</small></span></button>
    </div>

    {view === 'about' ? <div className="kh-about-content" role="tabpanel">
      <section className="kh-about-intro-panel">
        <div className="kh-about-intro-mark"><img src="/kingshall-mark.svg?v=4" alt="" /></div>
        <div><span className="kh-about-card-kicker">ONE IDENTITY · CONNECTED POSSIBILITIES</span><h2>A central home for your digital identity.</h2><p>KingsHall is designed to be the identity and access foundation for a growing family of compatible applications. Instead of treating every experience as an unrelated destination, the system aims to give members one central account and a clearer way to reach connected services.</p></div>
      </section>
      <div className="kh-about-section-heading"><span className="eyebrow"><span className="eyebrow-line" />HOW IT FITS TOGETHER</span><h2>One foundation. Different experiences.</h2><p>KingsHall is the central layer; each connected application remains its own experience.</p></div>
      <div className="kh-about-info-grid">
        <InfoCard icon="identity" label="01 / IDENTITY" title="Your central account">Your KingsHall account represents your identity within the ecosystem. Account access uses your sign-in credentials and the verification steps currently enabled for your account.</InfoCard>
        <InfoCard icon="apps" label="02 / CONNECTIONS" title="Compatible applications">KingsHall is intended to support connected services such as HallsChat and CryBots. Each app can have its own features, content, settings, and additional rules.</InfoCard>
        <InfoCard icon="device" label="03 / DEVICE" title="Device-aware access">On supported Android builds, KingsHall can register an account with the device account system. Device binding and transfer behaviour depend on the security features available in the deployed version.</InfoCard>
        <InfoCard icon="shield" label="04 / PROTECTION" title="Security controls">Identity, account security settings, verified email flows, and activity alerts help members manage their account. Not every planned protection is necessarily active in every release.</InfoCard>
        <InfoCard icon="data" label="05 / CONTROL" title="Account information">Members can review available identity, profile, and security settings in the app. Some identity details may be locked after first binding or subject to change limits to protect account integrity.</InfoCard>
        <InfoCard icon="people" label="06 / ECOSYSTEM" title="Separate spaces, shared foundation">A shared identity does not mean every app shares every piece of content. Connected apps may process information needed to provide their own features and are responsible for explaining their own practices.</InfoCard>
      </div>
      <section className="kh-about-principles">
        <div><span className="kh-about-card-kicker">DESIGN PRINCIPLES</span><h2>Built around clarity and control.</h2></div>
        <ul><li><Mark type="check" /><span><strong>One clear entry point</strong><small>A consistent place to manage identity and access compatible services.</small></span></li><li><Mark type="check" /><span><strong>Security-conscious by design</strong><small>Verification, careful account changes, and activity visibility where supported.</small></span></li><li><Mark type="check" /><span><strong>Room to grow</strong><small>An evolving platform whose capabilities may change as new services and releases arrive.</small></span></li></ul>
      </section>
      <button type="button" className="kh-about-standards-cta" onClick={() => { setDocument('privacy'); setView('standards'); }}><span className="kh-about-icon"><Mark type="shield" /></span><span><strong>Read the standards</strong><small>Review the Privacy Policy or Community Standards separately.</small></span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>
      <p className="kh-about-disclaimer">KingsHall is an evolving system. Descriptions of intended behaviour are not a guarantee that every feature is available or enabled in every release.</p>
    </div> : <div className="kh-about-content" role="tabpanel">
      <section className="kh-about-standards-intro"><span className="kh-about-icon"><Mark type="shield" /></span><div><h2>Standards, kept distinct.</h2><p>Choose the document you want to read. Privacy explains information and its use; Community Standards explains expected behaviour. They are separate policies, not one long combined page.</p></div></section>
      <div className="kh-about-doc-switcher" role="tablist" aria-label="Standards documents">
        <button type="button" role="tab" aria-selected={document === 'privacy'} className={document === 'privacy' ? 'is-active' : ''} onClick={() => setDocument('privacy')}><Mark type="data" /><span><strong>Privacy Policy</strong><small>Information & choices</small></span><span className="kh-about-doc-chevron">›</span></button>
        <button type="button" role="tab" aria-selected={document === 'community'} className={document === 'community' ? 'is-active' : ''} onClick={() => setDocument('community')}><Mark type="people" /><span><strong>Community Standards</strong><small>Safety & behaviour</small></span><span className="kh-about-doc-chevron">›</span></button>
      </div>
      {document === 'privacy' ? <article className="kh-about-policy" aria-label="Privacy Policy">
        <div className="kh-about-policy-top"><span className="kh-about-card-kicker">KINGSHALL · PRIVACY</span><span className="kh-about-policy-label">POLICY</span></div>
        <h2>Privacy Policy</h2><p className="kh-about-policy-lead">Your information should be handled with care, used for understandable reasons, and protected with reasonable safeguards.</p>
        <section><h3>1. What this policy covers</h3><p>This policy describes the general privacy approach for the KingsHall central app and identity system. A connected application may have its own privacy policy that also applies when you use that app.</p></section>
        <section><h3>2. Information that may be processed</h3><ul><li><strong>Account and identity details:</strong> information you provide, such as your name, username, email address, date of birth, nationality, and other profile fields made available in the app.</li><li><strong>Authentication and security data:</strong> password-verification data, email verification events, session or token information, security settings, and information needed to protect account access.</li><li><strong>Device and technical data:</strong> supported device-account registration details, app or connection diagnostics, and technical information needed to operate, troubleshoot, and secure the service.</li><li><strong>Activity alerts:</strong> account-related events such as sign-ins or changes that the system records and displays to help you understand activity.</li><li><strong>Messages you send us:</strong> access requests and information you choose to include when contacting the KingsHall team.</li></ul></section>
        <section><h3>3. Why information is used</h3><p>Information may be used to create and maintain accounts, verify access, support connected-app sign-in, protect accounts, show relevant activity alerts, review access requests, troubleshoot faults, prevent abuse, and meet applicable legal obligations.</p></section>
        <section><h3>4. Connected applications and sharing</h3><p>KingsHall may share the minimum information needed for a supported identity or access integration with a connected service. This does not mean that every app automatically receives all profile details or all activity. Once you use another app, that service may independently process information under its own policies and settings.</p></section>
        <section><h3>5. Storage, security, and retention</h3><p>Technical and organisational safeguards are intended to protect account information. No internet-connected service can promise absolute security. Information may be retained for as long as needed to provide the service, protect accounts, resolve disputes, meet legal requirements, or enforce policies. Exact retention periods may vary by data type and operational requirements.</p></section>
        <section><h3>6. Your choices and account requests</h3><p>Use the account settings available to you to review or update editable information. Some identity fields may be restricted after initial binding or governed by change windows. For access, correction, or deletion requests that the app does not support directly, contact the KingsHall team through the official support channel when one is provided.</p></section>
        <section><h3>7. Children and eligibility</h3><p>KingsHall account access is currently intended for adults aged 18 and over. Do not submit another person’s personal information without a valid reason and permission where required.</p></section>
        <section><h3>8. Policy changes</h3><p>This policy may be updated as the system evolves. Significant changes should be reflected in the published policy. Check this page periodically for the latest version.</p></section>
        <p className="kh-about-policy-note">Transparency note: this is the in-app policy statement and should be kept aligned with the live service’s actual data flows, retention settings, integrations, and applicable law.</p>
      </article> : <article className="kh-about-policy" aria-label="Community Standards">
        <div className="kh-about-policy-top"><span className="kh-about-card-kicker">KINGSHALL · COMMUNITY</span><span className="kh-about-policy-label">STANDARDS</span></div>
        <h2>Community Standards</h2><p className="kh-about-policy-lead">Help keep KingsHall and connected spaces useful, respectful, and safer for everyone.</p>
        <section><h3>1. Treat people with respect</h3><p>Do not harass, threaten, bully, stalk, or repeatedly target another person. Respect boundaries and do not encourage others to pile on or intimidate someone.</p></section>
        <section><h3>2. No hate or dehumanisation</h3><p>Do not use services to attack, dehumanise, or promote violence against people because of protected or personal characteristics.</p></section>
        <section><h3>3. Protect privacy and consent</h3><p>Do not publish someone’s private information, credentials, private conversations, intimate material, or identifying details without permission. Never request another member’s password, one-time code, or security code.</p></section>
        <section><h3>4. No scams, impersonation, or manipulation</h3><p>Do not impersonate people or KingsHall staff, run deceptive schemes, distribute phishing links, fake access requests, or misrepresent what a service can do.</p></section>
        <section><h3>5. Keep accounts and services safe</h3><p>Do not attempt to break into accounts, bypass access controls, exploit bugs against other members, distribute malware, disrupt the service, or use automation to abuse platform features.</p></section>
        <section><h3>6. Share lawful and appropriate content</h3><p>Do not use connected spaces to facilitate serious harm, unlawful activity, exploitation, or the distribution of content that violates applicable law or the relevant app’s rules.</p></section>
        <section><h3>7. Respect boundaries and product rules</h3><p>Follow the rules and privacy settings of each connected app. Access to KingsHall does not grant permission to misuse another service, scrape private content, or contact people who have opted out.</p></section>
        <section><h3>8. Reporting and enforcement</h3><p>Where reporting and moderation tools are available, use them to flag suspected abuse. Depending on the severity, available evidence, and applicable rules, violations may result in content removal, feature restrictions, suspension, or account termination. Decisions should be proportionate and may be reviewed where a review process is available.</p></section>
        <section><h3>9. Honest participation</h3><p>Do not manipulate verification, engagement, access reviews, or platform safeguards. Be truthful when requesting access or communicating with other members.</p></section>
        <p className="kh-about-policy-note">These standards describe expected conduct. Reporting channels, review options, and enforcement capabilities depend on the features available in each live service.</p>
      </article>}
      <button type="button" className="kh-about-back-to-about" onClick={() => setView('about')}>← Back to About KingsHall</button>
    </div>}
  </section>;
}
