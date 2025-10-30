# Kapso WhatsApp broadcasts example

Example Next.js app demonstrating Kapso's Broadcasts API for WhatsApp mass messaging campaigns.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fgokapso%2Fwhatsapp-broadcasts-example&env=KAPSO_API_KEY,PHONE_NUMBER_ID,NEXT_PUBLIC_PHONE_NUMBER_ID,BUSINESS_ACCOUNT_ID&envDescription=Required%20Kapso%20credentials&envLink=https%3A%2F%2Fdocs.kapso.ai)

## Features

- **5-step wizard UI** - Clean, intuitive stepper interface
- **Batch recipient upload** - Add up to 1,000 recipients per request via CSV
- **Real-time progress tracking** - Auto-polling during broadcast send
- **Recipient-level analytics** - Per-phone delivery status with pagination
- **Response rate metrics** - Track engagement and campaign performance

## Quick start

```bash
# Clone the repository
git clone https://github.com/gokapso/whatsapp-broadcasts-example.git
cd whatsapp-broadcasts-example

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Kapso API key and WhatsApp phone number ID

# Run development server
npm run dev
```

Open [http://localhost:4000](http://localhost:4000)

## Setup

### 1. Get Kapso API key

1. Sign up at [app.kapso.ai](https://app.kapso.ai)
2. Go to Sidebar → API Keys
3. Create a new API key
4. Copy the key to your `.env` file

### 2. Connect WhatsApp

1. In your Kapso dashboard, go to Connected numbers and connect a WhatsApp Business account
2. Copy the phone number ID from your connected WhatsApp number
3. Copy your WhatsApp Business Account ID
4. Add both IDs to your `.env` file:
   - `PHONE_NUMBER_ID` - Used for sending broadcasts
   - `NEXT_PUBLIC_PHONE_NUMBER_ID` - Used for client-side display
   - `BUSINESS_ACCOUNT_ID` - Used for fetching templates

### 3. Create templates

1. In Kapso dashboard (or directly in Meta), create WhatsApp message templates
2. Get them approved by Meta
3. Templates will appear in the app automatically

## CSV format

Upload a CSV file with phone numbers and template parameters:

```csv
phone,param1,param2
+15551234567,John,Order123
+15559876543,Jane,Order456
```

- **First column**: Phone number (E.164 format with + prefix)
- **Remaining columns**: Template parameters in order

## API endpoints

This app uses the following Kapso API endpoints:

- `GET /whatsapp_templates` - Fetch approved templates
- `POST /whatsapp_broadcasts` - Create draft broadcast
- `POST /whatsapp_broadcasts/:id/recipients` - Add recipients
- `POST /whatsapp_broadcasts/:id/send` - Send broadcast
- `GET /whatsapp_broadcasts/:id` - Get broadcast status
- `GET /whatsapp_broadcasts/:id/recipients` - List recipients

## Tech stack

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Styling
- **shadcn/ui** - UI components
- **Kapso API** - WhatsApp broadcasts

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── broadcasts/          # Broadcast API routes
│   │   └── templates/           # Template API routes
│   └── page.tsx                 # Main stepper UI
├── components/ui/               # shadcn components
├── lib/
│   ├── kapso-api.ts            # Kapso API client
│   ├── csv-parser.ts           # CSV parsing utilities
│   └── utils.ts                # Utility functions
└── types/index.ts              # TypeScript types
```

## Documentation

- [Create Broadcast API](https://docs.kapso.ai/api-reference/whatsapp-broadcasts/create-broadcast)
- [List WhatsApp Templates API](https://docs.kapso.ai/api-reference/whatsapp-templates/list-whatsapp-templates)
- [Full API Reference](https://docs.kapso.ai/api-reference)

## License

MIT
