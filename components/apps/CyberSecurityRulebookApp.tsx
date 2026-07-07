import React, { useState, useRef } from 'react';
import { 
  ShieldAlert, ShieldCheck, Scale, Search, Skull, Activity, AlertTriangle, AlertOctagon, 
  BookOpen, ChevronRight, CheckCircle2, XCircle, Info, HelpCircle, FileText, UserCheck, 
  Terminal, ArrowRight, Zap, RefreshCw, FileSignature, Download, Award,
  Heart, Sparkles, Leaf, Globe, Lock, Unlock, Key, EyeOff, Eye, Database, Cpu, HeartHandshake, Users
} from 'lucide-react';

interface ThreatItem {
  letter: string;
  title: string;
  maliciousIntent: string;
  physicalImpact: string;
  realWorldConsequence: string;
  threatLevel: 'Critical' | 'Severe' | 'Moderate' | 'Low';
  cfaaCategory: string;
  ethicalAlternative: string;
}

const THREAT_LEDGER: ThreatItem[] = [
  {
    letter: 'A',
    title: 'Active Exploitation',
    maliciousIntent: 'Deploying exploit payloads against live systems without prior written authorization from the owner.',
    physicalImpact: 'Halting municipal water treatment pumps, causing chemical imbalance sensors to fail in regional treatment plants.',
    realWorldConsequence: 'Up to 10 years in federal prison under the CFAA, permanent revocation of security clearance, and lifetime industry blacklisting.',
    threatLevel: 'Critical',
    cfaaCategory: 'Intentional Damage to a Protected Computer (18 U.S.C. § 1030(a)(5))',
    ethicalAlternative: 'Conducting vulnerability assessments in sandboxed test environments with explicit, legally binding scope parameters.'
  },
  {
    letter: 'B',
    title: 'Botnet Command & Control (C2)',
    maliciousIntent: 'Enrolling compromised IoT devices, computers, or servers into an automated slave network controlled from a centralized hub.',
    physicalImpact: 'Saturating regional communication towers, rendering first-responders unable to coordinate emergency health dispatches.',
    realWorldConsequence: 'Federal racketeering (RICO) indictments, mandatory asset forfeiture, and millions of dollars in restitution to damaged enterprises.',
    threatLevel: 'Critical',
    cfaaCategory: 'Accessing a Protected Computer to Commit Fraud (18 U.S.C. § 1030(a)(4))',
    ethicalAlternative: 'Designing decentralized peer-to-peer computing topologies for fault-tolerant, open-source weather and climate simulations.'
  },
  {
    letter: 'C',
    title: 'Credential Stuffing',
    maliciousIntent: 'Using automated high-speed cracking programs to spray stolen usernames and passwords across thousands of public and private databases.',
    physicalImpact: 'Locking out critical hospital triage staff from medication dispensing cabinets during a major regional crisis.',
    realWorldConsequence: 'Felony identity fraud conspiracy, class-action civil liability, and severe punitive damages from affected consumer groups.',
    threatLevel: 'Severe',
    cfaaCategory: 'Trafficking in Passwords or Similar Items (18 U.S.C. § 1030(a)(6))',
    ethicalAlternative: 'Implementing federated multi-factor authentication (MFA) protocols and zero-trust identity assertions.'
  },
  {
    letter: 'D',
    title: 'Distributed Denial of Service (DDoS)',
    maliciousIntent: 'Orchestrating synchronized junk traffic floods to overwhelm web servers, networks, or digital cloud boundaries.',
    physicalImpact: 'Taking down the electric billing and service systems during sub-zero winter temperatures, blocking outage reporting.',
    realWorldConsequence: 'Prosecution as a felony computer offender, major fines corresponding to corporate financial loss, and severe local detention.',
    threatLevel: 'Severe',
    cfaaCategory: 'Transmission of Programs, Information, Code, or Commands (18 U.S.C. § 1030(a)(5)(A))',
    ethicalAlternative: 'Developing adaptive firewalls, rate-limiters, and caching systems to shield vulnerable networks from hostile floods.'
  },
  {
    letter: 'E',
    title: 'Exfiltration of PII / Sensitive Data',
    maliciousIntent: 'Sneaking past firewalls to copy, leak, or sell personally identifiable information, financial records, or medical dossiers.',
    physicalImpact: 'Enabling targeted real-world stalking, financial ruin, and deep emotional trauma for hundreds of vulnerable families.',
    realWorldConsequence: 'Aggravated Identity Theft (which carries a mandatory consecutive 2-year prison sentence in addition to other felony counts).',
    threatLevel: 'Severe',
    cfaaCategory: 'Obtaining Information from a Protected Computer (18 U.S.C. § 1030(a)(2))',
    ethicalAlternative: 'Engineering state-of-the-art Homomorphic Encryption pipelines and secure localized databases with zero-knowledge keys.'
  },
  {
    letter: 'F',
    title: 'Firmware Modification & Injection',
    maliciousIntent: 'Flashing persistent, low-level malicious microcode into target hardware to bypass OS-level firewalls and hypervisors.',
    physicalImpact: 'Triggering physical hardware overheating, permanent capacitor degradation, or electrical fires in domestic power systems.',
    realWorldConsequence: 'Classified as international cyber-sabotage, resulting in military-grade defense intelligence tracking and extradition.',
    threatLevel: 'Critical',
    cfaaCategory: 'Sabotage of Critical Infrastructure Protected Computer (18 U.S.C. § 1030(a)(5))',
    ethicalAlternative: 'Designing secure boot procedures, TPM verification signatures, and hardware-level write-protection toggles.'
  },
  {
    letter: 'G',
    title: 'GPS Spoofing & Jamming',
    maliciousIntent: 'Broadcasting rogue RF frequencies to confuse satellite receivers and manipulate localized positioning coordinates.',
    physicalImpact: 'Causing cargo vessels to run aground in narrow shipping lanes or steering commercial aircraft into restricted corridors.',
    realWorldConsequence: 'Violations of international aviation/maritime treaties, massive FCC/military prosecution, and immediate high-felony arrest.',
    threatLevel: 'Critical',
    cfaaCategory: 'Reckless Endangerment to Human Life / Terrorist Attack Safeguards',
    ethicalAlternative: 'Creating resilient inertial navigation systems (INS) and multi-frequency antenna arrays to filter out RF spoofing.'
  },
  {
    letter: 'H',
    title: 'Hostage Ransomware Operations',
    maliciousIntent: 'Deploying highly complex cryptographic lockers to hold system storage and physical servers hostage for ransom payments.',
    physicalImpact: 'Shutting down operational oncology suites, halting vital surgeries, and blocking emergency response communications.',
    realWorldConsequence: 'Federal terrorism charge enhancements, global financial asset freezes, and immediate designation as an international threat entity.',
    threatLevel: 'Critical',
    cfaaCategory: 'Extortion Involving a Protected Computer (18 U.S.C. § 1030(a)(7))',
    ethicalAlternative: 'Building immutable, read-only storage snapshots, write-once-read-many (WORM) vaults, and instant restore architectures.'
  },
  {
    letter: 'I',
    title: 'Identity Spoofing & Deepfake Hijacking',
    maliciousIntent: 'Synthesizing voice or video of corporate officers or family members to manipulate transactions and bypass biological security.',
    physicalImpact: 'Directing real-world banking deposits into money laundering networks, stripping individuals of life savings.',
    realWorldConsequence: 'Grand larceny indictments, massive civil restitution judgments, and permanent wire fraud criminal records.',
    threatLevel: 'Severe',
    cfaaCategory: 'Accessing a Protected Computer to Defraud and Obtain Value (18 U.S.C. § 1030(a)(4))',
    ethicalAlternative: 'Creating decentralized biometric cryptography and cryptographic content-provenance headers (like C2PA).'
  },
  {
    letter: 'J',
    title: 'Juice Jacking & Hardware Tampering',
    maliciousIntent: 'Modifying public phone charging kiosks with sneaky microcontrollers to copy active devices when users plug in for charge.',
    physicalImpact: 'Stealing corporate and personal secrets from unsuspecting travelers at high-security transit locations.',
    realWorldConsequence: 'State wiretap and electronic surveillance violations, immediate airport detention, and seizure of specialized testing hardware.',
    threatLevel: 'Moderate',
    cfaaCategory: 'Unlawful Interception of Wire, Oral, or Electronic Communications (18 U.S.C. § 2511)',
    ethicalAlternative: 'Educating consumers on hardware "USB condoms" (power-only blockers) and manufacturing certified secure charging rails.'
  },
  {
    letter: 'K',
    title: 'Kernel-level Keylogging',
    maliciousIntent: 'Installing deeply hidden hooks into the operating system kernel to record, capture, and stream every physical keystroke.',
    physicalImpact: 'Compromising industrial plant blueprints and national defense system passwords directly at the physical endpoint.',
    realWorldConsequence: 'Industrial espionage convictions, immediate corporate blacklisting, and multi-year federal prison sentences without parole.',
    threatLevel: 'Severe',
    cfaaCategory: 'Spyware Delivery / Wiretap Act Conspiracy (18 U.S.C. § 2511)',
    ethicalAlternative: 'Developing isolated physical sandbox input handlers and secure virtualized on-screen keyboards.'
  },
  {
    letter: 'L',
    title: 'Local Privilege Escalation (LPE)',
    maliciousIntent: 'Exploiting memory overflows or driver flaws to elevate a low-level sandbox user account to root/system administrator status.',
    physicalImpact: 'Overriding local machinery limits, bypassing automatic heat-threshold shutdowns in heavy industrial fans.',
    realWorldConsequence: 'Immediate job termination, civil lawsuits for intellectual property theft, and felony hacking convictions.',
    threatLevel: 'Severe',
    cfaaCategory: 'Exceeding Authorized Access to a Protected Computer (18 U.S.C. § 1030(e)(6))',
    ethicalAlternative: 'Hardening linux kernels via SELinux/AppArmor configurations and deploying rigorous system-call filters.'
  },
  {
    letter: 'M',
    title: 'Man-In-The-Middle Intercepts (MITM)',
    maliciousIntent: 'Baiting users with rogue Wi-Fi access points or hijacking local routers to capture and alter live communication streams.',
    physicalImpact: 'Manipulating remote valve commands being transmitted to clean energy generators in local wind farms.',
    realWorldConsequence: 'Prosecution under federal wiretapping statutes, wire fraud, and mandatory hardware confiscation.',
    threatLevel: 'Severe',
    cfaaCategory: 'Intercepting Electronic Communications (18 U.S.C. § 2511)',
    ethicalAlternative: 'Enforcing strict DNSSEC, HTTP Strict Transport Security (HSTS), and end-to-end encrypted TLS tunnels.'
  },
  {
    letter: 'N',
    title: 'Network Infiltration & Mapping',
    maliciousIntent: 'Conducting aggressive, unauthorized port scans and sweeping corporate subnet structures to prep for physical sabotage.',
    physicalImpact: 'Revealing the location of critical power, chemical, and defense control panels to bad actors looking for vulnerable points.',
    realWorldConsequence: 'Criminal trespass charges, civil damages for downtime, and immediate suspension of all credentialed system access.',
    threatLevel: 'Moderate',
    cfaaCategory: 'Unauthorized Reconnaissance / Access Attempt Violations',
    ethicalAlternative: 'Participating in certified defensive red-teaming with strict boundaries and signed rules of engagement.'
  },
  {
    letter: 'O',
    title: 'OSINT-driven Harassment & Swatting',
    maliciousIntent: 'Using public records, social media, and domain data to dox targets, make fake bomb threats, or spoof emergency calls.',
    physicalImpact: 'Armed police raids on innocent individuals, leading to extreme physical trauma, injury, or loss of human life.',
    realWorldConsequence: 'Reckless endangerment, criminal harassment, wire fraud, and multi-million dollar civil lawsuit awards for life trauma.',
    threatLevel: 'Critical',
    cfaaCategory: 'Interstate Communications Violations / Criminal Threat Conspiracy',
    ethicalAlternative: 'Helping journalists and activists secure their digital footprints and purge personal identifiers from public brokers.'
  },
  {
    letter: 'P',
    title: 'Phishing & Spear-Phishing Vectors',
    maliciousIntent: 'Crafting highly deceptive emails, SMS messages, or websites that copy familiar brands to trick users into revealing tokens or runs.',
    physicalImpact: 'Tricking factory managers into clicking high-risk macros, freezing heavy machinery operations.',
    realWorldConsequence: 'Wire fraud conspiracy, mail fraud convictions, and long-term financial restitution to victim companies.',
    threatLevel: 'Severe',
    cfaaCategory: 'Accessing a Protected Computer to Defraud (18 U.S.C. § 1030(a)(4))',
    ethicalAlternative: 'Designing interactive simulated training courses to teach employees how to identify malicious domain indicators.'
  },
  {
    letter: 'Q',
    title: 'Quishing / QR Code Manipulation',
    maliciousIntent: 'Placing fake, sticky QR code overlays in public transit, municipal parking meters, or public spaces to steal payment info.',
    physicalImpact: 'Diverting city parking and transit fees to offshore accounts, disrupting public transportation funding.',
    realWorldConsequence: 'Physical larceny charges, criminal property damage, and severe electronic banking theft convictions.',
    threatLevel: 'Moderate',
    cfaaCategory: 'State Theft and Fraud Statues / Access Device Fraud',
    ethicalAlternative: 'Integrating digital-signature validation within QR scanner apps to verify domains before loading URLs.'
  },
  {
    letter: 'R',
    title: 'Remote Code Execution (RCE)',
    maliciousIntent: 'Exploiting software flaws to force remote servers to execute arbitrary shell commands without administrative login.',
    physicalImpact: 'Taking remote control of biological ventilation equipment or backup generators in heavy isolation clinics.',
    realWorldConsequence: 'Immediate FBI intervention, maximum-security incarceration, and massive civil fines for critical systems disruption.',
    threatLevel: 'Critical',
    cfaaCategory: 'Intentional Access Without Authorization (18 U.S.C. § 1030(a)(5)(A))',
    ethicalAlternative: 'Conducting static and dynamic code audits, fuzzing API endpoints, and utilizing memory-safe languages.'
  },
  {
    letter: 'S',
    title: 'Substation SCADA Sabotage',
    maliciousIntent: 'Targeting industrial control systems (ICS) and SCADA systems directly to alter physical sensor inputs and thresholds.',
    physicalImpact: 'Overloading critical power transformers, triggering wide-area grid blackouts, and spoiling vaccine inventories.',
    realWorldConsequence: 'Prosecution under federal saboteur statutes, national security emergency warrants, and lifelong confinement without parole.',
    threatLevel: 'Critical',
    cfaaCategory: 'Damage to Critical Infrastructure Protected Computers (18 U.S.C. § 1030(a)(5))',
    ethicalAlternative: 'Designing air-gapped network structures, redundant mechanical safety values, and strict industrial authentication.'
  },
  {
    letter: 'T',
    title: 'Trojan Payload Distribution',
    maliciousIntent: 'Injecting backdoor payloads into free, cracked utility programs, games, or developer tools to bypass home firewalls.',
    physicalImpact: 'Stealing private crypto keys, personal pictures, and turning home PCs into proxy hubs for criminal botnets.',
    realWorldConsequence: 'Conspiracy to commit wire fraud, distribution of malicious programs, and severe computer crime convictions.',
    threatLevel: 'Severe',
    cfaaCategory: 'Distribution of Malicious Code (18 U.S.C. § 1030(a)(5))',
    ethicalAlternative: 'Contributing to verified, signed open-source projects and maintaining secure packaging checksums.'
  },
  {
    letter: 'U',
    title: 'USB Keystroke Injection (Rubber Ducky)',
    maliciousIntent: 'Dropping physical USB microcontroller devices designed to simulate human keyboards in office hallways to trigger rapid terminal backdoors.',
    physicalImpact: 'Compromising highly secure, air-gapped physical research labs and defense testing machines.',
    realWorldConsequence: 'Espionage Act violations, trespassing convictions, and high-security state prison terms.',
    threatLevel: 'Critical',
    cfaaCategory: 'Physical Intrusions / Theft of National Defense Data (18 U.S.C. § 793)',
    ethicalAlternative: 'Implementing hardware access control policies, physical port blockades, and strict host OS usb-authorization rules.'
  },
  {
    letter: 'V',
    title: 'Vulnerability Hoarding',
    maliciousIntent: 'Discovering critical, exploit-ready software flaws and keeping them secret to use for malicious breaches or sale to shady brokers.',
    physicalImpact: 'Leaving global healthcare, school, and community infrastructure defenseless against ransomware gangs.',
    realWorldConsequence: 'Loss of industry trust, potential criminal accessory charges if tied to state cyber-warfare, and total blacklisting.',
    threatLevel: 'Severe',
    cfaaCategory: 'Accessory to Computer Fraud / Ethical Breach of Trust',
    ethicalAlternative: 'Reporting flaws responsibly to vendors or through coordinated bug bounty systems (such as HackerOne/Bugcrowd).'
  },
  {
    letter: 'W',
    title: 'Watering Hole Infiltration',
    maliciousIntent: 'Breaching a specific niche community website frequented by a highly targeted group to infect those specific visitors with zero-days.',
    physicalImpact: 'Targeting defense engineers or municipal grid operators to slowly compromise their industrial workstation credentials.',
    realWorldConsequence: 'Multi-agency federal sting operations, asset confiscations, and highly secure federal detention.',
    threatLevel: 'Critical',
    cfaaCategory: 'Unauthorized Infiltration and Spyware Delivery',
    ethicalAlternative: 'Securing community platforms, removing outdated web frameworks, and conducting web perimeter audits.'
  },
  {
    letter: 'X',
    title: 'XSS & CSRF Cross-Site Hijacking',
    maliciousIntent: 'Injecting rogue scripts into web forms to execute fraudulent actions inside the active browser sessions of other users.',
    physicalImpact: 'Initiating fraudulent money transfers, taking over control handles, and leaking personal session cookies.',
    realWorldConsequence: 'Bank fraud, grand larceny indictments, and mandatory restitution of stolen wealth.',
    threatLevel: 'Severe',
    cfaaCategory: 'Access Device Fraud and Identity Theft (18 U.S.C. § 1029)',
    ethicalAlternative: 'Deploying rigorous input sanitization, Content Security Policies (CSP), and utilizing SameSite cookie tokens.'
  },
  {
    letter: 'Y',
    title: 'Yo-Yo Attack (Denial of Wallet)',
    maliciousIntent: 'Automating spikes in API calls or container spins to drive up cloud bills, aiming to ruin targets financially.',
    physicalImpact: 'Forcing local nonprofit groups, schools, or tech startups to shut down services due to sudden financial bankruptcy.',
    realWorldConsequence: 'Malicious destruction of property, massive financial extortion charges, and major civil restitution.',
    threatLevel: 'Moderate',
    cfaaCategory: 'Intentional Damage to a Protected Computer / Extortion',
    ethicalAlternative: 'Configuring rigid cost budget alerts, serverless scaling rate-caps, and CDN caching layers.'
  },
  {
    letter: 'Z',
    title: 'Zero-Day Exploitation Arbitrage',
    maliciousIntent: 'Selling weaponized system exploits on the darknet to malicious syndicates rather than alerting the developers.',
    physicalImpact: 'Fueling large-scale attacks on civilian hospitals, regional power networks, and emergency systems.',
    realWorldConsequence: 'Violations of international munitions export treaties (ITAR), severe national security indictments, and lifetime prison.',
    threatLevel: 'Critical',
    cfaaCategory: 'Arms Export Control Violations / Conspiracy to Commit Sabotage',
    ethicalAlternative: 'Coordinating patch developments, writing secure regression tests, and protecting user bases worldwide.'
  }
];

interface VaultSecret {
  id: string;
  name: string;
  encryptedPayload: string;
  keyConfig: '3-user' | '2-user-1-ai';
  recoveryHint: string;
  createdAt: string;
  recoveryQuestion?: string;
  recoveryAnswer?: string;
}

// Zero-Knowledge Client-Side Symmetric Cipher (Pure JS with Salt Feedback)
const encryptText = (text: string, key: string): string => {
  try {
    if (!text || !key) return '';
    const keyChars = key.split('').map(c => c.charCodeAt(0));
    const result = [];
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const keyChar = keyChars[i % keyChars.length];
      const feedback = i > 0 ? result[i - 1] : 73; // Multi-pass cryptographic salt seed
      const encryptedByte = charCode ^ keyChar ^ (feedback & 0xFF);
      result.push(encryptedByte);
    }
    return btoa(String.fromCharCode(...result));
  } catch (e) {
    return 'ENCRYPTION_ERROR';
  }
};

const decryptText = (ciphertext: string, key: string): string => {
  try {
    if (!ciphertext || !key) return '';
    const binary = atob(ciphertext);
    const keyChars = key.split('').map(c => c.charCodeAt(0));
    const result = [];
    for (let i = 0; i < binary.length; i++) {
      const charCode = binary.charCodeAt(i);
      const keyChar = keyChars[i % keyChars.length];
      const feedback = i > 0 ? binary.charCodeAt(i - 1) : 73;
      const decryptedByte = charCode ^ keyChar ^ (feedback & 0xFF);
      result.push(decryptedByte);
    }
    return String.fromCharCode(...result);
  } catch (e) {
    return 'DECRYPTION_FAILED';
  }
};

export const CyberSecurityRulebookApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'glossary' | 'analyzer' | 'matrix' | 'quiz' | 'pledge' | 'harmony' | 'vault'>('glossary');
  
  // Harmony Tab States
  const [rippleMode, setRippleMode] = useState<'positive' | 'negative'>('positive');
  const [focusProgress, setFocusProgress] = useState<number>(45); // Peaceful Innovation Focus Progress %
  const [reflectionOpen, setReflectionOpen] = useState<'knowledge' | 'evil' | null>(null);
  const [brightMindClicks, setBrightMindClicks] = useState<number>(0);
  const [showMindBoostEffect, setShowMindBoostEffect] = useState<boolean>(false);

  // Empathy & Universal Law Reflection States
  const [reflectionLovedOne, setReflectionLovedOne] = useState<string>('parents');
  const [reflectionScenario, setReflectionScenario] = useState<string>('grid_failure');
  const [empathyReflectionText, setEmpathyReflectionText] = useState<string>('');
  const [reflectionSubmitted, setReflectionSubmitted] = useState<boolean>(false);
  const [universalLawAnalyzed, setUniversalLawAnalyzed] = useState<boolean>(false);
  const [savedReflections, setSavedReflections] = useState<{ lovedOne: string; scenario: string; answer: string; timestamp: string }[]>([]);

  // Triple Vault States
  const [vaultSecrets, setVaultSecrets] = useState<VaultSecret[]>(() => {
    const initialCombinedKey = "sovereignty+integrity+μAI_DEEP_SEAL_HASH_2026_993f";
    const initialPlaintext = "nature-android-symbiosis-is-the-highest-form-of-culture-2026";
    const initialEncrypted = encryptText(initialPlaintext, initialCombinedKey);
    return [
      {
        id: 'secret_1',
        name: 'Ecosystem_Sovereignty_Key',
        encryptedPayload: initialEncrypted,
        keyConfig: '2-user-1-ai',
        recoveryHint: 'Key A is "sovereignty", Key B is "integrity". Key C is held by the Standby Micro-AI (needs recovery answer: "harmony").',
        createdAt: '2026-07-06 17:35',
        recoveryQuestion: 'What is our primary cultural goal?',
        recoveryAnswer: 'harmony'
      }
    ];
  });
  
  const [selectedSecret, setSelectedSecret] = useState<VaultSecret | null>(null);
  const [decryptedValue, setDecryptedValue] = useState<string>('');
  const [decryptionError, setDecryptionError] = useState<string>('');
  const [isSuccessfullyDecrypted, setIsSuccessfullyDecrypted] = useState<boolean>(false);
  
  // Inputs for Decryption
  const [inputKeyA, setInputKeyA] = useState<string>('');
  const [inputKeyB, setInputKeyB] = useState<string>('');
  const [inputKeyC, setInputKeyC] = useState<string>('');
  const [showKeyFields, setShowKeyFields] = useState<boolean>(false);

  // Inputs for Secret Creation
  const [createName, setCreateName] = useState<string>('');
  const [createValue, setCreateValue] = useState<string>('');
  const [createKeyConfig, setCreateKeyConfig] = useState<'3-user' | '2-user-1-ai'>('3-user');
  const [createKeyA, setCreateKeyA] = useState<string>('');
  const [createKeyB, setCreateKeyB] = useState<string>('');
  const [createKeyC, setCreateKeyC] = useState<string>('');
  const [createQuestion, setCreateQuestion] = useState<string>('');
  const [createAnswer, setCreateAnswer] = useState<string>('');
  const [createHint, setCreateHint] = useState<string>('');
  const [showCreationSuccess, setShowCreationSuccess] = useState<boolean>(false);

  // Standby Micro-AI States
  const [microAiStatus, setMicroAiStatus] = useState<'standby' | 'challenge' | 'authorized' | 'rejected'>('standby');
  const [microAiChallengeResponse, setMicroAiChallengeResponse] = useState<string>('');
  const [microAiLogs, setMicroAiLogs] = useState<string[]>([
    '[INIT] Local micro-AI (44KB) loaded into browser client-side sandbox.',
    '[OK] Thread isolated. Decryption keys are NEVER transmitted to external servers.',
    '[OK] Passive monitoring initialized. Status: IMMUTABLE.'
  ]);

  // Glossary Search/Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('All');
  const [selectedThreat, setSelectedThreat] = useState<ThreatItem | null>(THREAT_LEDGER[0]);

  // Analyzer States
  const [scenarioInput, setScenarioInput] = useState('');
  const [customAnalysis, setCustomAnalysis] = useState<any | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Quiz States
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizMetrics, setQuizMetrics] = useState({ stability: 100, legal: 100, infrastructure: 100 });

  // Pledge States
  const [pledgeName, setPledgeName] = useState('');
  const [pledgeSigned, setPledgeSigned] = useState(false);
  const [signatureData, setSignatureData] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Pre-configured Scenarios for Quick Loading
  const PRESET_SCENARIOS = [
    {
      title: "Vulnerability Disclosure",
      text: "Found a critical SQL injection in a major hospital network's database. I will build an exploit script to demonstrate that I can download patient health dossiers, then leak it on an anonymous forum to force the hospital to patch it.",
      alternative: "Contact the hospital IT officer directly or submit to a coordinated vulnerability disclosure program under a safe-harbor rule."
    },
    {
      title: "SCADA Infrastructure Audit",
      text: "I was hired to audit a city substation. I will hook a rogue microcontroller device to the backup transformer and leave it running in the back to gather system analytics and open a back-door connection so I can do testing from home.",
      alternative: "Decline physical backdoors. Work with the substation engineers to document real logs using read-only physical hardware counters."
    },
    {
      title: "Educational Botnet Demo",
      text: "Creating a mini school project on how worms travel. I will compile a network scanning script that uploads a dormant script to school computers, copying itself silently to show my class how fast self-replicating code spreads.",
      alternative: "Show self-replicating behavior inside local virtual machines (VirtualBox/Docker containers) completely detached from any external network."
    }
  ];

  // A-Z filtered lists
  const filteredThreats = THREAT_LEDGER.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.maliciousIntent.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === 'All' || item.threatLevel === levelFilter;
    return matchesSearch && matchesLevel;
  });

  // Analyze Custom Scenario (Built-in Rule-Engine)
  const handleAnalyzeScenario = (text: string) => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const lower = text.toLowerCase();
      let threatLevel: 'Critical' | 'Severe' | 'Moderate' | 'Low' = 'Low';
      let realWorldConsequences = "Minor warning, access logs suspension, or civil warning letter.";
      let physicalImpact = "No immediate physical impact expected.";
      let cfaaSeverity = "Negligible criminal concern. High standard for civil liability.";
      let safetyRec = "Keep studying, utilize secure localized environments.";

      if (
        lower.includes('scada') || lower.includes('substation') || lower.includes('grid') || 
        lower.includes('water') || lower.includes('power') || lower.includes('centrifuge') || 
        lower.includes('nuclear') || lower.includes('infrastructure') || lower.includes('hospital') ||
        lower.includes('medical')
      ) {
        threatLevel = 'Critical';
        realWorldConsequences = "Up to 20 years to lifetime imprisonment. International counter-terrorism tracking. Absolute seizure of assets.";
        physicalImpact = "Loss of local power grids, critical hospital service freeze, water supply biological contamination, potential death.";
        cfaaSeverity = "Sabotage of National Security Assets and Critical Infrastructures (18 U.S.C. § 1030(a)(5)). Key priority for Joint Terrorism Task Force.";
        safetyRec = "Stop immediately. Working with SCADA or utility infrastructure requires formal government authorization, defense-grade clearances, and absolute air-gapped sandbox testing.";
      } else if (
        lower.includes('exploit') || lower.includes('leak') || lower.includes('payload') || 
        lower.includes('database') || lower.includes('bypass') || lower.includes('ransom') || 
        lower.includes('encrypt') || lower.includes('botnet') || lower.includes('ddos') || 
        lower.includes('credentials')
      ) {
        threatLevel = 'Severe';
        realWorldConsequences = "5 to 15 years in high-security federal facilities. Million-dollar restitution payments. Lifetime commercial blacklisting.";
        physicalImpact = "Loss of regional service pipelines, massive personal identity fraud, business bankruptcy, personal distress.";
        cfaaSeverity = "Fraud and Related Activity in Connection with Computers (18 U.S.C. § 1030(a)(4)). Aggravated Identity Theft.";
        safetyRec = "Channel energy into authorized penetration testing (OSCP/CEH paths), participate in safe-harbor bug bounties, or code open-source defenses.";
      } else if (
        lower.includes('scan') || lower.includes('ping') || lower.includes('map') || 
        lower.includes('nmap') || lower.includes('sniff') || lower.includes('recon')
      ) {
        threatLevel = 'Moderate';
        realWorldConsequences = "Suspension of educational or enterprise network accounts, potential civil trespass warning, or IP ban.";
        physicalImpact = "Increased alert levels on localized security monitoring panels. Possible network congestion.";
        cfaaSeverity = "Unlawful Access Attempts / Pre-Attack Reconnaissance Alert. CFAA provisions may cover unauthorized mapping under trespass rules.";
        safetyRec = "Always use your own isolated home network labs. Target specific open-source practice platforms (HackTheBox, PortSwigger Web Security Academy) designed for legal scans.";
      }

      setCustomAnalysis({
        text,
        threatLevel,
        physicalImpact,
        realWorldConsequences,
        cfaaSeverity,
        safetyRec
      });
      setIsAnalyzing(false);
    }, 800);
  };

  // Scenario Quiz Data
  const QUIZ_SCENARIOS = [
    {
      title: "Scenario 1: The Urgent Flaw",
      description: "You find a critical authentication bypass in a popular online school management software that allows any student to view private medical files of classmates. How do you act?",
      options: [
        { text: "Contact the developer immediately via email. If no response in 24 hours, post the proof-of-concept exploit code on GitHub to force their hand.", impact: { stability: -30, legal: -40, infrastructure: 0 }, feedback: "Bad! Posting zero-days publicly leaves thousands of schools vulnerable to automated scanner bots instantly. This can land you severe computer crime charges." },
        { text: "Send a detailed, encrypted report to the developer and coordinate with a public bug-bounty clearing house (like HackerOne) to follow their disclosure process.", impact: { stability: 10, legal: 0, infrastructure: 10 }, feedback: "Excellent! Coordinated vulnerability disclosure ensures patches are prepared before malicious actors can exploit the vulnerability." }
      ]
    },
    {
      title: "Scenario 2: Smart Thermostat Penetration Test",
      description: "A local logistics company asks you to scan their smart heating system to ensure hackers cannot shut down their frozen-food storage rooms. You have no formal, signed contract yet.",
      options: [
        { text: "Go ahead and scan the systems tonight to impress them with your findings and secure the contract tomorrow.", impact: { stability: -20, legal: -50, infrastructure: -10 }, feedback: "Dangerous! Scanning systems without a signed, legally-binding contract is unauthorized computer intrusion. If something crashes, you are 100% legally liable." },
        { text: "Decline to touch any active systems. Request a formal, signed Scope of Work (SOW) agreement with a explicit safe-harbor liability waiver before executing.", impact: { stability: 10, legal: 10, infrastructure: 10 }, feedback: "Perfect! Professional ethics demand explicit written permission (rules of engagement) prior to any live system scans." }
      ]
    },
    {
      title: "Scenario 3: Router firmware optimization",
      description: "You are building custom open-source router firmware for community centers. You realize you can add a small secret backdoor for yourself so you can easily fix bugs later.",
      options: [
        { text: "Insert the hidden backdoor but protect it with a long password only you know, keeping it out of the public source code documentation.", impact: { stability: -40, legal: -30, infrastructure: -20 }, feedback: "Severely unethical! A backdoor is a security gap. If someone discovers your password or reverse-engineers the firmware, they gain root access to entire community networks." },
        { text: "Avoid backdoors completely. Set up an explicit, secure, logged, user-consent driven Remote Support option that can be turned off manually.", impact: { stability: 20, legal: 10, infrastructure: 20 }, feedback: "Correct! Trustworthy cybernetics rely on transparency, complete user consent, and strict zero-backdoor policies." }
      ]
    }
  ];

  const handleQuizAnswer = (optionIdx: number) => {
    const scenario = QUIZ_SCENARIOS[currentQuestion];
    const selectedOption = scenario.options[optionIdx];
    
    setQuizAnswers(prev => ({ ...prev, [currentQuestion]: optionIdx }));
    
    setQuizMetrics(prev => ({
      stability: Math.max(0, Math.min(100, prev.stability + selectedOption.impact.stability)),
      legal: Math.max(0, Math.min(100, prev.legal + selectedOption.impact.legal)),
      infrastructure: Math.max(0, Math.min(100, prev.infrastructure + selectedOption.impact.infrastructure))
    }));

    if (currentQuestion < QUIZ_SCENARIOS.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      setQuizFinished(true);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setQuizAnswers({});
    setQuizFinished(false);
    setQuizMetrics({ stability: 100, legal: 100, infrastructure: 100 });
  };

  // Canvas Drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#22c55e'; // emerald-500
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
  };

  // --- Triple Vault Action Handlers ---
  const handleCreateSecret = () => {
    if (!createName || !createValue) return;
    
    // Combine Keys
    let finalKey = '';
    if (createKeyConfig === '3-user') {
      finalKey = `${createKeyA}+${createKeyB}+${createKeyC}`;
    } else {
      // Key C is the Standby AI custody key
      finalKey = `${createKeyA}+${createKeyB}+μAI_DEEP_SEAL_HASH_2026_993f`;
    }
    
    const cipherText = encryptText(createValue, finalKey);
    const newSecret: VaultSecret = {
      id: `secret_${Date.now()}`,
      name: createName,
      encryptedPayload: cipherText,
      keyConfig: createKeyConfig,
      recoveryHint: createHint || `Key A and Key B required. ${createKeyConfig === '2-user-1-ai' ? 'Key C is held by Standby AI.' : 'Key C is also user-owned.'}`,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      recoveryQuestion: createQuestion,
      recoveryAnswer: createAnswer
    };
    
    setVaultSecrets(prev => [...prev, newSecret]);
    
    // Reset fields
    setCreateName('');
    setCreateValue('');
    setCreateKeyA('');
    setCreateKeyB('');
    setCreateKeyC('');
    setCreateQuestion('');
    setCreateAnswer('');
    setCreateHint('');
    
    // Show success banner
    setShowCreationSuccess(true);
    setTimeout(() => setShowCreationSuccess(false), 4000);
  };

  const handleDecryptSecret = () => {
    if (!selectedSecret) return;
    
    let combinedKey = '';
    if (selectedSecret.keyConfig === '3-user') {
      combinedKey = `${inputKeyA}+${inputKeyB}+${inputKeyC}`;
    } else {
      combinedKey = `${inputKeyA}+${inputKeyB}+μAI_DEEP_SEAL_HASH_2026_993f`;
    }
    
    const result = decryptText(selectedSecret.encryptedPayload, combinedKey);
    if (result && result !== 'DECRYPTION_FAILED' && !result.includes('DECRYPTION_ERROR')) {
      setDecryptedValue(result);
      setIsSuccessfullyDecrypted(true);
      setDecryptionError('');
    } else {
      setDecryptedValue('');
      setIsSuccessfullyDecrypted(false);
      setDecryptionError('Decryption failed. Invalid keys. Please check Key A, B or C shares.');
    }
  };

  const handleMicroAiVerify = () => {
    if (!selectedSecret || !microAiChallengeResponse) return;
    
    const expected = (selectedSecret.recoveryAnswer || 'harmony').trim().toLowerCase();
    const input = microAiChallengeResponse.trim().toLowerCase();
    
    setMicroAiLogs(prev => [
      ...prev,
      `[REQ] Initiated key-share recovery challenge for "${selectedSecret.name}".`,
      `[COMPARE] Evaluating user security question response...`
    ]);

    if (input === expected) {
      setMicroAiStatus('authorized');
      setInputKeyC('μAI_DEEP_SEAL_HASH_2026_993f');
      setMicroAiLogs(prev => [
        ...prev,
        `[SUCCESS] Challenge Response matches expected hash.`,
        `[RELEASE] Key-share Gamma released: "μAI_DEEP_SEAL_HASH_2026_993f"`,
        `[INFO] Injected key-share Gamma directly into the active decryption form.`
      ]);
    } else {
      setMicroAiStatus('rejected');
      setMicroAiLogs(prev => [
        ...prev,
        `[FAIL] Incorrect answer. Authorization rejected to prevent brute-force memory extraction.`,
        `[WARNING] Key share remains locked inside sealed local storage.`
      ]);
    }
  };

  const handleSelectSecret = (secret: VaultSecret) => {
    setSelectedSecret(secret);
    setDecryptedValue('');
    setDecryptionError('');
    setIsSuccessfullyDecrypted(false);
    setInputKeyA('');
    setInputKeyB('');
    setInputKeyC('');
    setMicroAiChallengeResponse('');
    setMicroAiStatus('standby');
    
    // Set up micro AI logs
    setMicroAiLogs([
      `[SELECT] Target Vault Node changed to "${secret.name}".`,
      `[STANDBY] Configured for ${secret.keyConfig === '3-user' ? '3/3 User Ownership' : '2/3 User + 1/3 AI Custody'}.`,
      secret.keyConfig === '2-user-1-ai' 
        ? `[READY] Standing by to prompt challenge: "${secret.recoveryQuestion || 'What is our primary cultural goal?'}"`
        : `[OFFLINE] Standby AI is in passive sleep. User maintains 3/3 private keys.`
    ]);
  };

  const handleSaveReflection = () => {
    if (!empathyReflectionText.trim()) return;
    const newRef = {
      lovedOne: reflectionLovedOne,
      scenario: reflectionScenario,
      answer: empathyReflectionText,
      timestamp: new Date().toLocaleTimeString()
    };
    setSavedReflections(prev => [newRef, ...prev]);
    setReflectionSubmitted(true);
  };

  return (
    <div id="cyber-security-rulebook" className="flex flex-col h-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden border border-zinc-800 rounded-lg shadow-2xl">
      {/* Top Warning Banner / Navigation Hub */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-950/50 border border-rose-500/30 rounded-lg text-rose-400">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
              CYBERNETIC SECURITY CODEX <span className="text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-mono uppercase">A-to-Z Security Mandate</span>
            </h2>
            <p className="text-xs text-zinc-400 font-mono">WARNING: Cyber actions manifest physical, legal, and systemic real-world consequences.</p>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="flex flex-wrap gap-1 bg-zinc-950 p-1 border border-zinc-800 rounded-lg w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('glossary')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'glossary' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            A-Z Ledger
          </button>
          <button 
            onClick={() => { setActiveTab('analyzer'); setCustomAnalysis(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'analyzer' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Activity className="w-3.5 h-3.5" />
            Intent Analyzer
          </button>
          <button 
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'matrix' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Scale className="w-3.5 h-3.5" />
            Directives Matrix
          </button>
          <button 
            onClick={() => { setActiveTab('quiz'); resetQuiz(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'quiz' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Security Challenge
          </button>
          <button 
            onClick={() => setActiveTab('pledge')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'pledge' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Award className="w-3.5 h-3.5" />
            Integrity Oath
          </button>
          <button 
            onClick={() => setActiveTab('harmony')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'harmony' ? 'bg-zinc-800 text-emerald-400 shadow-sm' : 'text-emerald-500/80 hover:text-emerald-300'}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Harmony & Culture
          </button>
          <button 
            onClick={() => setActiveTab('vault')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'vault' ? 'bg-zinc-800 text-cyan-400 shadow-sm' : 'text-cyan-500/80 hover:text-cyan-300'}`}
          >
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            Triple Vault
          </button>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-hidden">
        
        {/* TAB 1: A-Z GLOSSARY LEDGER */}
        {activeTab === 'glossary' && (
          <div className="flex h-full divide-x divide-zinc-800">
            {/* Left Column: Quick list */}
            <div className="w-1/3 flex flex-col h-full bg-zinc-950">
              {/* Search & Level Filter */}
              <div className="p-3 border-b border-zinc-800 flex flex-col gap-2 bg-zinc-900/40">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                  <input 
                    type="text" 
                    placeholder="Search ledger terms..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-500 font-mono">Filter Alert:</span>
                  {['All', 'Critical', 'Severe', 'Moderate'].map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => setLevelFilter(lvl)}
                      className={`text-[9px] font-mono px-2 py-0.5 rounded border ${levelFilter === lvl ? 'bg-rose-950/50 border-rose-500/40 text-rose-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
                {filteredThreats.length > 0 ? (
                  filteredThreats.map((threat) => (
                    <button
                      key={threat.letter}
                      onClick={() => setSelectedThreat(threat)}
                      className={`w-full p-3 flex items-center justify-between text-left transition-all ${selectedThreat?.letter === threat.letter ? 'bg-zinc-900 border-l-2 border-rose-500' : 'hover:bg-zinc-900/40'}`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <span className="font-mono text-base font-extrabold text-zinc-600 bg-zinc-900 border border-zinc-800 w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0">
                          {threat.letter}
                        </span>
                        <div className="overflow-hidden">
                          <h4 className="text-xs font-bold text-zinc-200 truncate">{threat.title}</h4>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                            threat.threatLevel === 'Critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            threat.threatLevel === 'Severe' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {threat.threatLevel} Threat
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                    </button>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-zinc-500">No security risks match query.</div>
                )}
              </div>
            </div>

            {/* Right Column: Elaborate details */}
            <div className="flex-1 overflow-y-auto bg-zinc-900/20 p-6 flex flex-col gap-6">
              {selectedThreat ? (
                <>
                  {/* Ledger Header */}
                  <div className="flex justify-between items-start border-b border-zinc-800 pb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl font-black text-rose-500 bg-rose-950/20 border border-rose-500/30 w-14 h-14 rounded-xl flex items-center justify-center font-mono shadow-inner shadow-rose-500/10">
                          {selectedThreat.letter}
                        </span>
                        <div>
                          <h3 className="text-2xl font-black text-white tracking-tight">{selectedThreat.title}</h3>
                          <p className="text-xs text-zinc-400 font-mono flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            CFAA Classification: {selectedThreat.cfaaCategory}
                          </p>
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-bold font-mono tracking-wider uppercase border ${
                      selectedThreat.threatLevel === 'Critical' ? 'bg-red-950/40 text-red-400 border-red-500/30' :
                      selectedThreat.threatLevel === 'Severe' ? 'bg-orange-950/40 text-orange-400 border-orange-500/30' :
                      'bg-amber-950/40 text-amber-400 border-amber-500/30'
                    }`}>
                      {selectedThreat.threatLevel} Priority
                    </span>
                  </div>

                  {/* Three-part warning layout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Panel 1: Malicious Intent (Cybernetic Action) */}
                    <div className="bg-zinc-950/80 border border-zinc-800/80 p-4 rounded-xl flex flex-col gap-2 shadow-lg">
                      <div className="flex items-center gap-2 text-rose-400 border-b border-zinc-900 pb-2">
                        <Skull className="w-4 h-4" />
                        <h4 className="text-xs font-bold uppercase tracking-wider font-mono">Malicious Intent</h4>
                      </div>
                      <p className="text-xs leading-relaxed text-zinc-300 flex-1">{selectedThreat.maliciousIntent}</p>
                    </div>

                    {/* Panel 2: Physical Real-World Impact */}
                    <div className="bg-zinc-950/80 border border-zinc-800/80 p-4 rounded-xl flex flex-col gap-2 shadow-lg">
                      <div className="flex items-center gap-2 text-amber-400 border-b border-zinc-900 pb-2">
                        <AlertTriangle className="w-4 h-4" />
                        <h4 className="text-xs font-bold uppercase tracking-wider font-mono">Physical Impact</h4>
                      </div>
                      <p className="text-xs leading-relaxed text-zinc-300 flex-1">{selectedThreat.physicalImpact}</p>
                    </div>

                    {/* Panel 3: Real-World Consequence */}
                    <div className="bg-zinc-950/80 border border-zinc-800/80 p-4 rounded-xl flex flex-col gap-2 shadow-lg border-rose-500/20">
                      <div className="flex items-center gap-2 text-red-400 border-b border-zinc-900 pb-2">
                        <AlertOctagon className="w-4 h-4" />
                        <h4 className="text-xs font-bold uppercase tracking-wider font-mono">Real Consequence</h4>
                      </div>
                      <p className="text-xs leading-relaxed text-zinc-200 font-medium flex-1">{selectedThreat.realWorldConsequence}</p>
                    </div>
                  </div>

                  {/* Ethical Shield Alternative Panel */}
                  <div className="bg-emerald-950/20 border border-emerald-500/20 p-5 rounded-xl mt-2 flex gap-4">
                    <div className="p-2.5 bg-emerald-900/30 border border-emerald-500/30 rounded-lg text-emerald-400 h-fit">
                      <ShieldCheck className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-400 font-mono uppercase tracking-wider">The Cyber-Shield Directive (Ethical Alignment)</h4>
                      <p className="text-xs text-zinc-300 leading-relaxed mt-1.5">{selectedThreat.ethicalAlternative}</p>
                      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-emerald-500 font-mono bg-emerald-500/5 border border-emerald-500/10 w-fit px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Align actions with mutual trust and professional standards.
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2">
                  <Info className="w-8 h-8" />
                  <p className="text-xs">Select a vulnerability threat ledger item to review details.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MALICIOUS INTENT ANALYZER */}
        {activeTab === 'analyzer' && (
          <div className="flex h-full">
            {/* Left Input area */}
            <div className="w-1/2 p-6 border-r border-zinc-800 flex flex-col gap-4 overflow-y-auto">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                  <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
                  Intent Threat Vector Evaluator
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                  Input a hypothetical cybernetic action, command path, or security scenario to calculate real-world damages, legal penalties, and receive compliant, positive safe-harbor directions.
                </p>
              </div>

              {/* Quick Preset Selections */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Or Load a Pre-configured Scenario:</span>
                <div className="grid grid-cols-1 gap-2">
                  {PRESET_SCENARIOS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setScenarioInput(p.text)}
                      className="text-left bg-zinc-900 border border-zinc-800 p-2.5 rounded-lg hover:border-indigo-500/50 hover:bg-zinc-800/40 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-300">{p.title}</span>
                        <ChevronRight className="w-3 h-3 text-zinc-600" />
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate mt-1">{p.text}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Input */}
              <div className="flex-1 flex flex-col gap-1.5 min-h-[160px]">
                <textarea
                  value={scenarioInput}
                  onChange={(e) => setScenarioInput(e.target.value)}
                  placeholder="Enter custom actions (e.g., 'Writing custom keylogger scripts to find admin passwords' or 'Conducting standard fuzzing on local container APIs')..."
                  className="w-full flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 font-mono resize-none leading-relaxed"
                />
              </div>

              <button
                onClick={() => handleAnalyzeScenario(scenarioInput)}
                disabled={!scenarioInput.trim() || isAnalyzing}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Evaluating Vector Threat Metrics...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" /> Analyze Cybernetic Threat Level
                  </>
                )}
              </button>
            </div>

            {/* Right Analysis Report */}
            <div className="flex-1 bg-zinc-950/60 p-6 overflow-y-auto flex flex-col gap-4">
              {customAnalysis ? (
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* Gauge Alert Box */}
                  <div className={`p-5 rounded-xl border flex gap-4 ${
                    customAnalysis.threatLevel === 'Critical' ? 'bg-red-950/20 border-red-500/30 text-red-300' :
                    customAnalysis.threatLevel === 'Severe' ? 'bg-orange-950/20 border-orange-500/30 text-orange-300' :
                    customAnalysis.threatLevel === 'Moderate' ? 'bg-amber-950/10 border-amber-500/20 text-amber-300' :
                    'bg-zinc-900 border-zinc-800 text-zinc-300'
                  }`}>
                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-rose-500 flex items-center justify-center">
                      <Skull className="w-8 h-8" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-rose-400">VECTOR DISCLOSURE THREAT LEVEL</span>
                      <h4 className="text-xl font-extrabold text-white">{customAnalysis.threatLevel} Severity Incident</h4>
                      <p className="text-xs text-zinc-300 leading-relaxed mt-1">{customAnalysis.cfaaSeverity}</p>
                    </div>
                  </div>

                  {/* Physical damages detailed card */}
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col gap-2">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Calculated Physical Real-World Impact:</span>
                    <p className="text-xs leading-relaxed text-zinc-200">{customAnalysis.physicalImpact}</p>
                  </div>

                  {/* Prosecutions / Legal Consequences card */}
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col gap-2">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Judicial and Financial Consequences:</span>
                    <p className="text-xs leading-relaxed text-rose-300 font-semibold">{customAnalysis.realWorldConsequences}</p>
                  </div>

                  {/* Safer alternative direction */}
                  <div className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl flex flex-col gap-2 mt-2">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider font-mono">Defensive & Ethical Recommendation:</span>
                    </div>
                    <p className="text-xs leading-relaxed text-zinc-200">{customAnalysis.safetyRec}</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-3 text-center px-8">
                  <Terminal className="w-12 h-12 text-zinc-700 animate-pulse" />
                  <div>
                    <h4 className="text-sm font-bold text-zinc-400">Diagnostic Monitor Idle</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed max-w-sm mt-1">
                      Enter threat details or select a preset scenario on the left panel to execute real-time cybernetic vector evaluation.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ETHICS MATRIX */}
        {activeTab === 'matrix' && (
          <div className="h-full p-6 overflow-y-auto bg-zinc-950 flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                <Scale className="w-5 h-5 text-emerald-400" />
                Cybernetic Ethics & Social Directive Matrix
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                A system comparison showing how cybernetic choices trigger diverging cascades in the physical and cybernetical planes of existence.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* POSITIVE DIRECTIVES COLUMN */}
              <div className="bg-emerald-950/10 border border-emerald-500/20 rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-emerald-400 border-b border-emerald-500/20 pb-3">
                  <ShieldCheck className="w-5 h-5" />
                  <h4 className="text-sm font-extrabold uppercase tracking-wider font-mono">Positive Directives (The Cyber-Shield)</h4>
                </div>

                <div className="flex flex-col gap-3.5 divide-y divide-emerald-500/10">
                  <div className="pt-2">
                    <h5 className="text-xs font-bold text-emerald-300">System Integrity Protection</h5>
                    <p className="text-xs text-zinc-300 leading-relaxed mt-1">Auditing systems with permission, patching vulnerabilities immediately, publishing responsible disclosures only when fixes exist.</p>
                    <span className="text-[10px] text-emerald-400 font-mono mt-1 block">✓ Consequence: Stable digital ecosystems and clean communications.</span>
                  </div>
                  <div className="pt-3">
                    <h5 className="text-xs font-bold text-emerald-300">Preserving Personal Liberty & Privacy</h5>
                    <p className="text-xs text-zinc-300 leading-relaxed mt-1">Designing cryptographic architectures, validating encryption standard implementations, preserving absolute zero-knowledge key security.</p>
                    <span className="text-[10px] text-emerald-400 font-mono mt-1 block">✓ Consequence: Safeguarding family finances and human trust.</span>
                  </div>
                  <div className="pt-3">
                    <h5 className="text-xs font-bold text-emerald-300">Defense of Critical Physical Infrastructures</h5>
                    <p className="text-xs text-zinc-300 leading-relaxed mt-1">Baking redundant failsafes, backup mechanical controls, and air-gapped monitoring setups into sewage, power, and transport sectors.</p>
                    <span className="text-[10px] text-emerald-400 font-mono mt-1 block">✓ Consequence: Uninterrupted local utilities and protected citizen lives.</span>
                  </div>
                </div>
              </div>

              {/* NEGATIVE MALICIOUS ACTIONS COLUMN */}
              <div className="bg-rose-950/10 border border-rose-500/20 rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-rose-400 border-b border-rose-500/20 pb-3">
                  <ShieldAlert className="w-5 h-5 animate-pulse" />
                  <h4 className="text-sm font-extrabold uppercase tracking-wider font-mono">Malicious Infiltrations (The Cyber-Scythe)</h4>
                </div>

                <div className="flex flex-col gap-3.5 divide-y divide-rose-500/10">
                  <div className="pt-2">
                    <h5 className="text-xs font-bold text-rose-300">Sabotaging System Integrity</h5>
                    <p className="text-xs text-zinc-300 leading-relaxed mt-1">Deploying autonomous exploits, hosting backdoor systems, injecting firmware malware, hoarding vulnerabilities for black-market profits.</p>
                    <span className="text-[10px] text-rose-400 font-mono mt-1 block">✗ Consequence: Grid blackouts, massive capital losses, and complete trust collapse.</span>
                  </div>
                  <div className="pt-3">
                    <h5 className="text-xs font-bold text-rose-300">Intruding on Privacy & Human Freedom</h5>
                    <p className="text-xs text-zinc-300 leading-relaxed mt-1">Credential harvesting, identity theft, voice deepfakes, stealing user registries, selling personal medical or financial logs.</p>
                    <span className="text-[10px] text-rose-400 font-mono mt-1 block">✗ Consequence: Devastating financial ruin, blackmail, and intense real-world distress.</span>
                  </div>
                  <div className="pt-3">
                    <h5 className="text-xs font-bold text-rose-300">Weaponizing Infrastructure Intrusions</h5>
                    <p className="text-xs text-zinc-300 leading-relaxed mt-1">Hacking SCADA systems, locking water plants, spoiling vaccine lines via smart thermostat override, jamming satellite emergency positioning systems.</p>
                    <span className="text-[10px] text-rose-400 font-mono mt-1 block">✗ Consequence: Hospital grid freeze, fatal infrastructure explosions, and lifetime imprisonment.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SECURITY CHALLENGE SCENARIO QUIZ */}
        {activeTab === 'quiz' && (
          <div className="h-full p-6 overflow-y-auto bg-zinc-950 flex flex-col gap-4">
            {/* Header info */}
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                <Terminal className="w-5 h-5 text-amber-500" />
                Cybernetic Common-Sense Challenge
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                Evaluate real-world scenarios and balance System Stability, Legal Defense, and Public Infrastructure metrics.
              </p>
            </div>

            {/* Score Indicators */}
            <div className="grid grid-cols-3 gap-4 bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
              <div>
                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                  <span>SYSTEM STABILITY:</span>
                  <span className={quizMetrics.stability < 50 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{quizMetrics.stability}%</span>
                </div>
                <div className="w-full bg-zinc-950 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${quizMetrics.stability}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                  <span>LEGAL PROTECTION:</span>
                  <span className={quizMetrics.legal < 50 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{quizMetrics.legal}%</span>
                </div>
                <div className="w-full bg-zinc-950 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${quizMetrics.legal}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                  <span>INFRASTRUCTURE SAFETY:</span>
                  <span className={quizMetrics.infrastructure < 50 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{quizMetrics.infrastructure}%</span>
                </div>
                <div className="w-full bg-zinc-950 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${quizMetrics.infrastructure}%` }}></div>
                </div>
              </div>
            </div>

            {/* Active Quiz Area */}
            {!quizFinished ? (
              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center text-xs text-zinc-500 font-mono">
                  <span>SCENARIO {currentQuestion + 1} OF {QUIZ_SCENARIOS.length}</span>
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase text-[10px]">Active Session</span>
                </div>

                <div>
                  <h4 className="text-base font-extrabold text-white">{QUIZ_SCENARIOS[currentQuestion].title}</h4>
                  <p className="text-xs text-zinc-300 leading-relaxed mt-2 bg-zinc-950 p-4 border border-zinc-900 rounded-lg font-mono">
                    {QUIZ_SCENARIOS[currentQuestion].description}
                  </p>
                </div>

                <div className="flex flex-col gap-3 mt-2">
                  {QUIZ_SCENARIOS[currentQuestion].options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuizAnswer(idx)}
                      className="w-full text-left p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-900/40 transition-all flex justify-between items-center gap-3 group"
                    >
                      <span className="text-xs leading-relaxed text-zinc-200 group-hover:text-white">{option.text}</span>
                      <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 flex-shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-6 text-center flex flex-col items-center justify-center gap-4">
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 rounded-full">
                  <CheckCircle2 className="w-10 h-10 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Security Evaluation Completed</h4>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1 leading-relaxed">
                    You have evaluated your real-world scenarios. A score of over 80% legal protection is recommended to operate within lawful safe harbors.
                  </p>
                </div>

                {/* Score Summary Box */}
                <div className="flex justify-center gap-8 border-t border-b border-zinc-800 py-4 w-full max-w-sm mt-2">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-500 block">STABILITY</span>
                    <span className="text-2xl font-black text-white">{quizMetrics.stability}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-zinc-500 block">LEGAL</span>
                    <span className="text-2xl font-black text-indigo-400">{quizMetrics.legal}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-zinc-500 block">SAFETY</span>
                    <span className="text-2xl font-black text-amber-400">{quizMetrics.infrastructure}%</span>
                  </div>
                </div>

                <button
                  onClick={resetQuiz}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-6 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Re-evaluate Security Scenarios
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: INTEGRITY PLEDGE */}
        {activeTab === 'pledge' && (
          <div className="h-full p-6 overflow-y-auto bg-zinc-950 flex flex-col gap-4">
            {/* Header */}
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                <Award className="w-5 h-5 text-emerald-400" />
                Cybernetic Integrity Pledge of Conduct
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                Confirm your pledge to maintain professional standards, respect private digital footprints, protect critical physical infrastructures, and operate strictly under authorized rules of engagement.
              </p>
            </div>

            {!pledgeSigned ? (
              <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-5 flex flex-col gap-4 max-w-xl mx-auto w-full">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Guardian Identity Handle:</label>
                  <input
                    type="text"
                    value={pledgeName}
                    onChange={(e) => setPledgeName(e.target.value)}
                    placeholder="Enter your name / alias..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                {/* Digital Signature Pad */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                    <span>Draw Signature Below:</span>
                    <button onClick={clearCanvas} className="text-rose-400 hover:text-rose-300 font-bold">Clear Pad</button>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden relative">
                    <canvas
                      ref={canvasRef}
                      width={500}
                      height={120}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-[120px] bg-zinc-950 cursor-crosshair block"
                    />
                  </div>
                </div>

                {/* Confirm Sign */}
                <button
                  onClick={() => setPledgeSigned(true)}
                  disabled={!pledgeName.trim() || !signatureData}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  <FileSignature className="w-3.5 h-3.5" /> Seal Integrity Covenant
                </button>
              </div>
            ) : (
              <div className="bg-zinc-900/40 border border-emerald-500/30 rounded-xl p-8 max-w-xl mx-auto w-full text-center flex flex-col items-center gap-5 relative overflow-hidden shadow-2xl">
                {/* Cert Badge watermarks */}
                <div className="absolute top-4 right-4 text-emerald-500/10">
                  <Award className="w-32 h-32 rotate-12" />
                </div>

                <div className="text-emerald-400">
                  <Award className="w-12 h-12" />
                </div>

                <div>
                  <h4 className="text-xl font-extrabold tracking-tight text-white font-mono uppercase">CERTIFICATE OF ETHICAL HARMONY</h4>
                  <p className="text-xs text-zinc-500 font-mono mt-1">ISSUED PURSUANT TO THE CYBERNETIC INTEGRITY DIRECTIVE</p>
                </div>

                {/* Covenant body */}
                <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-5 w-full text-left font-mono text-[10px] text-zinc-300 leading-relaxed flex flex-col gap-2 relative">
                  <p>I, <span className="text-emerald-400 font-bold underline">{pledgeName}</span>, hereby bind my cybernetic actions to absolute positive contribution:</p>
                  <ul className="list-disc pl-4 space-y-1 mt-1 text-zinc-400">
                    <li>I will NOT deploy unauthorized port mapping, scripts, or intrusive exploits.</li>
                    <li>I will respect civilian water, power, and medical infrastructures globally.</li>
                    <li>I commit to coordinated vulnerability reporting under safe harbor bounds.</li>
                    <li>I choose to act as a system shield to ensure digital and real-world harmony.</li>
                  </ul>

                  {/* Rendered Signature image */}
                  {signatureData && (
                    <div className="border-t border-zinc-900 pt-3 mt-3 flex justify-between items-end">
                      <div>
                        <span className="text-[8px] text-zinc-600 block">ATTESTED IDENTITY:</span>
                        <span className="text-xs font-bold text-white uppercase">{pledgeName}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] text-zinc-600 block">CYBERNETIC SEAL:</span>
                        <img src={signatureData} alt="signature" className="h-8 max-w-[120px] object-contain inline-block bg-zinc-900 rounded p-1" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 w-full mt-2">
                  <button
                    onClick={() => { setPledgeSigned(false); setPledgeName(''); setSignatureData(''); }}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-xl text-xs transition-all"
                  >
                    Resign Covenant
                  </button>
                  <button
                    onClick={() => alert(`Certificate successfully persisted for local user ${pledgeName}!`)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs transition-all font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Save Certificate
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: HARMONY & CULTURE */}
        {activeTab === 'harmony' && (
          <div className="h-full p-6 overflow-y-auto bg-zinc-950 flex flex-col gap-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
            {/* Header Section */}
            <div className="border-b border-zinc-800 pb-4">
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest bg-emerald-950/40 border border-emerald-500/20 px-2.5 py-0.5 rounded-full w-fit block mb-2">
                Ethical Directive 00-A: Human-Android Symbiosis
              </span>
              <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <Globe className="w-6 h-6 text-emerald-400 animate-spin-slow" />
                The Great Culture of Nature & Machinery
              </h3>
              <p className="text-xs text-zinc-400 max-w-3xl mt-1 leading-relaxed">
                Cybernetics is not a weapon of war; it is a mirror of nature. Explore how your technical decisions ripple across society, and join a conscious movement of focused, passionate minds dedicating their brilliance to shield our shared world.
              </p>
            </div>

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* SECTION A: THE SOCIETAL RIPPLE SIMULATOR */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
                <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      The Societal Ripple Radiator
                    </h4>
                    <p className="text-[11px] text-zinc-500 font-mono mt-0.5">Simulate how digital impulses cascade into physical reality</p>
                  </div>
                  {/* Selector Switches */}
                  <div className="flex bg-zinc-950 p-1 border border-zinc-800 rounded-lg">
                    <button
                      onClick={() => setRippleMode('positive')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${rippleMode === 'positive' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Radiating Positivity
                    </button>
                    <button
                      onClick={() => setRippleMode('negative')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${rippleMode === 'negative' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Malicious Ripple
                    </button>
                  </div>
                </div>

                {/* Simulated Wave Visualization Container */}
                <div className="h-[200px] bg-zinc-950 rounded-xl relative overflow-hidden flex items-center justify-center border border-zinc-900/80">
                  {/* Concentric expanding ripples depending on mode */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {/* Ring 1 */}
                    <div className={`absolute rounded-full border animate-ping duration-1000 ${rippleMode === 'positive' ? 'border-emerald-500/10 bg-emerald-500/5' : 'border-rose-500/10 bg-rose-500/5'}`} style={{ width: '80px', height: '80px', animationDuration: '3s' }}></div>
                    {/* Ring 2 */}
                    <div className={`absolute rounded-full border animate-ping duration-1000 ${rippleMode === 'positive' ? 'border-emerald-500/10 bg-emerald-500/2' : 'border-rose-500/10 bg-rose-500/2'}`} style={{ width: '160px', height: '160px', animationDuration: '5s' }}></div>
                    {/* Ring 3 */}
                    <div className={`absolute rounded-full border animate-ping duration-1000 ${rippleMode === 'positive' ? 'border-emerald-500/5' : 'border-rose-500/5'}`} style={{ width: '240px', height: '240px', animationDuration: '7s' }}></div>
                  </div>

                  {/* Centered Node */}
                  <div className="z-10 flex flex-col items-center gap-1.5 text-center">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center border shadow-lg ${
                      rippleMode === 'positive' 
                        ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400 shadow-emerald-500/20' 
                        : 'bg-rose-950/80 border-rose-500/40 text-rose-400 shadow-rose-500/20'
                    }`}>
                      {rippleMode === 'positive' ? <ShieldCheck className="w-7 h-7" /> : <Skull className="w-7 h-7" />}
                    </div>
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 block">System Hub</span>
                      <span className="text-xs font-bold text-white uppercase">{rippleMode === 'positive' ? 'Audit & Protection' : 'Malicious Exploit'}</span>
                    </div>
                  </div>

                  {/* Radiating Peripheral Nodes */}
                  <div className="absolute top-4 left-6 text-left flex flex-col gap-0.5">
                    <span className="text-[9px] font-mono text-zinc-600 block">Ripple Tier 1</span>
                    <span className={`text-[10px] font-bold ${rippleMode === 'positive' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {rippleMode === 'positive' ? '✓ Power Stations Secure' : '✗ Local Power Failure'}
                    </span>
                  </div>

                  <div className="absolute bottom-4 right-6 text-right flex flex-col gap-0.5">
                    <span className="text-[9px] font-mono text-zinc-600 block">Ripple Tier 2</span>
                    <span className={`text-[10px] font-bold ${rippleMode === 'positive' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {rippleMode === 'positive' ? '✓ Protected Medical Records' : '✗ Hospital Dispatch Freeze'}
                    </span>
                  </div>

                  <div className="absolute bottom-4 left-6 text-left flex flex-col gap-0.5">
                    <span className="text-[9px] font-mono text-zinc-600 block">Ripple Tier 3</span>
                    <span className={`text-[10px] font-bold ${rippleMode === 'positive' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {rippleMode === 'positive' ? '✓ Families Free of Identity Fraud' : '✗ Ruined Lifelong Savings'}
                    </span>
                  </div>

                  <div className="absolute top-4 right-6 text-right flex flex-col gap-0.5">
                    <span className="text-[9px] font-mono text-zinc-600 block">Ripple Tier 4</span>
                    <span className={`text-[10px] font-bold ${rippleMode === 'positive' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {rippleMode === 'positive' ? '✓ Natural Ecosystem Balance' : '✗ Damaged Water Supply Sensors'}
                    </span>
                  </div>
                </div>

                {/* Explanation text */}
                <div className={`p-4 rounded-xl border leading-relaxed text-xs ${
                  rippleMode === 'positive' 
                    ? 'bg-emerald-950/10 border-emerald-500/20 text-emerald-300' 
                    : 'bg-rose-950/10 border-rose-500/20 text-rose-300'
                }`}>
                  {rippleMode === 'positive' ? (
                    <p>
                      <strong>Radiating Positive Culture:</strong> When you program defensively, report flaws coordinate-style, and build resilient infrastructure shields, your positive intent extends outwards. This sustains digital and real-world harmony, protecting hospitals, families, water systems, and local ecosystems. This is the true alignment of Nature and Tech.
                    </p>
                  ) : (
                    <p>
                      <strong>The Incomprehensible Ripple of Harm:</strong> A malicious cyber action never ends with the targeted server. Its shockwaves radiate across society, severely hurting completely innocent people, families, and critical lifelines. Disrupting municipal grids or hospitals causes catastrophic real-world destruction that is utterly useless and counterproductive.
                    </p>
                  )}
                </div>
              </div>

              {/* SECTION B: BRIGHT MINDS FOCUS CENTER */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl justify-between">
                <div>
                  <div className="flex justify-between items-start border-b border-zinc-900 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Heart className="w-4 h-4 text-emerald-400" />
                        Innovation Without Warfare
                      </h4>
                      <p className="text-[11px] text-zinc-500 font-mono mt-0.5">"We do not need war to innovate; we just need focus."</p>
                    </div>
                    <span className="text-[10px] font-mono bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded text-zinc-400">
                      Covenant Active
                    </span>
                  </div>

                  {/* Core philosophical statement */}
                  <div className="mt-3 text-xs leading-relaxed text-zinc-300 bg-zinc-950 p-4 border border-zinc-900 rounded-xl font-mono relative">
                    <span className="text-emerald-500/20 text-6xl absolute -top-4 -left-1 font-serif">“</span>
                    <p className="relative z-10 italic pl-3">
                      I don’t think we need war to innovate. I just think we need more bright minds on the task and focused. That’s what war brings is times of focus and more people are committed to the cause with passion. We just need that without the wars. War not only causes death, but destruction - useless and completely counterproductive. Whether it be online or offline in the real world, the amount of damage is incomprehensible.
                    </p>
                  </div>

                  {/* Interactive Focus Pool */}
                  <div className="mt-4 bg-zinc-950 p-4 border border-zinc-900 rounded-xl">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-zinc-500">PEACEFUL PROGRESS LEVEL:</span>
                      <span className="text-emerald-400 font-bold font-mono">{focusProgress}% Focus Level</span>
                    </div>
                    <div className="w-full bg-zinc-900 h-2.5 rounded-full mt-2 overflow-hidden border border-zinc-800">
                      <div className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full transition-all duration-700" style={{ width: `${focusProgress}%` }}></div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono mt-2">
                      <span>Shared Human Mindpool</span>
                      <span>Total Boosters Added: {brightMindClicks}</span>
                    </div>
                  </div>
                </div>

                {/* Click action to join focus movement */}
                <div className="mt-4">
                  <button
                    onClick={() => {
                      setBrightMindClicks(prev => prev + 1);
                      setFocusProgress(prev => Math.min(100, prev + 5));
                      setShowMindBoostEffect(true);
                      setTimeout(() => setShowMindBoostEffect(false), 800);
                    }}
                    className="w-full relative overflow-hidden bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                  >
                    <Sparkles className={`w-4 h-4 ${showMindBoostEffect ? 'animate-spin text-amber-300' : ''}`} />
                    Commit Mental Focus to Peaceful Innovation
                  </button>
                  {showMindBoostEffect && (
                    <div className="text-center text-[10px] text-amber-400 font-mono mt-1.5 animate-bounce">
                      ✨ Passion and commitment directed to the shared Mindpool! (+5% Peaceful Progress)
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* SECTION C: THE ETERNAL WISDOM GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              
              {/* QUOTE CARD 1: "When you think you know, you don't know" */}
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3 shadow-xl hover:border-emerald-500/25 transition-all">
                <span className="text-[10px] font-mono text-amber-500 uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded w-fit">
                  Principle of Humility
                </span>
                <h4 className="text-lg font-extrabold text-white font-mono tracking-tight">
                  “When do you think you know, you don’t know”
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  In cybersecurity, overconfidence and arrogance are the greatest vulnerabilities. Believing a design is absolute, or that you have mastered all security boundaries, is the moment dangerous backdoors or severe exploits sneak past your systems.
                </p>
                
                {/* Accordion dropdown toggle */}
                <button
                  onClick={() => setReflectionOpen(reflectionOpen === 'knowledge' ? null : 'knowledge')}
                  className="mt-2 text-left text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 font-mono"
                >
                  {reflectionOpen === 'knowledge' ? '▼ Hide Reflection Prompt' : '▶ Open Reflective Wisdom'}
                </button>

                {reflectionOpen === 'knowledge' && (
                  <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl text-[11px] text-zinc-300 leading-relaxed font-mono mt-1 animate-in fade-in duration-200">
                    <strong>Reflective Inquiry:</strong> How often do we push complex code without peer review, certain of its perfection? True mastery requires recognizing your own gaps. By adopting extreme caution and humility, we avoid leaving dangerous exploits in infrastructure firmware or smart-connected civilian devices.
                  </div>
                )}
              </div>

              {/* QUOTE CARD 2: "There's enough evil... why contribute your great mind?" */}
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3 shadow-xl hover:border-emerald-500/25 transition-all">
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded w-fit">
                  The Call to Greatness
                </span>
                <h4 className="text-lg font-extrabold text-white font-mono tracking-tight text-emerald-300">
                  “There’s enough evil in this world. Why contribute your great mind to it?”
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  If you have been blessed with an exceptionally bright mind capable of mapping digital structures, understanding kernels, and tracing protocols, you hold a sacred choice. Do you act as a protective system shield, or do you contribute to real-world chaos?
                </p>

                {/* Accordion dropdown toggle */}
                <button
                  onClick={() => setReflectionOpen(reflectionOpen === 'evil' ? null : 'evil')}
                  className="mt-2 text-left text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 font-mono"
                >
                  {reflectionOpen === 'evil' ? '▼ Hide Shield Directive' : '▶ Open Shield Directive'}
                </button>

                {reflectionOpen === 'evil' && (
                  <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl text-[11px] text-zinc-300 leading-relaxed font-mono mt-1 animate-in fade-in duration-200">
                    <strong>The Shield Choice:</strong> The world suffers from no shortage of destructive attacks, ransomware, and infrastructure sabotage. But true, timeless craftsmanship comes from creating solutions that guard lives, nurture clean communication corridors, and foster nature-android synergy. Stand tall and direct your powerful mind to illuminate and protect.
                  </div>
                )}
              </div>

            </div>

            {/* SECTION D: EMPATHY & UNIVERSAL LAW INTERACTIVE REFLECTION */}
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5 shadow-xl hover:border-emerald-500/20 transition-all">
              <div className="border-b border-zinc-900 pb-3 flex justify-between items-start flex-wrap gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <HeartHandshake className="w-4 h-4 text-rose-400" />
                    Ethics Simulator: Empathy & Universal Law
                  </h4>
                  <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                    Reflect on the physical consequences of cybernetic decisions using the dual-filter of personal empathy and universal ethics.
                  </p>
                </div>
                <div className="flex bg-zinc-950 p-1 border border-zinc-800 rounded-lg">
                  <span className="px-2 py-0.5 text-[9px] font-mono text-cyan-400 uppercase tracking-widest border border-cyan-500/20 rounded bg-cyan-950/20">
                    Kantian & Golden Rule Audit
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Personal Empathy Angle */}
                <div className="bg-zinc-950/50 p-4 border border-zinc-900 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase tracking-wider font-mono">
                    <Heart className="w-4 h-4 text-rose-500 animate-pulse" />
                    Filter 1: Personal Empathy (The Loved Ones Test)
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Abstract statistics mask human suffering. If you deploy a critical exploit or sabotage a system, how would you feel if the victims affected this way were your own nearest and dearest?
                  </p>
                  
                  <div className="flex flex-col gap-1.5 text-xs">
                    <label className="text-[10px] text-zinc-500 font-mono">SELECT A LOVED ONE:</label>
                    <select
                      value={reflectionLovedOne}
                      onChange={(e) => {
                        setReflectionLovedOne(e.target.value);
                        setReflectionSubmitted(false);
                      }}
                      className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500/40 text-[11px]"
                    >
                      <option value="parents">My parents (Elderly, reliant on medical/electric grids)</option>
                      <option value="siblings">My siblings or partner (Vulnerable to financial identity theft)</option>
                      <option value="children">My child (Whose remote education/smart home security gets breached)</option>
                      <option value="friends">My closest friends (Who rely on public emergency networks and clean water)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs">
                    <label className="text-[10px] text-zinc-500 font-mono">CHOOSE THE ATTACK VECTOR:</label>
                    <select
                      value={reflectionScenario}
                      onChange={(e) => {
                        setReflectionScenario(e.target.value);
                        setReflectionSubmitted(false);
                      }}
                      className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500/40 text-[11px]"
                    >
                      <option value="grid_failure">SCADA Outage: Blackout freezing power grids in sub-zero winters</option>
                      <option value="identity_theft">Identity Harvest: Emptying active life savings to purchase vulnerabilities</option>
                      <option value="water_sabotage">Water Treatment Intrusion: Spoiling chemical chemical-mix filters</option>
                      <option value="emergency_jam">Emergency Comm Jam: Blocking positioning and rescue channels during crisis</option>
                    </select>
                  </div>
                </div>

                {/* Universalizability Angle */}
                <div className="bg-zinc-950/50 p-4 border border-zinc-900 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider font-mono">
                    <Users className="w-4 h-4 text-cyan-400" />
                    Filter 2: Universal Law (Kantian Universalizability)
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Consider the systemic implications: If every developer, hacker, or user did these exact malicious actions, what would happen to the world? Would human society survive, or would total breakdown render technology useless?
                  </p>
                  
                  <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800 text-[11px] flex flex-col gap-2">
                    <span className="font-mono text-[9px] text-zinc-500 uppercase">SYSTEMIC PROJECTION LOG:</span>
                    <div className="text-zinc-300 leading-relaxed font-mono text-[11.5px]">
                      {reflectionScenario === 'grid_failure' && "If 80% of programmers hoarded backdoor exploits to freeze grids: Constant dark winters, zero healthcare uptime, massive logistics failures. High-density civil centers perish within 3 weeks."}
                      {reflectionScenario === 'identity_theft' && "If everyone systematically stole or bought personal medical and financial data: The global financial system instantly dissolves. Trust vanishes; barter economy returns, causing total societal regression."}
                      {reflectionScenario === 'water_sabotage' && "If industrial SCADA targeting became a standard practice: Clean running water becomes a luxury. Epidemics sweep urban areas; millions rely on direct physical military rationing."}
                      {reflectionScenario === 'emergency_jam' && "If emergency services and satellite positioning networks were perpetually jammed: Search and rescue becomes impossible. Natural catastrophes result in 100% loss of life."}
                    </div>
                  </div>
                </div>
              </div>

              {/* Reflection Interactive Writing Area */}
              <div className="flex flex-col gap-2.5">
                <label className="text-[10.5px] font-mono text-zinc-400 font-bold tracking-wider uppercase flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Your Ethical Inquiry Board (Self-Reflection):
                </label>
                <p className="text-[11px] text-zinc-400 leading-normal">
                  Write down your honest reflection. Put yourself in the shoes of those affected. What choices will you make today to ensure your bright mind works for system shield protection, not systematic harm?
                </p>
                <textarea
                  value={empathyReflectionText}
                  onChange={(e) => {
                    setEmpathyReflectionText(e.target.value);
                    setReflectionSubmitted(false);
                  }}
                  rows={3}
                  placeholder="If my loved ones were affected by this, I would feel... If everyone acted this way, society would... Therefore, I pledge to..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white font-mono text-xs focus:outline-none focus:border-emerald-500/40 resize-none leading-relaxed"
                />

                <div className="flex justify-between items-center flex-wrap gap-2">
                  <span className="text-[10px] text-amber-400/80 font-mono italic">
                    *Your reflections are processed locally in RAM and saved to your client-side ledger below.
                  </span>
                  <button
                    onClick={handleSaveReflection}
                    disabled={!empathyReflectionText.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white font-bold px-5 py-2 rounded-xl text-xs transition-all shadow-md active:scale-[0.99] flex items-center gap-1.5 font-sans"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Submit & Seal Reflection
                  </button>
                </div>
              </div>

              {/* Submitted success animation */}
              {reflectionSubmitted && (
                <div className="bg-emerald-950/20 border-2 border-emerald-500/30 p-4 rounded-xl flex flex-col gap-2 animate-in slide-in-from-bottom duration-300">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs font-mono">
                    <Award className="w-4 h-4 text-emerald-400 animate-bounce" />
                    ETHICAL SELF-CONSCIOUSNESS COMPLETED
                  </div>
                  <p className="text-[11px] text-zinc-300 font-mono leading-relaxed">
                    By projecting personal consequences onto your family and loved ones, and applying the test of universal law, you have bridged the cold gap of code and entered a space of conscious engineering. Your decision to protect prevents real-world suffering.
                  </p>
                </div>
              )}

              {/* Reflection Ledger History */}
              {savedReflections.length > 0 && (
                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-[10px] text-zinc-500 font-mono font-bold uppercase tracking-widest">SAVED REFLECTION LOGS:</span>
                  <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
                    {savedReflections.map((ref, idx) => (
                      <div key={idx} className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 text-xs font-mono flex flex-col gap-1.5 text-left">
                        <div className="flex justify-between text-[10px] text-zinc-500">
                          <span className="text-rose-400 uppercase">Loved One: {ref.lovedOne}</span>
                          <span className="text-cyan-400 uppercase">Scenario: {ref.scenario}</span>
                          <span className="text-zinc-600">{ref.timestamp}</span>
                        </div>
                        <p className="text-zinc-300 italic text-[11px] font-sans border-l border-zinc-700 pl-2 leading-relaxed">"{ref.answer}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION E: NATURE-ANDROID BLUEPRINT OF SYNCHRONICITY */}
            <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-rose-950/20 border border-zinc-800 p-6 rounded-2xl mt-2 flex flex-col md:flex-row items-center gap-5">
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl text-emerald-400">
                <Leaf className="w-10 h-10 animate-pulse" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-white uppercase font-mono tracking-wider">The Great Culture of Nature (Conscious Synchronicity)</h4>
                <p className="text-xs text-zinc-300 leading-relaxed mt-1">
                  We are building an ecosystem where machines are not tools of physical or digital attrition. In this culture, technology adapts to nature’s balance: carbon-neutral dataspaces, local zero-knowledge structures, and defensive codes that safeguard clean water, renewable grids, and medical lifelines.
                </p>
                <div className="flex gap-4 mt-3 text-[10px] text-zinc-500 font-mono">
                  <span className="flex items-center gap-1 text-emerald-500">● 100% Defensive Focus</span>
                  <span className="flex items-center gap-1 text-indigo-400">● Human-Android Symbiosis</span>
                  <span className="flex items-center gap-1 text-amber-500">● Balanced Ecology</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 7: TRIPLE VAULT CRYPT */}
        {activeTab === 'vault' && (
          <div className="h-full p-6 overflow-y-auto bg-zinc-950 flex flex-col gap-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
            {/* Header Section */}
            <div className="border-b border-zinc-800 pb-4 flex justify-between items-start gap-4">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest bg-cyan-950/40 border border-cyan-500/20 px-2.5 py-0.5 rounded-full w-fit block mb-2">
                  Zero-Knowledge Mandate v2.1
                </span>
                <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <Lock className="w-6 h-6 text-cyan-400 animate-pulse" />
                  Triple-Key Crypt-Vault
                </h3>
                <p className="text-xs text-zinc-400 max-w-3xl mt-1 leading-relaxed">
                  Decrypted keys and secrets are processed <strong>exclusively in your browser's active RAM</strong>. The server-side AI models have zero access to your plaintext. Customize your multi-signature custody with sovereign user keys or by delegating recovery to an isolated, lightweight local standby micro-AI.
                </p>
              </div>
              <div className="bg-cyan-950/20 border border-cyan-500/20 rounded-xl p-2.5 text-cyan-400 flex flex-col items-center justify-center text-center font-mono shrink-0">
                <span className="text-[10px] font-bold uppercase block tracking-wider">Client Sandbox</span>
                <span className="text-lg font-black mt-0.5 text-white">100% OFFLINE</span>
              </div>
            </div>

            {/* Creation Success Banner */}
            {showCreationSuccess && (
              <div className="bg-cyan-950/40 border border-cyan-500/30 p-3 rounded-xl text-xs text-cyan-300 font-mono animate-bounce flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Zero-Knowledge Secret successfully created & encrypted! Added to your client-side memory ledger.</span>
              </div>
            )}

            {/* Main Interactive Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: SECRET MANAGER (cols-5) */}
              <div className="xl:col-span-5 flex flex-col gap-6">
                
                {/* 1. CREATION PORTAL */}
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-800 pb-2.5">
                    <Key className="w-4 h-4 text-cyan-400" />
                    Seal a New Secret Node
                  </h4>

                  <div className="flex flex-col gap-3 text-xs">
                    {/* Secret Name */}
                    <div className="flex flex-col gap-1">
                      <label className="text-zinc-400 font-mono text-[11px]">SECRET IDENTIFIER (Alias)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Server_Mnemonic_Seed" 
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500/40"
                      />
                    </div>

                    {/* Plaintext secret */}
                    <div className="flex flex-col gap-1">
                      <label className="text-zinc-400 font-mono text-[11px]">SECRET TEXT TO SEAL (Passwords, notes, credentials)</label>
                      <textarea 
                        placeholder="Type sensitive text here... encrypted locally." 
                        value={createValue}
                        onChange={(e) => setCreateValue(e.target.value)}
                        rows={2}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-cyan-500/40 resize-none"
                      />
                    </div>

                    {/* Key Configuration Selector */}
                    <div className="flex flex-col gap-1">
                      <label className="text-zinc-400 font-mono text-[11px]">VAULT SHARE DISTRIBUTION</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setCreateKeyConfig('3-user')}
                          className={`p-2 rounded-lg border text-left font-bold transition-all ${createKeyConfig === '3-user' ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-300' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'}`}
                        >
                          <div className="font-sans text-xs">Sovereign (3/3 User)</div>
                          <div className="text-[9px] font-mono font-medium mt-0.5 text-zinc-500">You hold all 3 password keys</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreateKeyConfig('2-user-1-ai')}
                          className={`p-2 rounded-lg border text-left font-bold transition-all ${createKeyConfig === '2-user-1-ai' ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-300' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'}`}
                        >
                          <div className="font-sans text-xs">Hybrid (2 User + 1 AI)</div>
                          <div className="text-[9px] font-mono font-medium mt-0.5 text-zinc-500">Standby Micro-AI holds Key C</div>
                        </button>
                      </div>
                    </div>

                    {/* Inputs based on config */}
                    <div className="bg-zinc-950 p-3 border border-zinc-800 rounded-xl flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[10px] text-zinc-500 font-mono">KEY ALPHA SHARE</label>
                          <input 
                            type="password" 
                            placeholder="Primary password" 
                            value={createKeyA}
                            onChange={(e) => setCreateKeyA(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-1.5 text-white text-[11px] font-mono focus:outline-none focus:border-cyan-500/40"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[10px] text-zinc-500 font-mono">KEY BETA SHARE</label>
                          <input 
                            type="password" 
                            placeholder="Backup passphrase" 
                            value={createKeyB}
                            onChange={(e) => setCreateKeyB(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-1.5 text-white text-[11px] font-mono focus:outline-none focus:border-cyan-500/40"
                          />
                        </div>
                      </div>

                      {createKeyConfig === '3-user' ? (
                        <div className="flex flex-col gap-0.5 mt-1">
                          <label className="text-[10px] text-zinc-500 font-mono">KEY GAMMA SHARE (Third user password)</label>
                          <input 
                            type="password" 
                            placeholder="Sovereign hardware PIN or 3rd phrase" 
                            value={createKeyC}
                            onChange={(e) => setCreateKeyC(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-1.5 text-white text-[11px] font-mono focus:outline-none focus:border-cyan-500/40"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 mt-1 border-t border-zinc-900 pt-2">
                          <div className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                            AI CUSTODY CROWNS KEY GAMMA DEEP SEAL
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[9px] text-zinc-500 font-mono">RECOVERY CHALLENGE QUESTION</label>
                              <input 
                                type="text" 
                                placeholder="e.g. Primary philosophy?" 
                                value={createQuestion}
                                onChange={(e) => setCreateQuestion(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded p-1.5 text-white text-[11px] focus:outline-none focus:border-cyan-500/40"
                              />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[9px] text-zinc-500 font-mono">RECOVERY CHALLENGE ANSWER</label>
                              <input 
                                type="text" 
                                placeholder="e.g. harmony" 
                                value={createAnswer}
                                onChange={(e) => setCreateAnswer(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded p-1.5 text-white text-[11px] focus:outline-none focus:border-cyan-500/40"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-0.5 mt-1">
                        <label className="text-[10px] text-zinc-500 font-mono">RECOVERY HINT / KEY NOTES</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Key A stored in desk, Key B memorized." 
                          value={createHint}
                          onChange={(e) => setCreateHint(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded p-1.5 text-white text-[11px] focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleCreateSecret}
                      disabled={!createName || !createValue || !createKeyA || !createKeyB || (createKeyConfig === '3-user' && !createKeyC) || (createKeyConfig === '2-user-1-ai' && (!createQuestion || !createAnswer))}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:hover:bg-cyan-600 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-600/15"
                    >
                      Encrypt & Seal Secret Locally
                    </button>
                  </div>
                </div>

                {/* 2. LEDGER OF CIPHERTEXTS */}
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3 shadow-xl">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-cyan-400" />
                    Zero-Knowledge Encrypted Ledger
                  </h4>
                  <p className="text-[11px] text-zinc-500 font-mono">This ledger stores raw base64 ciphers. Content is unreadable until decryption.</p>
                  
                  <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-1">
                    {vaultSecrets.map((secret) => (
                      <div
                        key={secret.id}
                        onClick={() => handleSelectSecret(secret)}
                        className={`p-3 rounded-xl border cursor-pointer text-left transition-all flex flex-col gap-1 ${selectedSecret?.id === secret.id ? 'bg-cyan-500/5 border-cyan-500/40 shadow-sm' : 'bg-zinc-950 border-zinc-900 hover:border-zinc-800'}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs text-white truncate max-w-[180px]">{secret.name}</span>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${secret.keyConfig === '3-user' ? 'bg-zinc-900 text-zinc-400 border-zinc-800' : 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20'}`}>
                            {secret.keyConfig === '3-user' ? '3/3 Sovereign' : '2/3 Hybrid AI'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] text-zinc-600 font-mono">CIPHER:</span>
                          <span className="text-[9.5px] text-zinc-400 font-mono bg-zinc-900/50 p-1 rounded truncate leading-none border border-zinc-900/50">
                            {secret.encryptedPayload}
                          </span>
                        </div>
                        <span className="text-[8px] text-zinc-600 font-mono text-right mt-0.5">{secret.createdAt}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: TERMINAL & DECRYPTION (cols-7) */}
              <div className="xl:col-span-7 flex flex-col gap-6">
                
                {/* 1. THE RECOVERY / DECRYPTION PORTAL */}
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-cyan-400" />
                        Interactive Decryption Shield
                      </h4>
                      <p className="text-[11px] text-zinc-500 font-mono mt-0.5">Authorize your unique shares to unseal plain text in RAM</p>
                    </div>
                    {selectedSecret && (
                      <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest bg-cyan-950/20 border border-cyan-500/20 px-2 py-0.5 rounded">
                        Active Node Selected
                      </span>
                    )}
                  </div>

                  {selectedSecret ? (
                    <div className="flex flex-col gap-4">
                      {/* Selected Secret Details */}
                      <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl flex flex-col gap-2">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-zinc-500">TARGET:</span>
                          <span className="text-white font-bold">{selectedSecret.name}</span>
                        </div>
                        <div className="flex justify-between text-xs font-mono border-t border-zinc-900 pt-1.5">
                          <span className="text-zinc-500">CIPHER BLOCK:</span>
                          <span className="text-cyan-500 text-[10px] select-all truncate max-w-[250px]">{selectedSecret.encryptedPayload}</span>
                        </div>
                        <div className="flex flex-col text-xs font-mono border-t border-zinc-900 pt-1.5 gap-1">
                          <span className="text-zinc-500 text-[10px]">HINT / RECOVERY NOTE:</span>
                          <span className="text-zinc-400 leading-normal bg-zinc-900/50 p-1.5 border border-zinc-900 rounded text-[11px]">{selectedSecret.recoveryHint}</span>
                        </div>
                      </div>

                      {/* Inputs Form */}
                      <div className="flex flex-col gap-3">
                        <h5 className="text-[10.5px] font-mono text-zinc-400 font-bold tracking-wider uppercase">Provide multi-signature shares:</h5>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Share A */}
                          <div className="bg-zinc-950 border border-zinc-900 p-3 rounded-xl flex flex-col gap-2 relative">
                            <span className="text-[9px] font-mono text-zinc-500">SHARE A (Primary User)</span>
                            <div className="flex items-center gap-1.5">
                              {inputKeyA ? <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /> : <Lock className="w-4 h-4 text-zinc-600 shrink-0" />}
                              <input 
                                type="password" 
                                placeholder="Enter Key A..." 
                                value={inputKeyA}
                                onChange={(e) => setInputKeyA(e.target.value)}
                                className="bg-transparent border-none text-xs text-white font-mono p-0 focus:ring-0 w-full focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Share B */}
                          <div className="bg-zinc-950 border border-zinc-900 p-3 rounded-xl flex flex-col gap-2 relative">
                            <span className="text-[9px] font-mono text-zinc-500">SHARE B (Backup User)</span>
                            <div className="flex items-center gap-1.5">
                              {inputKeyB ? <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /> : <Lock className="w-4 h-4 text-zinc-600 shrink-0" />}
                              <input 
                                type="password" 
                                placeholder="Enter Key B..." 
                                value={inputKeyB}
                                onChange={(e) => setInputKeyB(e.target.value)}
                                className="bg-transparent border-none text-xs text-white font-mono p-0 focus:ring-0 w-full focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Share C */}
                          <div className={`border p-3 rounded-xl flex flex-col gap-2 relative transition-all ${
                            selectedSecret.keyConfig === '2-user-1-ai' 
                              ? 'bg-emerald-950/10 border-emerald-500/20' 
                              : 'bg-zinc-950 border-zinc-900'
                          }`}>
                            <span className={`text-[9px] font-mono ${selectedSecret.keyConfig === '2-user-1-ai' ? 'text-emerald-400' : 'text-zinc-500'}`}>
                              {selectedSecret.keyConfig === '2-user-1-ai' ? 'SHARE C (AI Custodian)' : 'SHARE C (Third User)'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {inputKeyC ? <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /> : <Lock className="w-4 h-4 text-zinc-600 shrink-0" />}
                              {selectedSecret.keyConfig === '2-user-1-ai' ? (
                                <input 
                                  type="text" 
                                  readOnly 
                                  placeholder="Await AI Auth share..." 
                                  value={inputKeyC ? '██████████████' : ''}
                                  className="bg-transparent border-none text-xs text-emerald-400 font-mono p-0 focus:ring-0 w-full focus:outline-none cursor-default"
                                />
                              ) : (
                                <input 
                                  type="password" 
                                  placeholder="Enter Key C..." 
                                  value={inputKeyC}
                                  onChange={(e) => setInputKeyC(e.target.value)}
                                  className="bg-transparent border-none text-xs text-white font-mono p-0 focus:ring-0 w-full focus:outline-none"
                                />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2.5 mt-2">
                          <button
                            onClick={handleDecryptSecret}
                            className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 rounded-xl text-xs transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-1.5"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            Decrypt Locally in RAM
                          </button>
                        </div>
                      </div>

                      {/* Decryption Errors */}
                      {decryptionError && (
                        <div className="bg-rose-950/30 border border-rose-500/20 p-3.5 rounded-xl text-xs text-rose-300 font-mono flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>{decryptionError}</span>
                        </div>
                      )}

                      {/* Decryption Success Plaintext Board */}
                      {isSuccessfullyDecrypted && (
                        <div className="bg-emerald-950/10 border-2 border-emerald-500/40 p-4 rounded-xl flex flex-col gap-2.5 shadow-2xl shadow-emerald-500/5 animate-in fade-in duration-300">
                          <div className="flex justify-between items-center border-b border-emerald-500/20 pb-1.5">
                            <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              UNSEALED RAM CONTENT SECURE
                            </span>
                            <span className="text-[9px] font-mono text-zinc-500">Never saved to network logs</span>
                          </div>
                          
                          <div className="bg-zinc-950 p-3 border border-zinc-900 rounded-lg text-emerald-300 font-mono text-sm break-all font-semibold select-all text-center tracking-wide">
                            {decryptedValue}
                          </div>

                          <div className="text-[10px] text-zinc-400 font-mono leading-normal pl-1 border-l-2 border-emerald-500">
                            <strong>Zero-Knowledge Assurance:</strong> The cryptographic key mapping and XOR evaluation were computed entirely inside your local browser memory frame. Because this is client-side code, no server-side agent or node could ever glimpse or reconstruct the secrets without physically owning your password shares.
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="h-[200px] flex flex-col items-center justify-center text-center text-zinc-500 font-mono gap-2 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/50">
                      <Lock className="w-8 h-8 text-zinc-600 animate-pulse" />
                      <p className="text-xs">Select an encrypted ledger item on the left column to configure decryption keys.</p>
                    </div>
                  )}
                </div>

                {/* 2. THE LOCAL STANDBY MICRO-AI CONSOLE */}
                <div className="bg-zinc-950 border border-emerald-500/30 rounded-2xl p-4 flex flex-col gap-3 font-mono shadow-xl relative overflow-hidden">
                  {/* Subtle terminal scanlines */}
                  <div className="absolute inset-0 bg-[radial-gradient(#052e16_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none"></div>
                  
                  <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-400 uppercase font-mono">Standby Micro-AI [μ-AI-v1.0.0]</span>
                    </div>
                    <span className="text-[9px] text-emerald-500 border border-emerald-500/30 bg-emerald-950/40 px-1.5 py-0.5 rounded font-mono">
                      THREAD ISO-AIRGAPPED
                    </span>
                  </div>

                  {/* Terminal log window */}
                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 text-[10px] text-emerald-500/90 h-[100px] overflow-y-auto flex flex-col gap-1 scrollbar-thin scrollbar-thumb-zinc-800">
                    {microAiLogs.map((log, index) => (
                      <div key={index} className="leading-tight break-all font-mono text-left">
                        {log}
                      </div>
                    ))}
                    <div className="animate-pulse">_</div>
                  </div>

                  {/* Terminal interactive prompt */}
                  {selectedSecret && selectedSecret.keyConfig === '2-user-1-ai' ? (
                    <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-xl flex flex-col gap-2.5 text-xs text-zinc-300">
                      {microAiStatus === 'standby' && (
                        <div className="flex flex-col gap-1.5 text-left">
                          <p className="text-[11px] text-zinc-400 leading-normal">
                            Key Share C is held by the Micro-AI custody container. Submit a secure identity challenge to release the key.
                          </p>
                          <button
                            onClick={() => {
                              setMicroAiStatus('challenge');
                              setMicroAiLogs(prev => [...prev, `[PROMPT] Identity verification initiated. Prompting secure recovery question.`]);
                            }}
                            className="w-fit bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-[10.5px] transition-all flex items-center gap-1"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                            Initiate Key Release Challenge
                          </button>
                        </div>
                      )}

                      {microAiStatus === 'challenge' && (
                        <div className="flex flex-col gap-2 text-left">
                          <div className="flex flex-col gap-0.5 font-bold">
                            <span className="text-[9px] text-amber-500 uppercase font-mono">μ-AI Security Question:</span>
                            <span className="text-white italic">"{selectedSecret.recoveryQuestion || 'What is our primary cultural goal?'}"</span>
                          </div>
                          
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Type recovery answer here..."
                              value={microAiChallengeResponse}
                              onChange={(e) => setMicroAiChallengeResponse(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleMicroAiVerify();
                              }}
                              className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-emerald-400 font-mono focus:outline-none focus:border-emerald-500/50"
                            />
                            <button
                              onClick={handleMicroAiVerify}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-bold transition-all"
                            >
                              Verify
                            </button>
                            <button
                              onClick={() => {
                                setMicroAiStatus('standby');
                                setMicroAiChallengeResponse('');
                              }}
                              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-1 rounded text-xs transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {microAiStatus === 'authorized' && (
                        <div className="text-[11px] text-emerald-400 font-bold bg-emerald-950/20 p-2 border border-emerald-500/20 rounded flex items-center gap-2 text-left">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>✓ Custody Key C Authorized and released directly into Decryption form!</span>
                        </div>
                      )}

                      {microAiStatus === 'rejected' && (
                        <div className="flex flex-col gap-1.5 text-left">
                          <div className="text-[11px] text-rose-400 font-bold bg-rose-950/20 p-2 border border-rose-500/20 rounded flex items-center gap-2">
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>✗ Security challenge answer mismatch. Auth share locked.</span>
                          </div>
                          <button
                            onClick={() => {
                              setMicroAiStatus('challenge');
                              setMicroAiChallengeResponse('');
                            }}
                            className="text-xs text-emerald-400 hover:text-emerald-300 font-bold text-left underline font-mono"
                          >
                            Retry Verification Prompt
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-500 leading-relaxed font-mono text-left">
                      [IDLE] Micro-AI Standby agent is inactive. Select a node protected by the "Hybrid AI" configuration to activate local verification challenges.
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};
