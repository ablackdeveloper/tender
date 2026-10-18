import { mkdir, writeFile, cp, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");
await mkdir(path.join(dist, "assets"), { recursive: true });
await cp(path.join(root, "assets"), path.join(dist, "assets"), {
  recursive: true,
});
for (const [font, source] of [
  ["fraunces.ttf", "fraunces/300Light/Fraunces_300Light.ttf"],
  ["dm-sans.ttf", "dm-sans/400Regular/DMSans_400Regular.ttf"],
  ["dm-sans-semibold.ttf", "dm-sans/600SemiBold/DMSans_600SemiBold.ttf"],
])
  await copyFile(
    path.resolve(
      root,
      "../../apps/mobile/node_modules/@expo-google-fonts",
      source,
    ),
    path.join(dist, "assets", font),
  );
for (const name of ["site.css", "site.js"])
  await copyFile(path.join(root, name), path.join(dist, name));
for (const font of ["fraunces", "dm-sans"])
  await copyFile(
    path.resolve(
      root,
      "../../apps/mobile/node_modules/@expo-google-fonts",
      font,
      "LICENSE_FONT",
    ),
    path.join(dist, "assets", `${font}-license.txt`),
  );

const arrow = '<span aria-hidden="true">↗</span>';
const mark =
  '<svg class="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 32C6 26 3 14 8 10c5-4 11 5 12 12C21 15 27 6 32 10c5 4 2 16-12 22Z" fill="currentColor" opacity=".88"/><path d="M20 30V15" stroke="var(--cream)" stroke-width="1.4"/></svg>';
const brand = `<a class="brand" href="/" aria-label="Flutterings home">${mark}<span>flutterings</span></a>`;
const button = (href, text, secondary = false) =>
  `<a class="button ${secondary ? "secondary" : ""}" href="${href}">${text} ${arrow}</a>`;
const photo = (screen, alt, extra = "") =>
  `<img src="/assets/app-${screen}.png" alt="${alt}" width="390" height="844" ${extra}>`;
const device = (screen, extra = "") =>
  `<div class="device ${extra}"><div class="device-top" aria-hidden="true"><span>9:41</span><span>••• ▰</span></div>${photo(screen, `Flutterings ${screen} screen with illustrative sample records`)}</div>`;
const stem = `<svg class="botanical" viewBox="0 0 260 450" fill="none" aria-hidden="true"><path d="M97 437C195 306 62 153 199 18M137 289C77 287 39 251 31 214c63 0 92 30 106 75ZM142 229C209 204 227 173 224 132c-49 15-77 51-82 97ZM136 168C78 160 69 126 67 93c45 7 67 39 69 75ZM167 94C221 83 236 53 231 24c-38 13-60 36-64 70Z" stroke="currentColor" stroke-width="1.5"/><path d="M31 214l106 75M224 132l-82 97M67 93l69 75" stroke="currentColor" opacity=".5"/></svg>`;
const privacyStrip = `<section class="privacy-band"><div class="wrap privacy-layout"><div><span class="eyebrow light">YOUR RECORDS. YOUR CHOICES.</span><h2>A private space,<br>with clear controls.</h2></div><div><p>Keep memories private. Choose what a support person can see. Review access when your needs change.</p><a class="text-link light" href="/privacy/">Read about privacy ${arrow}</a><span class="small-note light">Policy draft available for review.</span></div></div></section>`;
const cta = `<section class="closing wrap"><span class="eyebrow">TAKE A LOOK INSIDE</span><h2>A little space for<br>your own experience.</h2><p>Explore the screens, at your own pace.</p>${button("/preview/", "Explore the app")}${stem}</section>`;

function layout(key, title, description, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title} · Flutterings</title><meta name="description" content="${description}"><meta name="theme-color" content="#f9f6f0"><link rel="icon" type="image/svg+xml" href="/assets/favicon.svg"><link rel="stylesheet" href="/site.css"><script src="/site.js" defer></script></head><body><a class="skip" href="#main">Skip to content</a><div class="site-note">A first look at Flutterings <span aria-hidden="true">·</span> Website preview</div><header class="site-header"><div class="wrap nav-row">${brand}<button class="menu-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="site-nav"><span aria-hidden="true">☰</span></button><nav id="site-nav" aria-label="Main navigation">${[
    ["features", "The app"],
    ["memories", "Memories"],
    ["privacy", "Privacy"],
    ["support", "Support"],
  ]
    .map(
      ([route, label]) =>
        `<a href="/${route}/" ${route === key ? 'aria-current="page"' : ""}>${label}</a>`,
    )
    .join(
      "",
    )}${button("/preview/", "Explore the app")}</nav></div></header><main id="main" tabindex="-1">${body}</main><footer><div class="wrap footer-top"><div class="footer-brand">${brand}<p>A thoughtful companion for pregnancy<br>and the days after birth.</p></div><div><h2>Explore</h2><a href="/features/">The app</a><a href="/memories/">Memories</a><a href="/features/#after-birth">After birth</a><a href="/preview/">App preview</a></div><div><h2>Help &amp; privacy</h2><a href="/privacy/">Privacy policy</a><a href="/support/">Support</a><a href="/delete-account/">Delete your account</a><a href="/privacy/#your-choices">Your data choices</a></div></div><div class="wrap footer-bottom"><span>Flutterings · Your experience, in your words.</span><p>For personal records and planning. Not a medical service.</p><a href="#main">Back to top ↑</a></div></footer></body></html>`;
}

const home = `<section class="hero wrap"><div class="hero-copy"><span class="eyebrow"><span class="little-dot"></span> A LITTLE SPACE, JUST FOR YOU</span><h1>For the moments<br>you want to<br><em>hold onto.</em></h1><p>A thoughtful pregnancy companion for your memories, your questions, and the people you choose to share them with.</p><div class="hero-actions">${button("/preview/", "Explore Flutterings")}<a class="text-link" href="/memories/">Meet Memories ${arrow}</a></div><div class="hero-note"><span class="fine-icon" aria-hidden="true">♡</span><span>At your pace. In your words.</span></div></div><div class="hero-art"><div class="art-orbit"></div>${stem}<span class="art-label">YOUR EVERYDAY, REMEMBERED</span>${device("memories", "hero-device")}<div class="paper-note"><span class="eyebrow">A MOMENT TO KEEP</span><p>“The first<br>little flutter.”</p><span class="small-note">Illustrative journal entry</span></div><div class="art-caption"><span class="sparkle" aria-hidden="true">✳</span> Small moments.<br>Room to remember.</div></div></section>
<div class="principles wrap"><span>Private memories</span><span>Practical plans</span><span>Support you choose</span><span>Room for every feeling</span></div>
<section class="intro wrap"><span class="eyebrow">MADE FOR YOUR EXPERIENCE</span><h2>More room for you.<br><em>Less to keep in your head.</em></h2><p>Some days have a lot to say. Others do not. Keep what matters in one place, without a score or a streak to maintain.</p></section>
<section class="app-tour wrap" aria-labelledby="tour-heading"><div class="tour-visual"><div class="tour-tabs" role="tablist" aria-label="App screen preview">${["Today", "Memories", "Care"].map((name, i) => `<button role="tab" id="tab-${name.toLowerCase()}" aria-controls="panel-${name.toLowerCase()}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${name}</button>`).join("")}</div>${["today", "memories", "care"].map((screen, i) => `<div role="tabpanel" id="panel-${screen}" aria-labelledby="tab-${screen}" ${i ? "hidden" : ""}>${device(screen)}</div>`).join("")}<span class="small-note">Real app screens · illustrative records</span></div><div class="tour-copy"><span class="eyebrow">ONE PLACE, MANY SMALL MOMENTS</span><h2 id="tour-heading">A companion.<br><em>Not another task.</em></h2><div class="feature-line"><span>01</span><div><h3>Start with today</h3><p>See your next appointment or choose a small check-in. Nothing needs a perfect answer.</p></div></div><div class="feature-line"><span>02</span><div><h3>Remember your way</h3><p>Write a note. Add a photo or a voice memory in the app. Choose which moments return.</p></div></div><div class="feature-line"><span>03</span><div><h3>Make room for questions</h3><p>Keep appointment questions and practical plans where you can find them.</p></div></div><a class="text-link" href="/features/">Discover the features ${arrow}</a></div></section>
<section class="memories-feature"><div class="wrap memories-layout"><div><span class="eyebrow">MEMORIES</span><h2>The small things<br><em>are part of your story.</em></h2><p>A sentence about your day. A photo you love. A thought you are not ready to share. Keep it in a space that starts private.</p>${button("/memories/", "Make room for memories", true)}</div><div class="journal-art"><div class="journal-page"><span class="eyebrow">A NOTE TO REMEMBER</span><p>Today, I made a little<br>room for myself.</p><div class="paper-rule"></div><div class="paper-rule short"></div><span class="private-tag">♡ &nbsp; Private memory</span></div><span class="journal-caption">An illustrative note. Your words belong here.</span><span class="pressed-petal petal-one"></span><span class="pressed-petal petal-two"></span></div></div></section>
<section class="support-section wrap"><div class="section-title"><div><span class="eyebrow">WHEN YOUR NEEDS CHANGE</span><h2>Support that leaves<br>the choices with you.</h2></div><p>Prepare for a visit, ask for practical help, or find a quieter space after birth.</p></div><div class="support-grid"><a class="support-tile rose" href="/features/#care"><span class="tile-number">01 / CARE</span><h3>A place for<br>your questions.</h3><p>Prepare for appointments with notes you can review and edit.</p><span class="tile-link">Explore Care ${arrow}</span></a><a class="support-tile sage" href="/features/#together"><span class="tile-number">02 / TOGETHER</span><h3>Share a little.<br>Keep the rest yours.</h3><p>Choose access by category, with exceptions for individual items.</p><span class="tile-link">Explore Together ${arrow}</span></a><a class="support-tile oat" href="/features/#after-birth"><span class="tile-number">03 / AFTER BIRTH</span><h3>Room for<br>what comes next.</h3><p>Optional reflections, support plans, and care questions after birth.</p><span class="tile-link">Explore after birth ${arrow}</span></a></div></section>${privacyStrip}${cta}`;

const featureRows = [
  [
    "care",
    "01",
    "Questions worth keeping.",
    "Care, in your own words.",
    "Bring your questions together before an appointment. Use an optional prompt, set a priority, and choose what belongs in a provider summary.",
    [
      "Appointment questions and visit notes",
      "Provider and emergency contact records",
      "A summary you can review before sharing",
    ],
    "care",
  ],
  [
    "planning",
    "02",
    "A smaller next step.",
    "Plans you can make your own.",
    "Start with a hospital bag, birth preferences, support at home, or support after birth list. Edit the words and leave out anything you do not need.",
    [
      "Edit, complete, remove, and restore tasks",
      "Choose which plan a new task belongs to",
      "Review sharing before involving someone else",
    ],
    null,
  ],
  [
    "together",
    "03",
    "Support, with a choice.",
    "Bring your people closer.",
    "Ask for practical help without sharing every private record. Choose the categories a support person can see, then make exceptions for individual items.",
    [
      "Category access and item exceptions",
      "Short requests for practical support",
      "Access review and revocation",
    ],
    null,
  ],
  [
    "after-birth",
    "04",
    "A different kind of today.",
    "A space after birth, too.",
    "Enable the optional recovery space when it is useful. Find care questions, a support plan, and private reflection prompts without a required daily routine.",
    [
      "An optional after-birth space",
      "Private reflections and saved memories",
      "Pregnancy settings you can change",
    ],
    "recovery",
  ],
];
const features = `<section class="page-hero wrap"><span class="eyebrow">THE FLUTTERINGS APP</span><h1>One place for<br><em>your own experience.</em></h1><p>Keep the personal moments and the practical details together. Choose the parts that help you today.</p><nav class="section-links" aria-label="Feature sections"><a href="#care">Care</a><a href="#planning">Planning</a><a href="#together">Together</a><a href="#after-birth">After birth</a></nav></section>${featureRows.map(([id, number, kicker, title, body, items, screen]) => `<section id="${id}" class="feature-detail wrap"><div><span class="eyebrow">${number} / ${kicker}</span><h2>${title}</h2><p>${body}</p><ul class="check-list">${items.map((item) => `<li>${item}</li>`).join("")}</ul><a class="text-link" href="/preview/">See the app ${arrow}</a></div><div class="detail-visual ${id}">${screen ? device(screen) : id === "planning" ? `<div class="plan-paper"><span class="eyebrow">A PLAN, MADE YOURS</span><h3>Support at home</h3><p class="checked">A meal in the freezer</p><p>Someone to do the laundry</p><p>Time for a quiet moment</p><span class="small-note">Illustrative plan · every item is editable</span></div>` : `<div class="sharing-paper"><span class="eyebrow">SHARE WHAT HELPS</span><h3>A little practical help.</h3><p class="request-note">Could you bring dinner?</p><div class="sharing-row"><span>Support request</span><span class="private-tag">Shared</span></div><div class="sharing-row"><span>Your journal</span><span class="private-tag">Private</span></div><small>Illustrative choices, not an active invitation.</small></div>`}</div></section>`).join("")}<section class="wrap note-section"><h2>A place to record, not to diagnose.</h2><p>Check-ins and meal notes have no health scores or calorie targets. Flutterings does not assess symptoms or replace your care team. Weekly reading appears only after the app’s content review process; unapproved drafts stay hidden.</p></section>${privacyStrip}${cta}`;

const memories = `<section class="wrap memory-hero"><div><span class="eyebrow">YOUR MEMORIES</span><h1>Some moments<br>are just<br><em>for you.</em></h1><p>There is no right way to tell your story. Start with a sentence, a photo, or a voice note. Keep what feels worth keeping.</p>${button("/preview/", "See Memories in the app")}<span class="small-note">Photos and voice recording require the installed app.</span></div><div class="memory-hero-art">${device("memories")}${stem}</div></section><section class="wrap memory-steps"><div class="section-title"><div><span class="eyebrow">IN YOUR WORDS</span><h2>A memory does not<br>need to be a milestone.</h2></div><p>A feeling. An ordinary afternoon. A thought for later. There is room for all of it.</p></div><div class="three-columns"><article><span class="step-mark">01</span><h3>Keep a little</h3><p>Save notes, photos, and voice moments. Add tags or mark favourites to find them again.</p></article><article><span class="step-mark">02</span><h3>Choose what returns</h3><p>Gentle memory moments start off. Turn them on for an entry only when you want to see it again.</p></article><article><span class="step-mark">03</span><h3>Gather your week</h3><p>Choose up to five eligible entries for a weekly capsule. Saving a capsule does not share it.</p></article></div></section><section class="memory-quote"><span class="eyebrow">NO PERFECT WORDS NEEDED</span><h2>“I wanted to remember<br>how today felt.”</h2><p>An illustrative journal note. Your story can be just as simple.</p></section>${privacyStrip}${cta}`;

const policy = `<section class="page-hero wrap policy-heading"><span class="eyebrow">PRIVACY &amp; YOUR DATA</span><h1>Clear choices.<br><em>Personal records.</em></h1><p>Understand what you record, what you share, and where to find your controls.</p><div class="draft-note"><strong>Draft policy — not ready for publication</strong><p>This page describes the current app design. Operator details, service providers, retention periods, and launch regions still need confirmation. It is not a final legal policy.</p></div></section><div class="wrap policy-layout"><nav aria-label="Privacy contents"><span class="eyebrow">ON THIS PAGE</span><a href="#operator">Who operates Flutterings</a><a href="#records">Information in the app</a><a href="#use">How records are used</a><a href="#sharing">Sharing and services</a><a href="#your-choices">Your choices</a><a href="#retention">Retention and deletion</a><a href="#website">This website preview</a></nav><div class="policy-copy"><section id="operator"><span class="eyebrow">01</span><h2>Who operates Flutterings</h2><dl class="facts"><div><dt>Legal operator</dt><dd>To be confirmed</dd></div><div><dt>Operator address</dt><dd>To be confirmed</dd></div><div><dt>Privacy contact</dt><dd>To be confirmed</dd></div><div><dt>Effective date and launch regions</dt><dd>To be confirmed</dd></div></dl><p>Age eligibility and any region-specific rights or notices must be confirmed before this policy is published.</p></section><section id="records"><span class="eyebrow">02</span><h2>Information in the app</h2><p>The app supports account details, pregnancy dates and settings, and records you choose to enter. These can include:</p><ul><li>Journal text, photos, voice notes, tags, and memory preferences.</li><li>Check-ins, feelings, symptoms, meal notes, and wellness observations.</li><li>Appointments, questions, contacts, medication records, and documents.</li><li>Plans, tasks, support requests, and sharing choices.</li></ul><p>Account, invitation, consent, notification, and security records also support the service. The final policy must confirm the exact technical logs and service data collected.</p></section><section id="use"><span class="eyebrow">03</span><h2>How records are used</h2><p>The app uses your entries to show your records, organise your plans, prepare summaries you select, and apply your sharing choices. Notification settings control the reminders you request.</p><p>Flutterings is a personal record and planning tool. It does not diagnose symptoms or replace professional care. The final policy must state the operator’s confirmed purposes and any applicable legal bases.</p></section><section id="sharing"><span class="eyebrow">04</span><h2>Sharing and services</h2><p>Journal entries start private. Marking an entry Shared does not make it public: a person must also have the relevant active access. You can review category access and individual exceptions.</p><p>Removing access cannot remove copies someone has already saved outside the app. Exporting or sharing a file also moves it outside Flutterings.</p><p>The source uses Supabase for backend services and Expo with platform notification services for delivery. Actual production providers, email delivery, hosting regions, contracts, international transfers, and any other recipients must be confirmed for the final policy.</p><p>This draft makes no claim about HIPAA coverage, end-to-end encryption, data sales, advertising, or AI training. Business and legal commitments need confirmation.</p></section><section id="your-choices"><span class="eyebrow">05</span><h2>Your choices</h2><ul class="check-list"><li>Review partner access and stop sharing.</li><li>Keep notification content generic on the lock screen.</li><li>Use the app’s optional device lock where supported.</li><li>Export account records or request permanent account deletion.</li></ul><p>Find these controls in <strong>Privacy and data</strong> in the app. An account export includes written records, settings, and a media inventory; it does not include the photo, audio, or document files themselves.</p><a class="text-link" href="/delete-account/">How account deletion works ${arrow}</a></section><section id="retention"><span class="eyebrow">06</span><h2>Retention and deletion</h2><p>The current deletion flow removes registered private media and active account records. Backup, security, consent, and other retention periods have not been established for this draft.</p><div class="draft-note"><strong>Details still required</strong><p>Confirm record retention, backup deletion, required exceptions, request verification, response times, and an external deletion contact before publication.</p></div></section><section id="website"><span class="eyebrow">07</span><h2>This website preview</h2><p>This static preview has no sign-up form, analytics integration, or tracking cookies. Its fonts and images are served locally. If hosting, analytics, or other services are added, this section must be updated to reflect them.</p><p>The separate working app preview saves test records in browser storage. Those records are not sent to an app account. Reset them from <strong>Preview shortcuts and limits → Reset saved preview</strong>.</p><p>Health imports and voice transcription are not active in the current preview. Phone features, account export, and real account deletion require the installed app and configured services.</p></section></div></div>`;

const support = `<section class="page-hero wrap"><span class="eyebrow">HERE TO HELP YOU FIND YOUR WAY</span><h1>A little clarity.<br><em>A clear next step.</em></h1><p>Find the right control, understand the preview, or review how to manage your records.</p></section><section class="wrap support-options"><a href="/privacy/#your-choices"><span class="eyebrow">01 / PRIVACY</span><h2>Your data choices ${arrow}</h2><p>Sharing, device protection, and account records.</p></a><a href="/delete-account/"><span class="eyebrow">02 / ACCOUNT</span><h2>Delete your account ${arrow}</h2><p>Find the in-app steps and the status of external requests.</p></a></section><section class="wrap faq"><div><span class="eyebrow">COMMON QUESTIONS</span><h2>Start here.</h2></div><div>${[
  [
    "Is Flutterings a medical service?",
    "Flutterings does not diagnose symptoms or replace your care team.",
  ],
  [
    "Can I try the app now?",
    "The working local preview is available on this computer. It uses sample data. Store download links are not yet configured on this website.",
  ],
  [
    "What stays private?",
    "Journal entries start private. Sharing requires both an entry marked Shared and active access for the other person. You can review access in Together.",
  ],
  [
    "Will my preview changes survive refresh?",
    "Saved records and automatic drafts stay in the same browser profile at the same app-preview address. Use Save where the screen provides it. Clearing site data or resetting the preview removes those records.",
  ],
  [
    "How do I turn on support after birth?",
    "Open Pregnancy settings in the app, choose Birth recorded, and enable Maternal recovery mode. In the local preview, the Demo stage selector also opens an after-birth example.",
  ],
]
  .map(
    ([q, a]) =>
      `<details><summary>${q}<span aria-hidden="true">+</span></summary><p>${a}</p></details>`,
  )
  .join(
    "",
  )}</div></section><section class="wrap note-section"><span class="eyebrow">CONTACT</span><h2>Support details are being confirmed.</h2><p>A support email and service hours will appear here before launch. This preview does not receive support messages. Do not send health records to an unverified address.</p></section>`;

const deletion = `<section class="page-hero wrap"><span class="eyebrow">YOUR ACCOUNT &amp; RECORDS</span><h1>Leave with<br><em>a clear choice.</em></h1><p>Account deletion is available through the app’s Privacy and data screen. This website preview does not delete accounts.</p></section><section class="wrap deletion-layout"><div><h2>From the app</h2><ol class="numbered-steps"><li><span>01</span><div><h3>Open Privacy and data</h3><p>Open Today and find the Privacy and data control.</p></div></li><li><span>02</span><div><h3>Choose Delete my account</h3><p>Review what will be removed. Export records first if you want a copy.</p></div></li><li><span>03</span><div><h3>Confirm your choice</h3><p>Type DELETE and use Permanently delete account. Deletion cannot be undone.</p></div></li></ol></div><aside class="deletion-note"><span class="eyebrow">BEFORE YOU CONTINUE</span><h2>Know what changes.</h2><p>The current flow removes active account records, registered private media, and sharing access. Backup and other retention periods still need confirmation in the final policy.</p><a class="text-link" href="/privacy/#retention">Review retention details ${arrow}</a></aside></section><section class="wrap note-section"><h2>Cannot access the app?</h2><div class="draft-note"><strong>External deletion contact: to be confirmed</strong><p>A verified way to request account deletion outside the app must be added before launch. No request form or monitored email is connected to this preview.</p></div><a class="text-link" href="/support/">Support information ${arrow}</a></section>`;

const preview = `<section class="page-hero wrap"><span class="eyebrow">A FIRST LOOK</span><h1>A little more<br><em>than a screenshot.</em></h1><p>Explore the actual app screens with sample records. Save a memory, prepare a question, or make a plan.</p><div class="local-preview"><a class="button" id="working-preview" href="http://127.0.0.1:5173/?screen=today&amp;preview=website" target="_blank" rel="noopener">Open working app preview ${arrow}</a><span class="small-note">Opens the local app preview in a new tab on this computer.</span></div><p class="preview-unavailable" hidden>The interactive preview is available only on the development computer. Explore the sample screens below.</p></section><section class="wrap preview-gallery" aria-label="App screen gallery">${[
  ["today", "Today", "One useful step, at your pace."],
  ["memories", "Memories", "Personal notes, chosen by you."],
  ["care", "Care", "Questions ready for your visit."],
  ["recovery", "After birth", "Optional support for what comes next."],
]
  .map(
    ([screen, title, caption]) =>
      `<figure>${device(screen)}<figcaption><h2>${title}</h2><p>${caption}</p></figcaption></figure>`,
  )
  .join(
    "",
  )}</section><section class="wrap note-section"><h2>A preview, with clear limits.</h2><p>These are real app screens with illustrative records. Local changes stay in the same browser. Invitations are not sent. Camera, voice recording, calendar, push notifications, account export, and account deletion require the installed app and configured services.</p><p>Flutterings is in development. App Store and Google Play download links will appear when available.</p></section>`;

const pages = [
  [
    "",
    "home",
    "Your experience, in your words",
    "A thoughtful pregnancy companion for memories, personal plans, and support you choose.",
    home,
  ],
  [
    "features",
    "features",
    "The app",
    "Explore Flutterings Care, planning, Together, and optional support after birth.",
    features,
  ],
  [
    "memories",
    "memories",
    "Memories",
    "A private space for personal notes, photos, and voice moments.",
    memories,
  ],
  [
    "privacy",
    "privacy",
    "Privacy policy draft",
    "Review Flutterings privacy controls and the policy details still awaiting confirmation.",
    policy,
  ],
  [
    "support",
    "support",
    "Support",
    "Find help with Flutterings preview, sharing, and account controls.",
    support,
  ],
  [
    "delete-account",
    "delete-account",
    "Delete your account",
    "Find the current in-app account deletion steps and external request status.",
    deletion,
  ],
  [
    "preview",
    "preview",
    "Explore the app",
    "Explore actual Flutterings screens with illustrative sample records.",
    preview,
  ],
];
for (const [route, key, title, description, body] of pages) {
  const folder = path.join(dist, route);
  await mkdir(folder, { recursive: true });
  await writeFile(
    path.join(folder, "index.html"),
    layout(key, title, description, body),
  );
}
await writeFile(
  path.join(dist, "404.html"),
  layout(
    "404",
    "Page not found",
    "Find your way back to Flutterings.",
    `<section class="page-hero wrap"><span class="eyebrow">404 / PAGE NOT FOUND</span><h1>Let’s find<br><em>your way back.</em></h1><p>This page is not available.</p>${button("/", "Back to home")}</section>`,
  ),
);
await writeFile(path.join(dist, "robots.txt"), "User-agent: *\nDisallow: /\n");
console.log(
  "Built seven Flutterings pages and a 404 page. Local preview only; policy remains a draft.",
);
