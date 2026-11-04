# Product CRUD: Next.js + ASP.NET Core + MySQL

A full-stack Product Management application built with **Next.js**, **ASP.NET Core Web API**, **Entity Framework Core**, and **MySQL**. The application supports product and category management, authentication, and published products.

## Tech Stack

### Frontend
- Next.js 14
- React
- TypeScript
- Tailwind CSS

### Backend
- ASP.NET Core Web API (.NET 10)
- C#
- Entity Framework Core 10
- JWT Authentication
- MySQL-compatible database provider

### Database
- MySQL / TiDB Cloud
- EF Core Migrations

### Deployment
- **Frontend:** Vercel
- **Backend:** Render
- **Database:** TiDB Cloud

## Prerequisites

- .NET 10 SDK → `dotnet --version`
- Node.js 18.17+ → `node --version`
- MySQL or TiDB Cloud database
- EF Core CLI tool:

```bash
dotnet tool install --global dotnet-ef
```

## 1. Backend Setup

Open terminal 1:

```bash
cd backend
dotnet restore
```

### Configure Database Connection

Update the connection string in `backend/appsettings.json`, or configure it using environment variables.

Example MySQL connection string:

```text
Server=localhost;
Port=3306;
Database=product_crud;
User=YOUR_USERNAME;
Password=YOUR_PASSWORD;
```

For TiDB Cloud, use the connection details provided by your TiDB cluster and enable the required TLS configuration.

**Environment variables:**

| Variable | Description |
|---|---|
| `ConnectionStrings__DefaultConnection` | MySQL/TiDB database connection |
| `Jwt__Key` | JWT signing key (minimum 32 characters) |
| `Cors__AllowedOrigin` | Allowed frontend origin |
| `Site__Url` | Frontend application URL |
| `Database__AutoMigrate` | Automatically apply migrations when enabled |

Keep database passwords and JWT keys out of Git.

### Database Migrations

If migrations have not already been created:

```bash
dotnet ef migrations add InitialCreate
```

Apply migrations:

```bash
dotnet ef database update
```

### Run Backend

```bash
dotnet run
```

The API will run at the local URL shown in the terminal.

Health endpoints:

```text
/health
/health/ready
```

Swagger documentation is available in Development mode if enabled by the application.

## 2. Frontend Setup

Open terminal 2:

```bash
cd frontend
npm install
```

Create a `.env.local` file inside the `frontend` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:5080
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Replace the API URL with the actual backend address shown by `dotnet run` if it differs.

Start the frontend:

```bash
npm run dev
```

Application:

```text
http://localhost:3000
```

## 3. Database Structure

The application uses Entity Framework Core with MySQL-compatible database storage.

Main tables include:

- `Users`
- `Categories`
- `Products`
- `Sales`
- `SaleItems`
- `Inquiries`
- `PasswordResetTokens`
- `AuditLogs`
- `__EFMigrationsHistory`

## 4. Production Deployment

### Frontend — Vercel

- Connect the GitHub repository to Vercel.
- Set the Root Directory to `frontend`.
- Select Next.js as the framework.
- Configure these environment variables:

```env
NEXT_PUBLIC_API_URL=https://YOUR-RENDER-API-URL
NEXT_PUBLIC_SITE_URL=https://YOUR-VERCEL-URL
```

Deploy the application.

### Backend — Render

- Connect the GitHub repository to Render.
- Select Docker as the deployment environment.
- Set the Root Directory to `backend`.
- Use `Dockerfile` as the Dockerfile path.
- Configure the production environment variables:

```env
ConnectionStrings__DefaultConnection=YOUR_TIDB_CONNECTION_STRING
Jwt__Key=YOUR_SECURE_JWT_SECRET
Cors__AllowedOrigin=https://YOUR-VERCEL-URL
Site__Url=https://YOUR-VERCEL-URL
Database__AutoMigrate=true
```

Deploy the API and verify:

```text
https://YOUR-RENDER-API-URL/health/ready
```

### Database — TiDB Cloud

- Create a TiDB Cloud cluster.
- Create a database named `product_crud`.
- Configure the database connection string in Render.
- Ensure TLS is enabled.
- Apply EF Core migrations to create or update the database schema.

## 5. Important Notes

- Never commit database credentials, JWT secrets, or production environment files.
- `NEXT_PUBLIC_` variables are exposed to the browser. Never put secrets in them.
- Redeploy the frontend after changing Vercel environment variables.
- Render free services may sleep after inactivity.
- Uploaded product images stored on Render's local filesystem may not persist across redeployments or restarts. Use persistent or external object storage for production image uploads.
- Production CORS settings must use your actual Vercel domain.

## Project Structure

```text
product-crud/
├── backend/
│   ├── Controllers/
│   ├── Models/
│   ├── Data/
│   ├── Services/
│   ├── Migrations/
│   ├── Dockerfile
│   └── ProductApi.csproj
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── package.json
│   └── next.config.js
│
└── README.md
```
