Vaulted: E2EE Messaging & Calling
Vaulted is a prototype for a secure, end-to-end encrypted messaging and calling application. It is built as a monorepo containing a Node.js backend and a React frontend.

Features
Secure Messaging: Messages are encrypted on the client using libsodium-wrappers before being sent. The server only stores ciphertext and message metadata.

WebRTC Calls: 1:1 audio and video calls are established using WebRTC, with a WebSocket channel for signaling.

Offline-First: Messages are queued in IndexedDB and sent once an internet connection is re-established.

Monorepo: The project is structured using pnpm workspaces for a streamlined development experience.

Prerequisites
Node.js (v18 or higher)

pnpm (v8 or higher)

Docker and Docker Compose

## Setup & Run

1. Clone the repository and navigate to the project root:

   ```bash
   git clone <repository_url>
   cd vaulted-web
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the application:

   This single command will start both the backend server and the frontend development server. The backend will automatically run database migrations.

   ```bash
   pnpm dev
   ```

   The frontend will be available at [http://localhost:5173](http://localhost:5173). The backend API and WebSocket server will be running on [http://localhost:8787](http://localhost:8787).

4. Log in:

   The login process is simulated. When you enter an email on the login screen, a "magic link" will be printed to your terminal where you can copy the URL and paste it into your browser to log in. You can open multiple browser tabs/windows and log in with different emails to simulate multiple users.

### Important Notes

*   **Database**: The SQLite database (`vaulted.db`) will be created in the `apps/server/` directory on first run, and necessary tables will be automatically migrated.
*   **Unused `nanoid` import**: The `nanoid` import in `apps/server/signaling.js` is currently unused but will be utilized in future updates for generating unique call IDs.