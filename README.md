HACKATHON 2026 COMMSTEM DATASOC

# Running the application
Access a deployed version of the application on Vercel here: [AXEL HACKATHON PAGE](axel-hackathon.me) 
(Domain name: www.axel-hackathon.me)

> [!WARNING]
To run the application locally, you will be required to fill out the .env file with actual tokens or else the application will break.

> [!NOTE]
To run the application, please ensure "npm" or equivalent package manager 

(..\HACKATHON-2026> is the direction shown in the terminal, please run the commands from npm onwards)
``` 
terminal
copy .env.example .env

fill out the .env file with actual tokens (please contact the team if tokens are required)
```

``` 
terminal
..\HACKATHON-2026> npm install
..\HACKATHON-2026> npm run dev
```

## Code Stack
This project has been written in React Typescript, using React Router with a framework of Vite. Modules used include shadCN, tailwindcss for styling, Clerk for authentication, Supabase for database, MapBox for map items and 3D map display, Nominatim lookups for suburb boundaries, Vercel for hosting, Groq for AI API calls.

## AI Acknowledgement
This project has been assisted by Artificial Intelligence. Agents and models were used to assist in ideas, coding and assistance in choosing and work with the stack.
Models Used:
Claude Haiku 4.5
Claude Sonnet 4.6
Gemini 3.1 Pro
GPT-5.3-Codex