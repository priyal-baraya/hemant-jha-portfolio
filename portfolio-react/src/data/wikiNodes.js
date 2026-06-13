export const wikiNodes = [
  {
    id: "kiss-philosophy",
    title: "KISS Philosophy",
    category: "Philosophy",
    summary: "The foundational principle of keeping systems and strategies simple, avoiding needless abstraction in favor of high execution speed.",
    content: "The **KISS Philosophy** (Keep It Simple, Stupid) is the bedrock of all systems engineering and leadership strategies. In software development and organizational design, complexity acts as a tax on velocity, readability, and maintenance.\n\nApplying this philosophy means resisting the urge to build early abstractions. Instead of designing for hypothetical future use cases, engineers and leaders should build for the concrete present. This mindset is deeply explored in [[essentialist-strategy|Essentialist Strategy]] and is the primary tool for [[noise-distillation|Noise Distillation]]. When scaling rapidly, maintaining this simplicity prevents cognitive overload, as detailed in [[cognitive-load-theory|Cognitive Load Theory]].",
    relatedNodes: ["essentialist-strategy", "noise-distillation", "cognitive-load-theory"],
    videoReferences: ["REEL_AI_002_GAMERS_SKILLS_en"],
    bookReferences: ["Synthesis Circle Volume I: Foundations of Simplicity"]
  },
  {
    id: "tactical-deceleration",
    title: "Tactical Deceleration",
    category: "Strategy",
    summary: "The deliberate choice to slow down scaling and feature development in order to resolve architectural debt and optimize for long-term velocity.",
    content: "In a corporate environment obsessed with hyper-velocity, **Tactical Deceleration** is the counter-intuitive practice of slowing down to speed up. When organizations scale too quickly without consolidating their core foundations, they accumulate technical and organizational debt that eventually halts progress.\n\nBy implementing a period of tactical deceleration, teams can perform a comprehensive analysis of their current systems. This practice is crucial for maintaining [[architectural-integrity|Architectural Integrity]] and directly decreases the mental strain covered under [[cognitive-load-theory|Cognitive Load Theory]]. It represents a key application of the [[kiss-philosophy|KISS Philosophy]], proving that restraint is often the highest form of tactical execution.",
    relatedNodes: ["architectural-integrity", "cognitive-load-theory", "kiss-philosophy"],
    videoReferences: ["REEL_CXO_004_TRAPPED_CONTEXT_en"],
    bookReferences: ["The Art of Strategic Restraint", "Synthesis Circle Volume I: Foundations of Simplicity"]
  },
  {
    id: "cognitive-load-theory",
    title: "Cognitive Load Theory",
    category: "Systems",
    summary: "Managing mental bandwidth for executive decision-making and developer efficiency by reducing unnecessary systemic noise.",
    content: "Originally a cognitive science concept, **Cognitive Load Theory** as applied to systems engineering concerns the mental effort required to understand, build, and maintain a system. When a software architecture or team structure is overly complex, developers suffer from cognitive fatigue, leading to bugs, delays, and burn-out.\n\nTo manage cognitive load, organization designs must align with cognitive limits. Decoupling systems and simplifying communication flows are effective strategies, as highlighted in [[distributed-teams-governance|Distributed Teams Governance]]. A healthy architecture allows builders to focus on the business domain rather than the plumbing, drawing directly from the principles of [[noise-distillation|Noise Distillation]] and the overarching [[kiss-philosophy|KISS Philosophy]].",
    relatedNodes: ["distributed-teams-governance", "noise-distillation", "kiss-philosophy", "tactical-deceleration"],
    videoReferences: ["REEL_CXO_004_TRAPPED_CONTEXT_en"],
    bookReferences: ["Cognitive Scaling: Systems for Humans", "Synthesis Circle Volume II: Cognitive Architectures"]
  },
  {
    id: "essentialist-strategy",
    title: "Essentialist Strategy",
    category: "Strategy",
    summary: "The methodology of identifying the 1% of inputs that dictate 99% of outcomes, allowing teams to filter out trivial noise and focus on critical goals.",
    content: "An **Essentialist Strategy** rejects the idea that all tasks, features, and metrics are of equal value. Instead, it asserts that only a tiny fraction (roughly 1%) of decisions truly determine the trajectory of a product or company.\n\nExecuting this strategy requires the mental discipline of [[noise-distillation|Noise Distillation]] to constantly audit projects and discard the non-essential. It provides the logical framework behind [[kiss-philosophy|KISS Philosophy]] and guides how we define [[architectural-integrity|Architectural Integrity]]. Without an essentialist mindset, leaders risk spreading resources too thin, resulting in mediocre outcomes across all fronts.",
    relatedNodes: ["noise-distillation", "kiss-philosophy", "architectural-integrity"],
    videoReferences: ["REEL_CXO_001_HIRING_TRAITS_en"],
    bookReferences: ["The Synthesis Manifesto", "The Art of Strategic Restraint"]
  },
  {
    id: "autonomous-systems-ethics",
    title: "Autonomous Systems Ethics",
    category: "Ethics",
    summary: "Navigating the ethical implications and governance frameworks of AI and automation without compromising human agency.",
    content: "As artificial intelligence and automation integrate into daily workflows, **Autonomous Systems Ethics** becomes a primary engineering constraint rather than an afterthought. Designing autonomous systems requires creating clear, deterministic boundary lines for AI agent actions to prevent misalignment.\n\nEthics in automation is not just about moral philosophy; it is an engineering discipline that dictates system design. Keeping AI systems simple and predictable matches the [[kiss-philosophy|KISS Philosophy]] and ensures their [[architectural-integrity|Architectural Integrity]] remains high. Proper implementation requires robust governance, heavily intersecting with [[distributed-teams-governance|Distributed Teams Governance]].",
    relatedNodes: ["kiss-philosophy", "architectural-integrity", "distributed-teams-governance"],
    videoReferences: ["REEL_AI_001_GAMERS_AI_ERA_en"],
    bookReferences: ["Synthesis Circle Volume III: Ethical Architectures", "Autonomous Logic"]
  },
  {
    id: "distributed-teams-governance",
    title: "Distributed Teams Governance",
    category: "Leadership",
    summary: "A framework for scaling engineering organizations by establishing strong cultural guardrails instead of restrictive micromanagement.",
    content: "Traditional top-down management fails in a remote or highly distributed environment. **Distributed Teams Governance** replaces granular oversight with cultural and technical guardrails. By providing alignment on goals and values, teams can execute autonomously.\n\nThis governance model reduces the coordination tax and helps manage cognitive limits, as explored in [[cognitive-load-theory|Cognitive Load Theory]]. It relies on high trust and clear interfaces between sub-teams, drawing inspiration from modular software architecture and [[autonomous-systems-ethics|Autonomous Systems Ethics]].",
    relatedNodes: ["cognitive-load-theory", "autonomous-systems-ethics"],
    videoReferences: ["REEL_CXO_001_HIRING_TRAITS_en"],
    bookReferences: ["Decoupled Leadership", "Synthesis Circle Volume II: Cognitive Architectures"]
  },
  {
    id: "architectural-integrity",
    title: "Architectural Integrity",
    category: "Systems",
    summary: "Ensuring structural coherence and modular design in both codebase systems and organizational structures to resist entropy.",
    content: "Whether dealing with a cloud-native codebase or an executive hierarchy, **Architectural Integrity** is the resistance of a system to entropy over time. A system possesses integrity when its components are modular, decoupled, and cleanly separated by interfaces.\n\nMaintaining integrity requires constant vigilance and occasionally a phase of [[tactical-deceleration|Tactical Deceleration]] to refactor bloated areas. In systems design, this means adhering to [[essentialist-strategy|Essentialist Strategy]] to avoid over-engineering, and applying the [[kiss-philosophy|KISS Philosophy]] to ensure the architecture remains understandable for generations of engineers to come.",
    relatedNodes: ["tactical-deceleration", "essentialist-strategy", "kiss-philosophy", "autonomous-systems-ethics"],
    videoReferences: ["REEL_AI_002_GAMERS_SKILLS_en"],
    bookReferences: ["Synthesis Circle Volume I: Foundations of Simplicity", "Modular Design Paradigms"]
  },
  {
    id: "noise-distillation",
    title: "Noise Distillation",
    category: "Philosophy",
    summary: "The processing discipline of converting raw, overwhelming data streams into clean, actionable, and vital signals.",
    content: "We live in an era of information hyper-inflation. **Noise Distillation** is the act of filtering raw information to identify the core truths. It is a philosophy of subtraction rather than addition.\n\nIn technology, distillation allows us to build clean dashboards, refine user telemetry, and create crisp AI prompts. In strategy, it allows for the formulation of [[essentialist-strategy|Essentialist Strategy]]. Distillation directly reduces cognitive overhead, linking it to [[cognitive-load-theory|Cognitive Load Theory]], and serves as the practical execution of the [[kiss-philosophy|KISS Philosophy]].",
    relatedNodes: ["essentialist-strategy", "cognitive-load-theory", "kiss-philosophy"],
    videoReferences: ["REEL_CXO_004_TRAPPED_CONTEXT_en"],
    bookReferences: ["The Art of Strategic Restraint", "The Synthesis Manifesto"]
  }
];
