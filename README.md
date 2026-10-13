# Product CRUD: Next.js + ASP.NET Core + SQL Server

## Prerequisites
- .NET 8 SDK          -> `dotnet --version`
- Node.js 18.17+      -> `node --version`
- SQL Server (LocalDB, Express, or Docker)
- EF Core CLI tool    -> `dotnet tool install --global dotnet-ef`

## 1. Backend (terminal 1)
```bash
cd backend
dotnet restore
dotnet ef migrations add InitialCreate
dotnet ef database update
dotnet run
```
API: http://localhost:5080  | Swagger UI: http://localhost:5080/swagger

## 2. Frontend (terminal 2)
```bash
cd frontend
npm install
npm run dev
```
App: http://localhost:3000  (redirects to /products)

## Connection string
Default (Windows LocalDB) is in `backend/appsettings.json`.
For SQL Server in Docker / with a password, keep the secret OUT of Git:
```bash
cd backend
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost,1433;Database=ProductCrudDb;User Id=sa;Password=YOUR_PASSWORD;TrustServerCertificate=True"
```
Docker SQL Server:
```bash
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=YourStrong!Passw0rd" -p 1433:1433 -d mcr.microsoft.com/mssql/server:2022-latest
```
