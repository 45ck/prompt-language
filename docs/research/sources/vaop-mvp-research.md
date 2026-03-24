# VAOP MVP research programme: extracting and synthesising domain models from open-source systems

## Objective and framing for VAOP’s MVP

The MVP problem you’re solving is not “build an ERP/CRM/helpdesk/marketing suite”, but “build a control plane that can safely *operate* those suites”. That framing makes the research programme sharply different to a typical “integration platform” study: you are not primarily learning endpoints; you are learning **domain semantics + safe action surfaces** so you can enforce approval tiers, scope, RBAC, credential handling, and evidence capture consistently across many Systems of Record.

Two external patterns are worth internalising because they map directly to VAOP’s non‑negotiables:

A durable workflow engine can achieve reliability by **appending an event history of what happened**, which supports crash recovery and continued progress; it also formalises timeouts/retries at the activity level rather than the “entire job” level. citeturn9search1turn9search0

Durable workflow engines also tend to explicitly recommend that externally-effectful activities be **idempotent**, because automatic retries are a core feature (which otherwise risk duplicate side effects). citeturn9search3turn9search0

Those traits strongly align with your execution tiers and approval-gate semantics: approvals are workflow pauses, and “diff → approve → execute” needs deterministic replay and safe retries, not “best effort”. citeturn9search1turn9search4turn9search0

Similarly, mature runbook automation platforms often ship first-class operational logs, including explicit **audit trail logs** that record tracked user/system activity and the involved resources/actions. That maps cleanly to “evidence-as-differentiator” and your append-only posture. citeturn1search8turn1search4turn1search20

Finally, if you want “immutable evidence” to be more than a slogan, it is useful to understand what systems mean by *immutable*: for example, an “immutable database” may allow new versions but not in-place changes/deletes, explicitly positioning immutability as tamper-resistance. citeturn5search1turn5search5

## What you must research for the MVP

Your MVP research should produce **artefacts** that directly become VAOP primitives (schemas, contracts, test suites), not just notes. The research targets below are ordered by “unlocking power” for an MVP.

First, define the minimum *canonical* domain surface area as VAOP contracts: your canonical objects (Customer, Lead, Ticket, Invoice, Payment, Employee, Task, Campaign, Asset, Document) are the right kind of “minimum shared objects”, but research has to determine *which fields* and *which invariants* are genuinely stable cross-system. For example, many ERP/CRM platforms model “party” (individual/company/contact address) as a single concept with specialisations; that decision changes everything about identity, deduplication, approvals, and risk tiering for actions that target “a customer”. citeturn3search0

Second, treat “Port + Adapter” not as architecture words but as a required **contract definition project**. For each port (CRM, Accounting, Support, Comms/Calendar/Email, Payments, Marketing), you need a typed surface:

- read models (query shapes, filters, pagination)
- write models (create/update semantics, partial updates, validation failures)
- event hooks (webhooks, polling, or “no events”)
- limits (rate limits, batching, idempotency keys, concurrency rules)

A useful mental model is the way connector ecosystems describe resources: a “Stream” is a resource schema plus metadata about how users can interact; a “Catalog” is a list of those streams; and individual fields are explicitly typed. citeturn11search1turn1search10

Third, codify your “Capability Matrix” as a formal schema, not a wiki page. Connector platforms often require structured metadata about connectors (definition IDs, images/tags, capabilities, and other properties) precisely because automation needs deterministic discovery and governance. citeturn11search9

Fourth, approvals require a **diff/preview model** that is consistent across very different SoRs. Your research here is: what are the smallest set of “diff primitives” you can guarantee a provider can produce for a proposed action? In practice, you often end up with (a) *object snapshots* (before/after), (b) *field diffs* (changed fields), and (c) *external effects* (emails sent, invoices issued, refunds created) as a higher-liability class.

Fifth, evidence logging must be designed as an “append-only, queryable narrative” of execution: workflow history/event logs are already append-only by nature (events are appended as progress is tracked), which is the same conceptual tool you want for “run evidence”. citeturn9search1turn9search21

Sixth, local verification needs to be treated as a first-class deliverable because SaaS APIs are flaky and rate-limited. Here, it’s useful to study ecosystems that enforce deterministic connector development: many require schemas as JSON Schema and explicitly describe how connector outputs must conform to those schemas. citeturn11search2turn11search15

## Surgical OSS study method that produces VAOP-ready artefacts

This method assumes your goal is *pattern extraction + model synthesis*, not code reuse. It is designed to produce repeatable outputs you can later regenerate as upstream repos evolve.

Start by building a “Domain Atlas” repo (internal to VAOP) whose only job is to store extracted artefacts:

- `sources/` (per upstream repo: commit hash, licence, runtime instructions)
- `extracted/` (machine-readable domain snapshots)
- `mappings/` (canonical mapping tables and notes)
- `capabilities/` (capability matrix instances per provider)
- `tests/` (contract tests per port + record/replay fixtures)
- `decisions/` (short ADR-like notes justifying canonical field choices)

Then apply the same extraction loop for each upstream system.

**Step one: repo intake and licence classification.** Store the upstream licence and classify it as “safe to reuse”, “study only”, or “unsafe for critical path dependencies”. For example, some widely used automation/integration products are “fair-code”/source-available in a way that conflicts with a permissive-core posture. citeturn1search11turn1search3

**Step two: identify where the domain model actually lives.** In practice, domain models are usually encoded in one (or more) of:

- ORM entity classes (e.g., Doctrine entities; Rails models; Python ORM models)
- “DocType” / metadata-driven schemas
- DB migrations (the most honest field list)
- OpenAPI/GraphQL schema files
- REST API “entity response examples”
- “custom fields” subsystems (important for extension strategy)

Examples of these patterns:
- Some marketing automation systems define schema via Doctrine ORM entities and specify that plugins define their schema using entity classes stored in an `Entity` directory. citeturn2search7  
- Some frameworks treat “DocType” (model + view descriptor) as the core building block of the application. citeturn2search9  
- Some helpdesk systems talk explicitly about “objects” such as tickets/users/organisations and how custom fields attach to them—this is directly relevant to how VAOP should represent vendor-specific extensions without bloating the canonical model. citeturn2search2turn2search6

**Step three: extract into a canonical intermediate format (CIF).** Don’t jump straight to “VAOP canonical objects”. Instead, extract each system into a neutral JSON format such as:

- `entities`: name, description, primary key(s), unique constraints
- `fields`: name, type, required/optional, default, validation notes
- `relationships`: cardinality, cascade semantics
- `lifecycles`: status fields, state transitions, “submit/post” steps
- `actions`: CRUD + workflow-ish actions (“convert lead”, “post invoice”, “send campaign”)
- `events`: webhook/event stream support and objects that emit changes
- `extension_points`: custom fields, tags, attachments, comments, activities

This is where you can run “Claude Code” as an assistant, but keep the output accountable: it should point to file paths and line ranges, and you should store both (a) a machine-readable JSON snapshot and (b) a short narrative summary.

**Step four: map CIF → VAOP canonical objects through an Anti‑Corruption Layer lens.** Mappings should be explicit and versioned: for each canonical object, list which upstream entities map to it, which fields are “canonical”, and which are “vendor extension”. Don’t collapse semantics that differ materially (e.g., “lead” vs “contact” vs “visitor”; “invoice draft” vs “posted invoice”). citeturn3search14turn2search23

**Step five: derive the provider capability matrix from actions, not from objects.** A connector protocol’s framing is useful here: a “resource” carries a schema plus interaction metadata. Your capability matrix should similarly describe action support, constraints, and safety properties rather than “we support invoices”. citeturn11search1turn11search9

**Step six: convert your findings into executable contract tests.** The loop closes only when you can stand up a local dev stack, run workflows against either a sandbox or record/replay fixtures, and validate that adapters implement port contracts and that “diff” generation is deterministic enough for approvals. The requirement that connectors describe stream schemas using JSON Schema (and that records conform to a defined type system) is a good example of the level of strictness that makes ecosystems robust. citeturn11search2turn11search15

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["hexagonal architecture ports and adapters diagram","workflow orchestration durable execution event history diagram","runbook automation audit trail log example","data connector catalog stream schema diagram"],"num_per_query":1}

## Priority list of apps and open-source repos to study

This list is designed to support both: (a) extraction of domain models for your canonical objects, and (b) extraction of platform patterns (workflow durability, RBAC, audit, connector metadata).

The items below are the *repositories to clone and study first*; where the upstream system is not open-source (many SaaS platforms), the focus shifts to open-source SDKs/specs/connectors that encode the domain objects.

Core Systems of Record exemplars for domain-model extraction:

- entity["company","Odoo","erp software platform"] — a broad ERP suite whose developer docs explicitly describe the `res.partner` concept (“physical or legal entity … company, individual, or contact address”), making it a strong anchor for modelling “Customer/Party” and related relationships. citeturn3search0 Its community repository states it is LGPLv3, which matters for “study vs reuse” decisions. citeturn15view0turn0search4
- entity["organization","ERPNext","frappe erp"] — another broad ERP whose core data modelling revolves around DocTypes, explicitly treated as the core building block describing model and view; this is valuable because it often makes domain intent more explicit than raw migrations. citeturn2search9 ERPNext is documented as GPLv3 open source (strong copyleft), so it should be treated as “pattern extraction + SoR integration”, not “dependency in VAOP core”. citeturn0search17turn16view0
- entity["organization","Zammad","helpdesk software"] — a helpdesk/ticketing system where “objects” (tickets, users, organisations, groups) and custom fields are first-class documentation topics; this is a direct input to your canonical Ticket and Document/Asset evidence strategy. citeturn2search2turn2search6 It is licensed under AGPLv3. citeturn17view0turn0search2
- entity["organization","Mautic","marketing automation"] — marketing automation with documented REST contact entities and explicit schema practices: it uses Doctrine ORM and describes how plugin schemas are defined via entity classes (a good “where are the models?” clue for extraction automation). citeturn2search3turn2search7 Its licence text states GPLv3 (or later) and explicitly repeats “Mautic is released under the GPL v3.” citeturn14view0turn0search3

SaaS domain-schema sources and OSS connectors (for when the SoR itself is not open source):

- entity["company","Stripe","payments platform"] — use the official OpenAPI specification repository as your machine-readable “domain model source of truth” for Payments/Invoices/Events; it’s explicitly described as OpenAPI specs that can be used to generate SDKs and includes endpoints and events. citeturn4search0turn4search4
- entity["company","Google","internet services"] via entity["organization","Google Workspace","productivity suite"] — use officially supported client libraries as schema hints and type references. For example, the Node.js client library is an official repository with OAuth2 support that includes generated API types (useful for Calendar/Gmail modelling). citeturn4search3turn4search11 This is where you cover entity["organization","Gmail","email service"] and entity["organization","Google Calendar","calendar service"] for comms + scheduling ports. citeturn4search3turn4search11
- entity["company","HubSpot","crm platform"] — study open-source connectors that enumerate the objects they extract (contacts, companies, deals, tickets, etc.). One example is the OSS Singer tap, which explicitly lists extraction of HubSpot resources and follows the standard JSON-based spec. citeturn4search2turn11search6 Airbyte’s HubSpot connector documentation also provides connector-level semantics and authentication approaches. citeturn4search1
- entity["company","Xero","accounting software"], entity["organization","QuickBooks","accounting software"], entity["company","Zendesk","customer support software"], entity["organization","Freshdesk","helpdesk software"], entity["company","Mailchimp","email marketing platform"] — for these, the practical “open-source repo to study” is typically one of: (a) OpenAPI specs if published, (b) official SDK repos, (c) Airbyte/Singer/nodes connectors enumerating objects and fields. The methodological point is consistent even when the SoR code is closed: treat *schema artefacts* as the model source.

Connector ecosystem and metadata patterns (to inform VAOP adapters + capability matrices):

- entity["company","Airbyte","data integration platform"] — study its protocol concepts: Catalog/Stream/Field as explicit primitives for “resource schema + interaction metadata”, and the requirement that stream schemas be described using JSON Schema. citeturn11search1turn11search2 Also study its connector metadata file conventions, which are concrete examples of “capability discovery needs structured metadata”. citeturn11search9
- entity["organization","Singer","data connector spec"] (and the broader ecosystem via entity["organization","Meltano","singer-based etl tool"] hubs) — Singer documentation describes taps/targets, JSON-based messages, and JSON Schema support; this is a good reference point for designing VAOP adapter “ports” that are composable and standardised without forcing a single DB schema. citeturn11search3turn11search0

Control-plane adjacent OSS projects (to extract patterns for workflows, audit, plugins, and operator UX):

- entity["company","Temporal","workflow orchestration"] — use it as your canonical reference for durable execution behaviour: activity retries/timeouts, event history as an append-only record enabling durable execution, and explicit idempotency recommendations. citeturn9search0turn9search1turn9search3 Its server repository is MIT-licensed. citeturn1search0
- entity["organization","Rundeck","runbook automation"] (by entity["company","PagerDuty","incident response platform"]) — study audit trail log semantics and operational logging layout; it has explicit docs on audit trail logs and the files used for audit events. citeturn1search8turn1search4
- entity["organization","StackStorm","event automation"] — it positions itself as integration/automation across services and tools, and its documentation distinguishes “integration packs” and “automation packs”, which is directly relevant to your “adapters vs machines” separation and packaging discipline. citeturn10search1turn10search5
- entity["organization","Backstage","developer portal framework"] — study plugin maintenance/packaging discipline (core vs community plugins) and “portal pattern” decisions. The project describes itself as an open framework for building developer portals; its ecosystem includes a dedicated community plugins repository. citeturn10search0turn10search16turn10search20
- entity["organization","Argo Workflows","kubernetes workflow engine"] — a contrasting workflow engine model (Kubernetes CRD-based) that helps validate whether your workflow abstraction is sufficiently engine-agnostic at the VAOP boundary. citeturn10search3turn10search7turn10search11
- entity["organization","Conductor","netflix workflow engine"], originally created by entity["company","Netflix","streaming company"] — a microservices orchestration engine that provides an alternative set of design patterns for orchestration, persistence modules, and extensibility. citeturn10search2turn10search10

Security, policy, and credential management pattern sources:

- entity["organization","Open Policy Agent","policy engine"] — a general-purpose policy engine with Apache 2.0 licensing; study it as a “later OPA posture” reference even if MVP uses simple rules. citeturn5search7turn5search3
- entity["organization","OpenFGA","fine-grained authz"] — an open-source fine-grained authorisation system (Apache 2.0 in repo listings) that’s explicitly designed for relationship-based permissions; study its modelling language and API posture as a “future RBAC/ABAC evolution” reference. citeturn5search6turn5search10
- entity["organization","OpenBao","secrets management"] — an open source, community-driven fork of entity["company","HashiCorp","devops tools vendor"] Vault under entity["organization","Linux Foundation","open source steward"] stewardship (the site describes it that way). citeturn5search8turn5search0 Its current LICENCE file is Mozilla Public License 2.0, which you must account for in “critical path dependency” decisions. citeturn8view0

Immutable evidence and append-only storage references:

- entity["organization","immudb","immutable database"] by entity["company","Codenotary","software security firm"] — study its immutability model (“never change or delete records”) and cryptographically-immutable log description as a concrete reference for evidence immutability claims. citeturn5search1turn5search5

One explicit “do not depend on in core, but ok to study” example:

- n8n is a workflow automation platform whose documentation frames its licence as a “Sustainable Use License” and the repository describes it as “fair-code”. That conflicts with a permissive-core critical path posture, but it can still be studied for UX/connector node patterns. citeturn1search11turn1search3

## Synthesis strategy for the canonical model and capability matrix

The synthesis must not become “average of all upstream schemas”. The winning strategy is a three-layer model:

Layer one is the VAOP canonical object: minimal stable attributes + lifecycle status + references to external object IDs. For example, the existence of a “party/partner” model that unifies individuals/companies/contact addresses suggests your canonical Customer should almost certainly be a generic “Party” concept with role tags (customer, lead, vendor, employee-contact), rather than separate hard types that explode mapping complexity. citeturn3search0

Layer two is the Provider ACL normalisation: per provider you translate vendor-native fields into your canonical fields and place everything else into **explicit extension containers**. Helpdesk platforms that let admins add custom fields to tickets/users/organisations demonstrate how central “custom attributes” are in real adoption; your canonical model needs a strategy that doesn’t break when the tenant adds fields. citeturn2search2turn2search10

Layer three is a “raw object reference” (optional but often crucial): store raw provider payload snapshots as evidence artefacts (or as references to artefacts), rather than trying to losslessly encode every vendor field into your canonical DB. This keeps your canonical model small while preserving defensibility.

For the capability matrix, commit to an action-first view:

- Define actions per port (e.g., Accounting: `create_invoice_draft`, `post_invoice`, `record_payment`, `refund_payment`)
- Attach safety properties: requires approval tier, is idempotent via key, supports dry-run/diff, supports rollback/compensation, supports webhook confirmations
- Attach constraints: rate limits, maximum batch size, required OAuth scopes, sandbox presence

This mirrors the way connector protocols treat a “resource/stream” as schema plus metadata about interaction options, and why ecosystems require JSON Schema outputs and connector metadata files: automation is only governable when capabilities are machine-discoverable. citeturn11search1turn11search2turn11search9

Finally, connect evidence logging to durable execution. If your workflow engine tracks progress by appending events to a history (enabling recovery and replay), that provides the right conceptual model for the VAOP evidence log: append-only, ordered, queryable, and linkable to external objects. citeturn9search1turn9search21

## Failure modes and guardrails for the research programme

The core failure mode is canonical bloat: if you try to represent every vendor’s edge cases inside the canonical schema, you will (a) break tenants when providers evolve, and (b) lose the clarity needed for approvals and policy. Systems that emphasise rich custom fields on core objects are signalling the opposite: the stable core is small; variability belongs in extensions. citeturn2search2turn2search10

The second failure mode is a false sense of safety around retries and automation. Durable workflow engines explicitly recommend idempotent activities because retries/timeouts are fundamental, and event history exists to make recovery possible; if your adapters cannot offer idempotency keys and deterministic diffs, “Auto tier” becomes a liability trap. citeturn9search3turn9search0turn9search1

The third failure mode is licence contamination. Several of the best SoR exemplars for domain modelling are strong copyleft (GPL/AGPL) and must be treated as “SoR to integrate with + patterns to study”, not as components pulled into your permissively-licensed core. This is explicit in the licence texts for major exemplars (LGPL for Odoo; GPL for ERPNext and Mautic; AGPL for Zammad). citeturn15view0turn0search17turn14view0turn17view0

The fourth failure mode is quietly adopting a “source-available / fair-code” dependency as a foundational library. Some automation platforms present themselves as open source but publish a sustainable-use licence scope that is not equivalent to a permissive OSS dependency; even if you choose to study them, don’t let them drift into your critical path. citeturn1search11turn1search3

The fifth failure mode is “research output that cannot be re-run”. Avoid one-off manual notes. Prefer an extraction pipeline that produces: a neutral domain snapshot (CIF), explicit mappings into canonical objects, and executable contract tests, anchored to a specific upstream commit hash. Connector ecosystems demonstrate why: their protocols, schema requirements, and connector metadata conventions exist because ad-hoc integration knowledge doesn’t scale. citeturn11search1turn11search2turn11search9