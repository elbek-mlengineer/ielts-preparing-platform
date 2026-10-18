# System Architecture

## 1. Tech Stack
- **Framework:** Next.js 14+ (App Router) with TypeScript & React Server Components.
- **Styling & UI:** Tailwind CSS, Lucide Icons, shadcn/ui.
- **Database & ORM:** PostgreSQL + Prisma ORM.
- **Authentication:** Auth.js (NextAuth v5) / Lucia Auth with session cookies and Role-Based Access Control (RBAC).
- **AI Service Layer:** Abstracted provider pattern (OpenAI / Google Gemini) with fallback mechanisms and strict input moderation.
- **Voice / Audio:** WebRTC / WebSockets for low-latency Speaking sessions, AWS S3 / Cloudflare R2 for audio recordings.
- **Payments:** Local billing adapter supporting Click, Payme, and Uzum webhooks.

## 2. Directory Structure