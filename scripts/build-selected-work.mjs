import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const slot = text => `<div class="evidence-slot"><b>Evidence to add</b>${text}</div>`;
const list = items => `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
const wave = () => `<div class="demo-wave" aria-hidden="true">${[15,24,38,28,52,76,43,65,92,61,37,72,100,68,44,80,55,31,62,40,25,48,29,15].map(height => `<i style="--h:${height}%"></i>`).join('')}</div>`;

// Facts are limited to the user's brief and existing portfolio copy. Unknown
// ownership, stack, releases, and historical decisions stay explicitly open.
const projects = [
  {
    slug: 'voice-interview-agent', name: 'AI Voice Interview Agent', type: '01 / Conversational AI',
    description: 'A voice interview workflow that turns a conversation into a structured summary, evaluation flags, and a human review.',
    role: 'Builder · ownership details pending',
    tech: ['Conversational AI', 'LLM summaries', 'Human review'],
    context: 'Anonymized project · demo reconstruction',
    visual: () => `<figure class="sw-visual"><div class="demo-toolbar">Interview / Review<span>Sample session 004</span></div><div class="demo-body"><div><small>TRANSCRIPT EXCERPT</small>${wave()}<b>Interviewer</b><p>Tell me about a difficult product decision.</p><b>Sample candidate</b><p>We narrowed the first release to one workflow.</p></div><div class="demo-aside"><small>REVIEW QUEUE</small><b>Evidence before evaluation.</b><p>Decision described. Outcome needs a follow-up.</p><div class="demo-line"><span class="demo-status">Human review required</span></div></div></div><figcaption>Demo reconstruction · fictional transcript</figcaption></figure>`,
    evidence: 'The transcript and interface are reconstructed for this portfolio. They are not a recording, a production screenshot, or evidence of a hiring outcome.',
    sections: [
      ['problem', 'The problem', '<p>A conversation is difficult to review when the transcript, summary, and evaluation notes live apart. This project brings the interview workflow and human review into one place.</p>' + slot('Add the original user problem, who the users were, and one anonymized research note.')],
      ['ownership', 'What I owned', '<p>I built an AI voice interview project. The scope described here includes interview workflow design, LLM summaries, evaluation flags, and human review. My individual contribution within that scope still needs to be documented.</p>' + slot('Specify the flows, code, prompts, or integrations personally owned, and what teammates owned.')],
      ['decisions', 'Product decisions', '<p><strong>Reconstruction choices, not a historical decision log:</strong></p>' + list(['Keep the transcript beside the review notes so a reviewer can inspect the evidence.', 'Flag missing context for a person to review instead of presenting an unsupported conclusion.', 'Make follow-up questions visible rather than hiding uncertainty inside a score.']) + slot('Replace these reconstruction notes with one actual decision, the alternative considered, and why it was rejected.')],
      ['technical', 'Technical approach', list(['Conversational AI for the interview interaction.', 'LLM-generated summaries and evaluation flags.', 'A human review stage for interpreting the output.']) + '<p>Speech services, model provider, frontend, backend, storage, and deployment stack are not yet confirmed.</p>' + slot('Add the actual stack and a sanitized architecture diagram; include latency, consent, and retention decisions if applicable.')],
      ['shipped', 'What shipped', '<p>The described product scope is a voice interview workflow with summaries, flags, and review. Release status and the exact production feature set have not been supplied.</p>' + slot('Add a dated release, an approved walkthrough, or a sanitized screenshot. Distinguish prototype work from production work.')],
      ['outcomes', 'Outcomes & lessons', '<p>No usage, evaluation quality, or time-saving claims are included without evidence.</p>' + slot('Add one observed user response or measured result, then one thing that changed after feedback.')]
    ]
  },
  {
    slug: 'booking-partner-platform', name: 'Booking & Partner Platform', type: '02 / Commerce & operations',
    description: 'Exam booking, checkout, and partner workflows, with conversion analysis across the booking journey.',
    role: 'Builder · ownership details pending',
    tech: ['Checkout workflows', 'Partner portals', 'Conversion analysis'],
    context: 'Anonymized project · demo reconstruction',
    visual: () => `<figure class="sw-visual"><div class="demo-toolbar">Exam booking<span>01 / Choose a session</span></div><div class="demo-body"><div><small>SAMPLE AVAILABILITY</small><b>Choose your date.</b><div class="demo-calendar">${['12','13','14','15','16','19','20','21','22','23'].map(day => `<span${day === '14' ? ' class="chosen"' : ''}>${day}</span>`).join('')}</div><span class="demo-status">09:00 · Sample session</span></div><div class="demo-aside"><small>BOOKING SUMMARY</small><b>Practice exam</b><p>Sample centre<br>14 November · 09:00</p><div class="demo-line"><small>NEXT STEP</small><b>Review & checkout</b></div></div></div><figcaption>Demo reconstruction · fictional booking</figcaption></figure>`,
    evidence: 'The exam, centre, availability, and booking are fictional. No employer name, customer information, or real checkout transaction is shown.',
    sections: [
      ['problem', 'The problem', '<p>An exam booking spans several steps: choosing a session, checking details, completing checkout, and coordinating with a partner. This project covers both the customer journey and the partner side.</p>' + slot('Add the specific customer or partner friction that prompted the work, without identifying the employer.')],
      ['ownership', 'What I owned', '<p>I worked on a booking and partner platform. The supplied scope includes booking UX, checkout workflows, partner portals, and conversion analysis; my exact ownership boundaries are still to be confirmed.</p>' + slot('List the screens, integrations, analysis, and code personally owned. Separate individual work from team delivery.')],
      ['decisions', 'Product decisions', '<p><strong>Reconstruction choices, not confirmed production decisions:</strong></p>' + list(['Keep the chosen session visible while the customer reviews the booking.', 'Separate choosing a session from reviewing checkout details.', 'Show a clear next step without inventing urgency or limited availability.']) + slot('Add a real UX tradeoff and the evidence used to make it. Include what was deliberately left out.')],
      ['technical', 'Technical approach', list(['Booking UX and checkout workflow design.', 'Partner-facing portal workflows.', 'Conversion analysis across the customer journey.']) + '<p>The payment provider, analytics tooling, application framework, database, and authentication system are not yet confirmed.</p>' + slot('Add the actual stack, booking state transitions, and how payment or availability failures were handled.')],
      ['shipped', 'What shipped', '<p>The project scope covers booking, checkout, and partner workflows. The specific releases, rollout dates, and production status need confirmation.</p>' + slot('Add a sanitized checkout walkthrough or partner flow with a release date. Keep employer and customer details anonymous.')],
      ['outcomes', 'Outcomes & lessons', '<p>No conversion lift, revenue, or booking-volume claim is made here.</p>' + slot('Add a supported outcome or a qualitative lesson from users. If there is a conversion metric, include its time window and denominator.')]
    ]
  },
  {
    slug: 'carez-ai', name: 'Carez AI', type: '03 / Co-founded',
    description: 'Synthetic medical imaging for training and validating AI systems. Grew to a five-person team and $500K+ ARR.',
    role: 'Co-founder · product, GTM, demos & pilots',
    tech: ['Synthetic imaging', 'Dataset design', 'Model evaluation'],
    context: 'Company project · existing portfolio visual',
    visual: prefix => `<figure class="sw-visual"><div class="demo-toolbar">Carez AI<span>Data designer</span></div><img class="demo-carez" src="${prefix}assets/carez-ai-ui.png" width="1796" height="1166" alt="Existing Carez AI portfolio visual showing annotated and unannotated image datasets, edge cases, and training options" loading="lazy" decoding="async"><figcaption>Existing portfolio visual · Carez AI</figcaption></figure>`,
    evidence: 'This image is retained from the existing Carez portfolio. Team size and ARR are founder-reported company outcomes, not results attributed to a single feature.',
    sections: [
      ['problem', 'The problem', '<p>Medical AI development depends on suitable data for training and validation. Carez AI focuses on synthetic medical image datasets, including annotated data and edge cases.</p><p>The existing data-designer visual organizes datasets by annotation status, edge cases, and new device or clinic scenarios.</p>' + slot('Add an approved customer problem or pilot brief to show which data gap mattered in practice.')],
      ['ownership', 'What I owned', '<p>I co-founded Carez AI, grew the team to five people, and scaled the company to $500K+ ARR.</p><p>My existing portfolio records ownership of product, GTM, demos, pilots, and pricing. The model engineering and infrastructure contributions need a more precise individual-versus-team breakdown.</p>' + slot('Add one product artifact personally authored and identify the collaborators behind the technical implementation.')],
      ['decisions', 'Product decisions', '<p>The existing visual separates annotated and unannotated datasets and surfaces edge cases alongside new device or clinic scenarios. Those are visible product choices; the reasoning behind them has not yet been documented here.</p>' + slot('Explain one real prioritization decision: which customer workflow came first, what was deferred, and why.')],
      ['technical', 'Technical approach', list(['Synthetic medical image datasets for AI training and validation.', 'Dataset organization around annotations and edge cases.', 'A data-designer interface with generation and evaluation workflows.']) + '<p>The model architectures, training framework, backend, and cloud stack are not yet confirmed for this case study.</p>' + slot('Add the actual stack and an approved evaluation method. Do not include patient data or unapproved clinical claims.')],
      ['shipped', 'What shipped', '<p>A synthetic medical imaging platform, with product demos and pilot work described in the existing portfolio. The data-designer visual shows the product surface; it is not a release record.</p>' + slot('Add a dated product walkthrough or approved pilot deliverable to document what reached users.')],
      ['outcomes', 'Outcomes & lessons', '<p><strong>Five-person team. $500K+ ARR.</strong> These are the company milestones supplied for this portfolio.</p><p>They establish business progress, not model quality or clinical performance.</p>' + slot('Add a shareable source for the milestones and one concrete lesson from a pilot, customer conversation, or pricing decision.')]
    ]
  },
  {
    slug: 'gtm-workflow-engine', name: 'GTM Workflow Engine', type: '04 / Workflow automation',
    description: 'Lead research, enrichment, qualification, and CRM workflows connected to repeatable GTM playbooks.',
    role: 'Builder · ownership details pending',
    tech: ['Enrichment', 'CRM workflows', 'Qualification logic'],
    context: 'Anonymized project · demo reconstruction',
    visual: () => `<figure class="sw-visual"><div class="demo-toolbar">Lead workflow<span>Example playbook</span></div><div class="demo-flow"><div class="demo-node"><b>Research & enrich</b><small>Sample company · source context</small></div><div class="demo-connector"></div><div class="demo-node"><b>Qualification check</b><small>Is the evidence sufficient?</small></div><div class="demo-connector"></div><div class="demo-branches"><div class="demo-node"><b>Ready for CRM</b><small>Keep supporting context</small></div><div class="demo-node"><b>Needs review</b><small>Resolve missing information</small></div></div></div><figcaption>Demo reconstruction · illustrative workflow</figcaption></figure>`,
    evidence: 'This is an illustrative workflow, not a production run. It contains no real leads, company records, pipeline totals, or measured conversion results.',
    sections: [
      ['problem', 'The problem', '<p>Research, enrichment, qualification, and CRM updates can become disconnected tasks. This project connects those steps into a repeatable GTM workflow.</p><p>The existing portfolio describes its purpose as reducing repetitive account preparation and turning customer context into clearer next actions.</p>'],
      ['ownership', 'What I owned', '<p>I built a GTM automation project covering lead research, enrichment, qualification, CRM workflows, and playbooks. The specific integrations and individual implementation ownership still need confirmation.</p>' + slot('Add which connectors, rules, workflows, or playbooks were personally built and which were existing systems.')],
      ['decisions', 'Product decisions', '<p><strong>Reconstruction choices, not a record of shipped logic:</strong></p>' + list(['Carry source context into qualification instead of showing a score alone.', 'Give incomplete records a review path rather than treating them as qualified.', 'Make the CRM handoff a distinct step so the flow is inspectable.']) + slot('Add one real rule, an alternative approach, and the reason for choosing it.')],
      ['technical', 'Technical approach', list(['Lead research and enrichment workflows.', 'Qualification logic and CRM updates.', 'GTM playbooks that connect context to next actions.']) + '<p>The CRM, enrichment vendors, automation runtime, model providers, and hosting stack have not been confirmed.</p>' + slot('Add actual tools and a sanitized workflow export. Include retry, duplicate-record, and human-approval handling if implemented.')],
      ['shipped', 'What shipped', '<p>The existing portfolio includes a GTM Intelligence Agent demo. This case study adds a simpler reconstruction to explain the workflow; it does not establish a new product release.</p>' + slot('Add a redacted production run or approved demo, along with the scope and release status.')],
      ['outcomes', 'Outcomes & lessons', '<p>No time saved, pipeline generated, meeting count, or conversion uplift is claimed.</p>' + slot('Add a supported result or a real lesson from operating the workflow. Include a failure case and what changed afterwards.')]
    ]
  }
];

const techList = project => `<ul class="sw-tech" aria-label="Relevant technologies and systems">${project.tech.map(tech => `<li>${escape(tech)}</li>`).join('')}</ul>`;
const cards = projects.map(project => `<article class="sw-card">
  <a href="work/${project.slug}/index.html" aria-label="Read ${escape(project.name)} case study">${project.visual('')}<h3>${escape(project.name)}</h3></a>
  <p class="sw-description">${escape(project.description)}</p>
  <p class="sw-role"><span>My role / </span>${escape(project.role)}</p>
  ${techList(project)}
  <a class="sw-case-link" href="work/${project.slug}/index.html">Read case study <span aria-hidden="true">↗</span></a>
</article>`).join('\n');
const section = `<section class="selected-work" id="selected-work" aria-labelledby="selected-work-title">
  <div class="sw-heading"><div><span class="sw-kicker">Selected work / 01—04</span><h2 id="selected-work-title">Things I've built.</h2></div><a href="#work">More projects ↓</a></div>
  <div class="sw-grid">${cards}</div>
  <p class="sw-note">Case studies in progress. Reconstructed interfaces are labeled; ownership, stack, and release evidence still being documented are marked inside each study.</p>
  <a class="sw-all" href="#work">Explore the existing project demos ↓</a>
</section>`;

const homePath = resolve(root, 'index.html');
const home = readFileSync(homePath, 'utf8');
const marker = /<!-- SELECTED-WORK:START -->[\s\S]*?<!-- SELECTED-WORK:END -->/;
if (!marker.test(home)) throw new Error('Selected Work markers missing; refusing to replace unrelated homepage content.');
writeFileSync(homePath, home.replace(marker, `<!-- SELECTED-WORK:START -->\n${section}\n      <!-- SELECTED-WORK:END -->`));

for (const [index, project] of projects.entries()) {
  const next = projects[(index + 1) % projects.length];
  const page = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${escape(project.name)} — Rayan Sadri</title>
  <meta name="description" content="${escape(project.description)}">
  <link rel="stylesheet" href="../../assets/selected-work.css?v=1">
  <script defer src="../../assets/case-study.js"></script>
</head>
<body class="case-page">
<div class="case-shell">
  <nav class="case-nav" aria-label="Case study navigation"><a href="../../index.html">Rayan Sadri</a><div class="case-nav-right"><a href="../../index.html#selected-work">All work</a><button class="case-theme" type="button" aria-label="Switch to light theme" title="Switch to light theme" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></svg></button></div></nav>
  <main>
    <header class="case-header"><span class="sw-kicker">${escape(project.type)}</span><h1>${escape(project.name)}</h1><p class="case-deck">${escape(project.description)}</p><dl class="case-meta"><div><dt>MY ROLE</dt><dd>${escape(project.role)}</dd></div><div><dt>CONTEXT</dt><dd>${escape(project.context)}</dd></div></dl>${techList(project)}</header>
    <div class="case-preview">${project.visual('../../')}</div>
    <aside class="case-evidence"><strong>About the evidence.</strong> ${escape(project.evidence)} Specific frameworks are omitted until confirmed.</aside>
    <nav class="case-index" aria-label="In this case study">${project.sections.map(([id, title]) => `<a href="#${id}">${title}</a>`).join('')}</nav>
    ${project.sections.map(([id, title, content], i) => `<section class="case-section" id="${id}"><h2><span>0${i + 1}</span>${title}</h2><div class="case-copy">${content}</div></section>`).join('\n')}
  </main>
  <footer class="case-foot"><a href="../../index.html#selected-work">← Selected work</a><a href="../${next.slug}/index.html">Next / ${escape(next.name)} →</a></footer>
</div>
</body>
</html>\n`;
  const folder = resolve(root, 'work', project.slug);
  mkdirSync(folder, { recursive: true });
  writeFileSync(resolve(folder, 'index.html'), page);
}
console.log('Built four static case studies and the Selected Work index.');
