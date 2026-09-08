// Realistic ticket content for an Indian power-sector PSU IT helpdesk.
// Kept separate from seed.ts so the generator logic stays readable.

export interface TicketTemplate {
  title: string
  description: string
  category: string
  priority: string
  department: string
}

export const TICKET_TEMPLATES: TicketTemplate[] = [
  // ---------------------------------------------------------------- NETWORK
  {
    title: 'VPN not connecting from Korba regional office',
    description:
      'Since this morning I am unable to connect to the office VPN from the Korba regional office. The client shows "authentication failed" even though my domain password is working fine on the intranet portal. Three colleagues in the same office are facing the same issue, so it does not look like a problem with my laptop.',
    category: 'NETWORK',
    priority: 'HIGH',
    department: 'NETWORK_OPS',
  },
  {
    title: 'Internet extremely slow in Finance wing, 3rd floor',
    description:
      'Internet speed in the Finance wing on the 3rd floor has been very slow since yesterday afternoon. Opening the e-tendering portal takes almost two minutes. Other floors seem fine. Please check the switch for our floor.',
    category: 'NETWORK',
    priority: 'MEDIUM',
    department: 'NETWORK_OPS',
  },
  {
    title: 'Wi-Fi access point in Conference Room B is down',
    description:
      'The Wi-Fi access point in Conference Room B is not broadcasting any SSID. We have a video conference with the regional load despatch centre scheduled at 3 PM today and will need connectivity before that.',
    category: 'NETWORK',
    priority: 'HIGH',
    department: 'NETWORK_OPS',
  },
  {
    title: 'Unable to reach intranet portal from LAN',
    description:
      'The NTPC intranet portal is not opening from my desktop on the LAN. It works on mobile data through the guest network. Browser shows DNS_PROBE_FINISHED_NXDOMAIN. Possibly a DNS resolution issue on the internal network.',
    category: 'NETWORK',
    priority: 'MEDIUM',
    department: 'NETWORK_OPS',
  },
  {
    title: 'Network port in cabin 214 not working after shifting',
    description:
      'I have shifted to cabin 214 last week. The ethernet port in this cabin does not give any link light. I have tried two different cables and my laptop works fine on my colleague-s port. Request activation of this port.',
    category: 'NETWORK',
    priority: 'LOW',
    department: 'NETWORK_OPS',
  },
  {
    title: 'Complete network outage in Substation control room',
    description:
      'There is a complete network outage in the substation control room. No system is able to reach the SCADA historian or the internal network. This is affecting the entire shift team and monitoring operations. Requesting immediate attention.',
    category: 'NETWORK',
    priority: 'CRITICAL',
    department: 'NETWORK_OPS',
  },

  // --------------------------------------------------------------- HARDWARE
  {
    title: 'Laptop not booting - blue screen on startup',
    description:
      'My official laptop (asset tag MOP-LP-2291) is showing a blue screen every time I try to boot. It restarts automatically after showing the error. I have an important submission due tomorrow and all my working files are on this machine.',
    category: 'HARDWARE',
    priority: 'HIGH',
    department: 'IT_INFRA',
  },
  {
    title: 'Printer in Accounts section not printing - paper jam persists',
    description:
      'The HP LaserJet printer in the Accounts section keeps showing a paper jam error even after clearing all the trays. We are unable to print vouchers and payment advices. Please depute someone to check.',
    category: 'HARDWARE',
    priority: 'MEDIUM',
    department: 'IT_INFRA',
  },
  {
    title: 'Request for additional RAM upgrade for design workstation',
    description:
      'My workstation used for AutoCAD drawings has 8 GB RAM and is very slow when opening large single-line diagrams. Requesting an upgrade to 16 GB. The system is out of warranty so it should be possible to open it.',
    category: 'HARDWARE',
    priority: 'LOW',
    department: 'IT_INFRA',
  },
  {
    title: 'UPS in server room beeping continuously',
    description:
      'The UPS unit in the small server room has been beeping continuously since last night. The display shows a battery fault indication. Requesting urgent inspection as this room hosts the local file server.',
    category: 'HARDWARE',
    priority: 'CRITICAL',
    department: 'IT_INFRA',
  },
  {
    title: 'Monitor flickering and showing horizontal lines',
    description:
      'My desktop monitor has started flickering and shows horizontal lines across the screen intermittently. It becomes worse after the system has been on for an hour. Requesting a replacement monitor.',
    category: 'HARDWARE',
    priority: 'LOW',
    department: 'IT_INFRA',
  },
  {
    title: 'Toner cartridge replacement required for Stores department printer',
    description:
      'The printer in the Stores department is printing very faint copies. The toner appears to be finished. Requesting a replacement cartridge. Model is HP 88A.',
    category: 'HARDWARE',
    priority: 'LOW',
    department: 'IT_INFRA',
  },
  {
    title: 'Biometric attendance machine at Gate 2 not responding',
    description:
      'The biometric attendance machine installed at Gate 2 is not responding to finger punches since this morning. Employees are having to record attendance manually in a register. Please restore it at the earliest.',
    category: 'HARDWARE',
    priority: 'HIGH',
    department: 'IT_INFRA',
  },
  {
    title: 'Docking station not detecting external displays',
    description:
      'My docking station has stopped detecting both external monitors after the recent Windows update. The laptop screen works fine. I have tried reseating the cables and restarting.',
    category: 'HARDWARE',
    priority: 'MEDIUM',
    department: 'IT_INFRA',
  },

  // ---------------------------------------------------------------- ACCESS
  {
    title: 'Password reset required - account locked after multiple attempts',
    description:
      'My Active Directory account has been locked after I entered the wrong password a few times this morning. I am unable to log into my system or access email. Employee code is MOP-4417. Requesting an urgent unlock and password reset.',
    category: 'ACCESS',
    priority: 'HIGH',
    department: 'IT_INFRA',
  },
  {
    title: 'Access rights required for e-tendering portal',
    description:
      'I have recently joined the Contracts department and need access rights to the e-tendering portal for preparing and floating tenders. My reporting officer has approved this over email, which I can forward if needed.',
    category: 'ACCESS',
    priority: 'MEDIUM',
    department: 'APPLICATIONS',
  },
  {
    title: 'DSC token not being recognised for digital signing',
    description:
      'My Digital Signature Certificate token is not being recognised by the system while signing documents on the e-procurement portal. The token driver appears to be installed. This is blocking approval of two pending tenders.',
    category: 'ACCESS',
    priority: 'HIGH',
    department: 'APPLICATIONS',
  },
  {
    title: 'Shared folder access required for project documentation',
    description:
      'Requesting read and write access to the shared network folder for the transmission line project documentation. I need to upload survey reports. Folder path is \\\\fileserver\\Projects\\TL-765KV.',
    category: 'ACCESS',
    priority: 'LOW',
    department: 'IT_INFRA',
  },
  {
    title: 'Unable to login to HR portal - invalid credentials error',
    description:
      'I am getting an "invalid credentials" error while trying to log into the HR self-service portal to apply for leave, even though the same credentials work for email. Requesting assistance.',
    category: 'ACCESS',
    priority: 'MEDIUM',
    department: 'APPLICATIONS',
  },
  {
    title: 'New joinee account creation - 3 engineers in O&M department',
    description:
      'Three engineer trainees have joined the Operations and Maintenance department this week. Requesting creation of domain accounts, official email IDs and standard application access for all three. Details attached in the HR onboarding sheet.',
    category: 'ACCESS',
    priority: 'MEDIUM',
    department: 'IT_INFRA',
  },

  // ----------------------------------------------------------------- EMAIL
  {
    title: 'Outlook mailbox full - unable to send or receive mail',
    description:
      'My Outlook mailbox has reached its storage quota and I am unable to send or receive any emails. I have already archived old items but the quota does not seem to have been released. Requesting a quota increase.',
    category: 'EMAIL',
    priority: 'HIGH',
    department: 'IT_INFRA',
  },
  {
    title: 'Not receiving emails from external domains since yesterday',
    description:
      'I have not received a single email from any external domain since yesterday evening. Internal emails are coming through normally. I am expecting vendor quotations which may be getting blocked.',
    category: 'EMAIL',
    priority: 'HIGH',
    department: 'IT_INFRA',
  },
  {
    title: 'Request to create a distribution list for Safety Committee',
    description:
      'Requesting creation of a distribution list for the Safety Committee members so that circulars can be sent to all members at once. The list of 14 member email IDs is attached.',
    category: 'EMAIL',
    priority: 'LOW',
    department: 'IT_INFRA',
  },
  {
    title: 'Outlook keeps asking for password repeatedly',
    description:
      'Outlook on my desktop keeps prompting for my password every few minutes even after I enter it correctly and tick remember credentials. This has been happening since the last update.',
    category: 'EMAIL',
    priority: 'MEDIUM',
    department: 'IT_INFRA',
  },
  {
    title: 'Large attachment bouncing back with size limit error',
    description:
      'I am trying to send a 30 MB drawing file to a vendor but the mail keeps bouncing with a size limit error. Is there an approved way to share large files officially? Please advise.',
    category: 'EMAIL',
    priority: 'LOW',
    department: 'IT_INFRA',
  },

  // --------------------------------------------------------------- SAP_ERP
  {
    title: 'SAP MM module throwing error while creating purchase order',
    description:
      'While creating a purchase order in the SAP MM module using ME21N, I am getting a runtime error and the transaction is not going through. This has been happening since this morning. Two other users in Materials department report the same problem.',
    category: 'SAP_ERP',
    priority: 'CRITICAL',
    department: 'APPLICATIONS',
  },
  {
    title: 'SAP GUI not launching after recent update',
    description:
      'SAP Logon is not launching on my machine after the recent software update was pushed. It shows a brief splash and then closes without any error message. I need to process pending goods receipts.',
    category: 'SAP_ERP',
    priority: 'HIGH',
    department: 'APPLICATIONS',
  },
  {
    title: 'Authorization missing for FI module transaction FB03',
    description:
      'I need to view accounting documents using transaction FB03 but the system says I am not authorized. This access was available to me earlier in my previous posting. Requesting the role to be mapped again.',
    category: 'SAP_ERP',
    priority: 'MEDIUM',
    department: 'APPLICATIONS',
  },
  {
    title: 'SAP workflow approval not reaching the next approver',
    description:
      'A purchase requisition I released two days ago has not reached the next approver in the workflow. The status shows released from my end but the approver has not received it in their inbox. PR number is 1000234511.',
    category: 'SAP_ERP',
    priority: 'HIGH',
    department: 'APPLICATIONS',
  },
  {
    title: 'Report output in SAP HR module showing blank for current month',
    description:
      'The monthly manpower report in the SAP HR module is showing blank output for the current month, though previous months display correctly. Requesting a check on the report variant or data update.',
    category: 'SAP_ERP',
    priority: 'MEDIUM',
    department: 'APPLICATIONS',
  },

  // -------------------------------------------------------------- SOFTWARE
  {
    title: 'MS Office licence expired - activation prompt on all documents',
    description:
      'My MS Office installation is showing a licence expired message and every document opens in read-only mode. I am unable to edit or save any file. Requesting licence renewal or reactivation.',
    category: 'SOFTWARE',
    priority: 'HIGH',
    department: 'IT_INFRA',
  },
  {
    title: 'AutoCAD crashing while opening large drawing files',
    description:
      'AutoCAD crashes consistently when I try to open substation layout drawings above 50 MB. Smaller drawings open fine. I have already tried reinstalling the application once.',
    category: 'SOFTWARE',
    priority: 'MEDIUM',
    department: 'APPLICATIONS',
  },
  {
    title: 'Request for installation of statistical analysis software',
    description:
      'Requesting installation of approved statistical analysis software on my workstation for load forecasting work. The requirement has been approved by the department head.',
    category: 'SOFTWARE',
    priority: 'LOW',
    department: 'APPLICATIONS',
  },
  {
    title: 'PDF reader not opening digitally signed documents',
    description:
      'The PDF reader on my system is unable to open digitally signed documents received from the ministry. It shows a signature validation error. Other PDFs open normally.',
    category: 'SOFTWARE',
    priority: 'MEDIUM',
    department: 'APPLICATIONS',
  },
  {
    title: 'Antivirus showing outdated definitions warning',
    description:
      'My system antivirus has been showing an outdated definitions warning for the past week. The automatic update does not seem to be working. Requesting a manual definition update.',
    category: 'SOFTWARE',
    priority: 'MEDIUM',
    department: 'SECURITY',
  },
  {
    title: 'Excel file corrupted and not opening after power failure',
    description:
      'An important Excel file containing monthly generation data got corrupted after a sudden power failure yesterday. It shows an unreadable content error while opening. Is recovery possible from a backup?',
    category: 'SOFTWARE',
    priority: 'HIGH',
    department: 'IT_INFRA',
  },

  // -------------------------------------------------------------- SECURITY
  {
    title: 'Suspicious phishing email received claiming to be from IT department',
    description:
      'I have received an email claiming to be from the IT department asking me to verify my password through a link. The sender domain looks suspicious and does not match our official domain. I have not clicked the link. Reporting for verification.',
    category: 'SECURITY',
    priority: 'HIGH',
    department: 'SECURITY',
  },
  {
    title: 'Antivirus detected malware on shared department system',
    description:
      'The antivirus on the shared system in the Planning department has detected and quarantined a malware file. The file appears to have come from a USB drive. Requesting a full system scan and check of other machines.',
    category: 'SECURITY',
    priority: 'CRITICAL',
    department: 'SECURITY',
  },
  {
    title: 'Unauthorised login attempt notification on official account',
    description:
      'I have received a notification about an unauthorised login attempt on my official account from an unknown location. I have not attempted any login from outside the office. Requesting an urgent security check.',
    category: 'SECURITY',
    priority: 'CRITICAL',
    department: 'SECURITY',
  },
  {
    title: 'Request for guidance on secure handling of tender documents',
    description:
      'Seeking guidance from the information security team on the approved procedure for storing and sharing confidential tender documents, particularly whether cloud storage is permitted.',
    category: 'SECURITY',
    priority: 'LOW',
    department: 'SECURITY',
  },
  {
    title: 'USB port blocked - need approval for authorised data transfer',
    description:
      'USB ports on my system are blocked as per policy. I need to transfer survey data from a field device for a project. Requesting temporary authorised access with due approval.',
    category: 'SECURITY',
    priority: 'MEDIUM',
    department: 'SECURITY',
  },

  // ----------------------------------------------------------------- OTHER
  {
    title: 'Video conferencing setup required for board meeting',
    description:
      'A board meeting is scheduled next Tuesday in the main conference hall. Requesting setup and testing of the video conferencing equipment along with a technician on standby during the meeting.',
    category: 'OTHER',
    priority: 'MEDIUM',
    department: 'GENERAL',
  },
  {
    title: 'Query regarding official laptop policy for field postings',
    description:
      'I would like to understand the policy for carrying official laptops to field sites during inspections, particularly regarding data security requirements and insurance coverage.',
    category: 'OTHER',
    priority: 'LOW',
    department: 'GENERAL',
  },
  {
    title: 'Request for IT induction session for new trainees',
    description:
      'A batch of 12 executive trainees has joined this month. Requesting an IT induction session covering email policy, cyber security awareness and the helpdesk process.',
    category: 'OTHER',
    priority: 'LOW',
    department: 'GENERAL',
  },
]

export const KB_ARTICLES = [
  {
    slug: 'reset-forgotten-domain-password',
    title: 'How to reset a forgotten domain password',
    category: 'ACCESS',
    tags: 'password,reset,login,account,locked,active directory',
    body: `## Before you raise a ticket

Most password problems can be resolved by you in under two minutes.

### Self-service reset

1. Open the **Password Self-Service Portal** from the intranet home page.
2. Enter your employee code and registered mobile number.
3. Enter the OTP sent to your registered mobile.
4. Set a new password that meets the policy below.

### Password policy

- Minimum 12 characters
- At least one uppercase letter, one number and one special character
- Cannot repeat any of your last five passwords
- Must be changed every 90 days

### If your account is locked

An account locks automatically after five failed attempts and **unlocks by itself after 30 minutes**. If you cannot wait, raise a ticket under *Access / Account* with your employee code and the IT helpdesk will unlock it manually.

### Common mistakes

- Caps Lock left on — the most frequent cause by far.
- Using the old password on a device that has cached it (usually a mobile mail client). After changing your password, update it on every device, or the repeated failures will lock the account again.`,
  },
  {
    slug: 'vpn-connection-troubleshooting',
    title: 'VPN connection troubleshooting guide',
    category: 'NETWORK',
    tags: 'vpn,remote access,connection,authentication,network',
    body: `## Step-by-step VPN troubleshooting

Work through these in order before raising a ticket.

### 1. Confirm your internet works

Open any public website. If nothing loads, the problem is your internet connection, not the VPN.

### 2. Check the error message

| Error | Meaning | Action |
|---|---|---|
| Authentication failed | Wrong credentials, or expired password | Reset your domain password |
| Connection timed out | VPN gateway unreachable | Try the alternate gateway address |
| Certificate error | Client certificate expired | Raise a ticket — this needs IT |

### 3. Try the alternate gateway

The VPN client is configured with a primary and a secondary gateway. Switch to the secondary from the dropdown in the client and retry.

### 4. Restart the VPN service

On Windows, open Services, find the VPN client service, and restart it. This clears most stuck sessions.

### 5. Still failing?

Raise a ticket under *Network* and include:
- The exact error message (a screenshot helps)
- Your location and internet type (broadband, dongle, office LAN)
- Whether colleagues at the same location face the same issue

That last point matters: if several people at one location are affected, it is a gateway or site issue and will be escalated immediately rather than treated as an individual problem.`,
  },
  {
    slug: 'outlook-mailbox-full',
    title: 'What to do when your Outlook mailbox is full',
    category: 'EMAIL',
    tags: 'outlook,mailbox,quota,storage,email,full',
    body: `## Mailbox quota

Standard mailboxes are allotted 5 GB. You receive warnings at 80% and 95% before sending is blocked.

### Free up space quickly

1. **Empty Deleted Items** — this alone often recovers 10-20%.
2. **Clear the Sent Items folder** of mails older than a year.
3. **Sort by size**: in Outlook, click the *Size* column header to find the largest mails. A handful of big attachments usually account for most of the space.
4. **Archive** older mail to a local PST file stored in your home drive.

### Requesting a quota increase

If your role genuinely requires a larger mailbox, raise a ticket under *Email* with:
- Your current usage
- A short justification
- Your reporting officer in copy

Increases beyond 10 GB need departmental head approval.

### Preventing it from recurring

Set up an auto-archive rule to move mail older than 12 months out of the primary mailbox automatically. This is the single most effective habit — most repeat tickets on this topic come from users who cleared space manually once and never set up archiving.`,
  },
  {
    slug: 'printer-not-printing-checklist',
    title: 'Printer not printing — first-line checklist',
    category: 'HARDWARE',
    tags: 'printer,printing,paper jam,toner,hardware',
    body: `## Try these before raising a ticket

### The basics

1. Is the printer powered on and showing a ready status?
2. Is there paper in the tray, and is the tray pushed in fully?
3. Any error light or message on the display panel?

### Clearing a paper jam properly

Most repeat jam tickets happen because a torn fragment was left inside.

1. Switch off the printer.
2. Open every access door — front, rear, and the duplex unit.
3. Pull jammed paper **in the direction of paper travel**, never backwards.
4. Check for small torn pieces, especially near the fuser.
5. Close all doors and power on.

### Print queue stuck

If jobs pile up without printing, clear the queue: open the printer from Devices and Printers, select all jobs, and cancel. Then print a single test page.

### Faint or streaky prints

Usually low toner. Remove the cartridge, rock it gently side to side to redistribute the toner, and reinsert. This buys you a few hundred pages while a replacement is arranged.

### When to raise a ticket

Raise one under *Hardware* if there is a mechanical noise, a persistent error code, or the jam recurs after a proper clearance. Include the printer's location and model.`,
  },
  {
    slug: 'sap-gui-common-errors',
    title: 'SAP GUI common errors and fixes',
    category: 'SAP_ERP',
    tags: 'sap,erp,gui,logon,error,transaction',
    body: `## Common SAP GUI problems

### SAP Logon will not start

1. Close all SAP processes from Task Manager (\`saplogon.exe\`, \`sapgui.exe\`).
2. Relaunch as administrator.
3. If it still fails, the configuration file may be corrupt — raise a ticket and mention that you have already tried the above.

### "No authorization for transaction"

You do not have the role mapped for that transaction. Raise a ticket under *SAP / ERP* including:
- The exact transaction code (e.g. FB03, ME21N)
- The business justification
- Your reporting officer's approval

Authorisation requests without approval cannot be processed and will be sent back, so include it up front.

### Runtime error / short dump

Note the error text shown on screen — it usually contains a dump identifier. Include it in your ticket. Without it, the Basis team cannot trace the dump and will have to ask you for it, which costs a day.

### Transaction very slow

First check whether colleagues face the same slowness. System-wide slowness is a Basis issue and is handled at high priority; slowness for a single user is usually a local network or client issue.`,
  },
  {
    slug: 'identifying-phishing-emails',
    title: 'How to identify and report a phishing email',
    category: 'SECURITY',
    tags: 'phishing,security,email,suspicious,fraud,cyber',
    body: `## Recognising a phishing attempt

### Warning signs

- **Urgency and threat**: "Your account will be closed in 24 hours."
- **Sender domain mismatch**: the display name says IT Department but the actual address is a public domain. Always expand the sender address.
- **Generic greeting**: "Dear User" rather than your name.
- **Link mismatch**: hover over the link — the address shown in the status bar does not match the visible text.
- **Unexpected attachments**, especially .zip, .exe, .scr or macro-enabled Office files.

### The rule that covers almost everything

**The IT department will never ask for your password by email.** No legitimate internal process requires you to type your password into a page reached from an email link.

### If you receive a suspicious mail

1. Do **not** click any link or open any attachment.
2. Do **not** forward it to colleagues to ask what they think — that spreads the risk.
3. Raise a ticket under *Security* and attach the mail as an attachment (not as a forward, which strips the original headers).
4. Delete it after reporting.

### If you already clicked

Report it immediately — speed matters far more than embarrassment. Disconnect from the network, and raise a *Critical* ticket under *Security*. Prompt reporting has repeatedly limited damage; delayed reporting is what turns an incident into a breach.`,
  },
  {
    slug: 'requesting-new-software-installation',
    title: 'Requesting new software installation',
    category: 'SOFTWARE',
    tags: 'software,installation,licence,request,approval',
    body: `## Approved software process

Only software from the approved list may be installed on official systems. Installing unapproved software is a policy violation and may introduce licensing and security risk.

### For software on the approved list

Raise a ticket under *Software* with the software name and version, your asset tag, and a one-line business justification. These are typically actioned within two working days.

### For software not on the approved list

1. Raise a ticket with the full justification and vendor details.
2. The request goes for information-security review.
3. If cleared, procurement and licensing is arranged by the IT department.

Allow two to three weeks for the full cycle. Plan ahead — requests marked urgent still cannot skip the security review.

### Free and open-source software

Open-source tools still require the same review. "It's free" is not the relevant question; licence terms and security posture are.

### What you should not do

Do not download installers from the internet and run them, and do not use a personal licence on official equipment. Both create audit issues that eventually come back to the user.`,
  },
  {
    slug: 'slow-computer-troubleshooting',
    title: 'Computer running slow — what to check first',
    category: 'HARDWARE',
    tags: 'slow,performance,computer,hang,freeze,ram',
    body: `## Quick wins

### 1. Restart

A system that has not been restarted in weeks accumulates memory pressure. Restart properly — shut down and power on, not just sleep or lock.

### 2. Check what is consuming resources

Open Task Manager and sort by CPU, then by Memory. Common culprits:
- A browser with dozens of open tabs
- An antivirus full scan running in the background
- A stuck sync process

### 3. Free up disk space

Performance degrades sharply when the system drive is more than 90% full. Clear the Downloads folder, empty the Recycle Bin, and run Disk Cleanup.

### 4. Reduce startup programs

Task Manager → Startup tab. Disable anything not required at boot.

### When to raise a ticket

Raise one under *Hardware* if:
- The system is slow immediately after a fresh restart with nothing open
- You hear unusual noise from the machine
- It freezes completely and needs a hard power-off

Include your asset tag and, if possible, a Task Manager screenshot taken while it is slow. That screenshot frequently identifies the cause without a physical visit.`,
  },
  {
    slug: 'sla-and-ticket-priority-explained',
    title: 'Understanding ticket priority and SLA timelines',
    category: 'OTHER',
    tags: 'sla,priority,timeline,escalation,process',
    body: `## How priority is decided

Priority reflects **business impact**, not how urgent it feels to the requester. The helpdesk sets it automatically from the description, and an agent may adjust it.

| Priority | Meaning | First response | Resolution |
|---|---|---|---|
| Critical | Service down, many users, or a security incident | 15 minutes | 4 hours |
| High | Individual blocked from working, or a deadline at risk | 1 hour | 8 hours |
| Medium | Impaired but able to work | 4 hours | 24 hours |
| Low | Request or query, no work stoppage | 8 hours | 72 hours |

SLA timers count **working hours only** (Monday to Friday, 09:00 to 18:00). A Low-priority ticket raised on Friday afternoon is therefore due mid-week, not over the weekend.

### Getting the right priority

Describe the impact rather than asserting urgency. "Three people in Accounts cannot process payments" tells the system far more than "urgent, please do immediately", and will result in a higher priority.

### Escalation

A ticket that breaches its resolution SLA is escalated automatically: its priority is raised one level and the service manager is notified. You do not need to chase it.

### On hold

If a ticket needs something from you — approval, information, access to your machine — it may be placed On Hold. The SLA clock stops while on hold and resumes when you respond.`,
  },
  {
    slug: 'wifi-connection-issues',
    title: 'Wi-Fi connection issues — self-help guide',
    category: 'NETWORK',
    tags: 'wifi,wireless,connection,network,ssid',
    body: `## Cannot connect to office Wi-Fi

### Confirm you are on the right network

The office broadcasts separate networks for corporate devices and guests. Personal devices cannot join the corporate SSID — this is intentional.

### Forget and rejoin

The most reliable fix for a stale connection:

1. Open Wi-Fi settings.
2. Select the office network and choose **Forget**.
3. Reconnect and enter your domain credentials fresh.

### Connected but no internet

Usually an IP address issue. Toggle Wi-Fi off and on to force a new DHCP lease. If it persists, run \`ipconfig /release\` then \`ipconfig /renew\` from Command Prompt.

### Weak signal in specific areas

Some areas have known weak coverage. Before raising a ticket, check whether the issue follows you to another part of the building. If it is confined to one room, mention that — it points to an access-point problem rather than a device problem.

### Raising a ticket

Include your location, device type, whether others nearby are affected, and the exact behaviour (cannot see the network / cannot authenticate / connects but no internet). These three cases have completely different causes.`,
  },
  {
    slug: 'data-backup-guidelines',
    title: 'Data backup guidelines for official systems',
    category: 'OTHER',
    tags: 'backup,data,storage,recovery,files',
    body: `## Your data is not backed up automatically

This is the single most important thing to understand: files saved on your **local drive (C:) are not backed up**. If the drive fails, the data is gone.

### Where to save official data

| Location | Backed up | Use for |
|---|---|---|
| Home drive (H:) | Yes, nightly | Personal working files |
| Department share | Yes, nightly | Shared project documents |
| Local C: drive | **No** | Temporary files only |
| Desktop | **No** | Nothing important |

### Recovering a deleted file

Files on backed-up drives can be restored from the previous night's backup. Raise a ticket under *Other* with the full file path and the date you last saw the file. Retention is 30 days.

### Before a system reformat or replacement

Move everything to your home drive first. The IT team will remind you, but the responsibility for confirming the data is copied rests with you — once a machine is reimaged, local data cannot be recovered.

### A practical habit

Set your applications to save to the H: drive by default. Almost every data-loss ticket traces back to files sitting on a desktop that nobody backed up.`,
  },
  {
    slug: 'how-to-raise-an-effective-ticket',
    title: 'How to raise an effective helpdesk ticket',
    category: 'OTHER',
    tags: 'ticket,helpdesk,process,how to,raise',
    body: `## Getting your issue resolved faster

A well-described ticket is typically resolved in a fraction of the time, because it avoids the back-and-forth of clarifying questions.

### Write a specific title

- Weak: "System problem"
- Strong: "Laptop MOP-LP-2291 shows blue screen on every boot"

### Include these details

1. **What you were doing** when the problem occurred.
2. **The exact error message** — a screenshot is ideal.
3. **Your asset tag** for hardware, or the transaction code for SAP.
4. **What you have already tried.** This prevents the agent suggesting steps you have exhausted.
5. **Who else is affected.** This directly influences priority.

### Attachments help

Screenshots of error messages are the highest-value attachment. For a photograph of a screen, ensure the error text is legible.

### After raising

- You will receive a ticket number in the format MOP-YYYY-NNNNN. Quote it in any correspondence.
- Watch for a response — if the agent asks a question and it goes unanswered, the ticket is placed On Hold and resolution stalls.
- Once resolved, please rate the resolution. The ratings genuinely feed into how the service is measured and improved.

### Do not raise duplicates

Raising the same issue twice splits the history across tickets and slows both down. If you need to add information, comment on the existing ticket instead. The system will warn you when a new ticket looks like one you already have open.`,
  },
]

export const COMMENT_TEMPLATES = {
  agentFirst: [
    'Thank you for raising this. I am looking into the issue and will update you shortly.',
    'Acknowledged. I have assigned this to myself and started investigating.',
    'Received. Could you please confirm your asset tag so I can check the configuration?',
    'Thank you for reporting. I am checking the logs at our end and will revert within the hour.',
    'Noted. I will need remote access to your system — please let me know a convenient time.',
  ],
  agentProgress: [
    'I have replicated the issue at my end. Working on a fix now.',
    'This appears to be related to a recent configuration change. Coordinating with the network team.',
    'Escalating to the vendor as this requires their support. Will keep you posted.',
    'Partial fix applied. Please check and confirm whether the issue persists.',
    'Awaiting approval from the reporting officer before proceeding further.',
  ],
  agentResolution: [
    'The issue has been resolved. Please verify at your end and confirm.',
    'Fixed. The root cause was a stale configuration entry which has now been corrected.',
    'Resolved. Access has been granted and you should be able to log in now.',
    'The hardware has been replaced and tested. Working normally now.',
    'Resolved after clearing the cached credentials. Please raise a fresh ticket if it recurs.',
  ],
  userReply: [
    'Thank you, I will check and confirm.',
    'Yes, the issue is still occurring. Attaching a screenshot of the error.',
    'Confirmed working now. Thank you for the quick resolution.',
    'I am available after 3 PM today for remote access.',
    'The problem seems to have reduced but has not gone away completely.',
  ],
  internalNotes: [
    'Checked the AD logs — account was locked due to a cached credential on the user mobile device.',
    'This is the third similar report from the same floor. Possible switch issue, informing network team.',
    'Vendor ticket raised, reference VN-88231. SLA at vendor end is 48 hours.',
    'User has been briefed about the policy. Closing after confirmation.',
    'Root cause: DHCP scope exhaustion on VLAN 40. Permanent fix scheduled in the next maintenance window.',
  ],
}
